use axum::Json;
use axum::extract::{Path, Query, State};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{DeleteResult, GameQuery, verify_game_access};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::validate_str;

use super::helpers::{
    BatchConfirmInput, BatchConfirmOutput, BatchPrepareInput, ConfirmUploadInput,
    ConfirmUploadOutput, CreateFolderInput, DownloadUrlOutput, EnsureFolderPathInput,
    EnsureFolderPathOutput, FileOutput, FileRow, ListQuery, MoveInput, PrepareUploadInput,
    PrepareUploadOutput, RenameInput, RenameOutput, UploadUrlInput, UploadUrlOutput,
    check_name_conflict, check_name_conflict_exclude, is_descendant, parse_optional_uuid,
    soft_delete_recursive,
};

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Vec<FileOutput>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    let parent_id: Option<Uuid> = match &q.parent_id {
        Some(pid) if !pid.is_empty() && pid != "null" => {
            Some(Uuid::parse_str(pid).map_err(|_| ApiError::bad_request("Invalid parent_id"))?)
        }
        _ => None,
    };

    let rows = if let Some(pid) = parent_id {
        sqlx::query_as::<_, FileRow>(
            "SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at \
             FROM files WHERE game_id = $1 AND parent_id = $2 AND deleted_at IS NULL ORDER BY type DESC, name ASC",
        )
        .bind(game_id)
        .bind(pid)
        .fetch_all(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, FileRow>(
            "SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at \
             FROM files WHERE game_id = $1 AND parent_id IS NULL AND deleted_at IS NULL ORDER BY type DESC, name ASC",
        )
        .bind(game_id)
        .fetch_all(&state.db.pool)
        .await?
    };

    let files: Vec<FileOutput> = rows.iter().map(FileOutput::from).collect();
    Ok(Json(files))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<FileOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row = sqlx::query_as::<_, FileRow>(
        "SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at \
         FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some(f) => Ok(Json(FileOutput::from(&f))),
        None => Err(ApiError::not_found("文件不存在")),
    }
}

pub async fn get_path(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<FileOutput>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    // Walk up the parent chain using a recursive CTE (single query instead of N+1)
    let rows = sqlx::query_as::<_, FileRow>(
        r#"
        WITH RECURSIVE ancestors AS (
            SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at
            FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL
            UNION ALL
            SELECT f.id, f.game_id, f.name, f.type, f.parent_id, f.storage_key, f.size, f.mime_type, f.created_at, f.updated_at, f.deleted_at
            FROM files f JOIN ancestors a ON f.id = a.parent_id
            WHERE f.game_id = $2 AND f.deleted_at IS NULL
        )
        SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at FROM ancestors
        "#,
    )
    .bind(id)
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    // CTE returns leaf→root order, reverse to root→leaf
    let mut path: Vec<FileOutput> = rows.iter().map(FileOutput::from).collect();
    path.reverse();
    Ok(Json(path))
}

pub async fn create_folder(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateFolderInput>,
) -> ApiResult<Json<FileOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let parent_id = parse_optional_uuid(&input.parent_id)?;
    let name = validate_str(&input.name, "文件夹名称", 255)?;

    // Check name conflict
    let conflict = check_name_conflict(&state, game_id, parent_id, &name).await?;
    if conflict {
        return Err(ApiError::bad_request(format!(
            "文件夹 '{}' 已存在于当前目录",
            name
        )));
    }

    let row = sqlx::query_as::<_, FileRow>(
        "INSERT INTO files (game_id, name, type, parent_id) VALUES ($1, $2, 'folder', $3) \
         RETURNING id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at",
    )
    .bind(game_id)
    .bind(&name)
    .bind(parent_id)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(FileOutput::from(&row)))
}

pub async fn prepare_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<PrepareUploadInput>,
) -> ApiResult<Json<PrepareUploadOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let parent_id = parse_optional_uuid(&input.parent_id)?;
    let storage_key = format!("{}/{}", game_id, Uuid::new_v4());

    let presigned_url = state
        .storage
        .get_upload_url(&storage_key, None, 3600)
        .await
        .map_err(|e| ApiError::internal(format!("S3 presigned URL failed: {}", e)))?;

    let row = sqlx::query_as::<_, FileRow>(
        "INSERT INTO files (game_id, name, type, parent_id, storage_key, size, mime_type) VALUES ($1, $2, 'file', $3, $4, $5, $6) \
         RETURNING id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at",
    )
    .bind(game_id)
    .bind(&input.name)
    .bind(parent_id)
    .bind(&storage_key)
    .bind(input.size)
    .bind(&input.mime_type)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(PrepareUploadOutput {
        file: FileOutput::from(&row),
        upload_url: presigned_url,
    }))
}

pub async fn confirm_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ConfirmUploadInput>,
) -> ApiResult<Json<ConfirmUploadOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let file_id =
        Uuid::parse_str(&input.file_id).map_err(|_| ApiError::bad_request("Invalid file_id"))?;

    // Verify the file exists and has a storage_key
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL AND storage_key IS NOT NULL)",
    )
    .bind(file_id)
    .bind(game_id)
    .fetch_one(&state.db.pool)
    .await?;

    if !exists {
        return Err(ApiError::not_found("文件不存在或没有存储信息"));
    }

    Ok(Json(ConfirmUploadOutput {
        confirmed: true,
        file_id,
    }))
}

pub async fn get_download_url(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DownloadUrlOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let storage_key: Option<Option<String>> = sqlx::query_scalar(
        "SELECT storage_key FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL AND type = 'file'",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let storage_key = storage_key
        .flatten()
        .ok_or_else(|| ApiError::not_found("文件不存在"))?;

    let url = state
        .storage
        .get_download_url(&storage_key, 3600)
        .await
        .map_err(|e| ApiError::internal(format!("S3 presigned URL failed: {}", e)))?;

    Ok(Json(DownloadUrlOutput { url }))
}

pub async fn get_upload_url(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UploadUrlInput>,
) -> ApiResult<Json<UploadUrlOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let storage_key = format!("{}/{}", game_id, Uuid::new_v4());

    let url = state
        .storage
        .get_upload_url(&storage_key, None, 3600)
        .await
        .map_err(|e| ApiError::internal(format!("S3 presigned URL failed: {}", e)))?;

    Ok(Json(UploadUrlOutput { url, storage_key }))
}

pub async fn rename(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<RenameInput>,
) -> ApiResult<Json<RenameOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = validate_str(&input.name, "文件名", 255)?;

    // Get current file's parent_id
    let parent_id: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT parent_id FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let parent_id = parent_id.ok_or_else(|| ApiError::not_found("文件不存在"))?;

    // Check name conflict
    let conflict = check_name_conflict_exclude(&state, game_id, parent_id, &name, id).await?;
    if conflict {
        return Err(ApiError::bad_request(format!(
            "名称 '{}' 已存在",
            name
        )));
    }

    sqlx::query("UPDATE files SET name = $1, updated_at = NOW() WHERE id = $2 AND game_id = $3")
        .bind(&name)
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(RenameOutput {
        id,
        name,
    }))
}

pub async fn move_file(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<MoveInput>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let new_parent_id = parse_optional_uuid(&input.parent_id)?;

    // Prevent moving into itself or its descendants
    if let Some(target) = new_parent_id {
        if target == id {
            return Err(ApiError::bad_request("不能将文件夹移动到自身内部"));
        }
        if is_descendant(&state, game_id, target, id).await? {
            return Err(ApiError::bad_request("不能将文件夹移动到其子目录"));
        }
    }

    if let Some(pid) = new_parent_id {
        sqlx::query(
            "UPDATE files SET parent_id = $1, updated_at = NOW() WHERE id = $2 AND game_id = $3",
        )
        .bind(pid)
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    } else {
        sqlx::query(
            "UPDATE files SET parent_id = NULL, updated_at = NOW() WHERE id = $1 AND game_id = $2",
        )
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    }

    Ok(Json(DeleteResult { id }))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    // Soft delete: set deleted_at, cascade to children
    soft_delete_recursive(&state, game_id, id).await?;

    Ok(Json(DeleteResult { id }))
}

pub async fn batch_prepare_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchPrepareInput>,
) -> ApiResult<Json<Vec<PrepareUploadOutput>>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let mut results = Vec::new();

    for file in &input.files {
        let parent_id = parse_optional_uuid(&file.parent_id)?;
        let storage_key = format!("{}/{}", game_id, Uuid::new_v4());

        let presigned_url = state
            .storage
            .get_upload_url(&storage_key, None, 3600)
            .await
            .map_err(|e| ApiError::internal(format!("S3 presigned URL failed: {}", e)))?;

        let row = sqlx::query_as::<_, FileRow>(
            "INSERT INTO files (game_id, name, type, parent_id, storage_key, size, mime_type) VALUES ($1, $2, 'file', $3, $4, $5, $6) \
             RETURNING id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at",
        )
        .bind(game_id)
        .bind(&file.name)
        .bind(parent_id)
        .bind(&storage_key)
        .bind(file.size)
        .bind(&file.mime_type)
        .fetch_one(&state.db.pool)
        .await?;

        results.push(PrepareUploadOutput {
            file: FileOutput::from(&row),
            upload_url: presigned_url,
        });
    }

    Ok(Json(results))
}

pub async fn batch_confirm_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchConfirmInput>,
) -> ApiResult<Json<BatchConfirmOutput>> {
    let _game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    // Batch confirm — just acknowledge
    Ok(Json(BatchConfirmOutput {
        confirmed: input.file_ids.len(),
    }))
}

pub async fn ensure_folder_path(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<EnsureFolderPathInput>,
) -> ApiResult<Json<EnsureFolderPathOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let parts: Vec<&str> = input.path.split('/').filter(|s| !s.is_empty()).collect();

    let mut parent_id: Option<Uuid> = None;

    for part in &parts {
        // Try to find existing folder
        let existing: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM files WHERE game_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND LOWER(name) = LOWER($3) AND type = 'folder' AND deleted_at IS NULL",
        )
        .bind(game_id)
        .bind(parent_id)
        .bind(part)
        .fetch_optional(&state.db.pool)
        .await?;

        match existing {
            Some(id) => {
                parent_id = Some(id);
            }
            None => {
                // Create folder
                let new_id: Uuid = sqlx::query_scalar(
                    "INSERT INTO files (game_id, name, type, parent_id) VALUES ($1, $2, 'folder', $3) RETURNING id",
                )
                .bind(game_id)
                .bind(part)
                .bind(parent_id)
                .fetch_one(&state.db.pool)
                .await?;
                parent_id = Some(new_id);
            }
        }
    }

    Ok(Json(EnsureFolderPathOutput {
        folder_id: parent_id,
        path: input.path,
    }))
}
