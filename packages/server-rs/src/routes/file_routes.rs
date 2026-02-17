use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::Response;
use axum::{Json, Router};
use serde::Deserialize;
use tokio_util::io::ReaderStream;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, resolve_game_id_by_slug, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

#[derive(sqlx::FromRow)]

struct FileRow {
    id: Uuid,
    _game_id: Uuid,
    name: String,
    #[sqlx(rename = "type")]
    file_type: String,
    parent_id: Option<Uuid>,
    storage_key: Option<String>,
    size: Option<i64>,
    mime_type: Option<String>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
    _deleted_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Authenticated file management routes
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list))
        .route("/{id}", axum::routing::get(get).delete(delete))
        .route("/{id}/path", axum::routing::get(get_path))
        .route("/folder", axum::routing::post(create_folder))
        .route("/prepare-upload", axum::routing::post(prepare_upload))
        .route("/confirm-upload", axum::routing::post(confirm_upload))
        .route("/download-url/{id}", axum::routing::get(get_download_url))
        .route("/upload-url", axum::routing::post(get_upload_url))
        .route("/rename/{id}", axum::routing::put(rename))
        .route("/move/{id}", axum::routing::put(move_file))
        .route("/batch-prepare-upload", axum::routing::post(batch_prepare_upload))
        .route("/batch-confirm-upload", axum::routing::post(batch_confirm_upload))
        .route("/ensure-folder-path", axum::routing::post(ensure_folder_path))
}

// ===== Authenticated handlers =====

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListQuery {
    game_id: String,
    parent_id: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    let parent_id: Option<Uuid> = match &q.parent_id {
        Some(pid) if !pid.is_empty() && pid != "null" => Some(
            Uuid::parse_str(pid).map_err(|_| ApiError::bad_request("Invalid parent_id"))?,
        ),
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

    let files: Vec<serde_json::Value> = rows.iter().map(file_to_json).collect();
    Ok(Json(files))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
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
        Some(f) => Ok(Json(file_to_json(&f))),
        None => Err(ApiError::not_found("文件不存在")),
    }
}

async fn get_path(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
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
        SELECT * FROM ancestors
        "#,
    )
    .bind(id)
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    // CTE returns leaf→root order, reverse to root→leaf
    let mut path: Vec<serde_json::Value> = rows.iter().map(file_to_json).collect();
    path.reverse();
    Ok(Json(path))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateFolderInput {
    game_id: String,
    name: String,
    parent_id: Option<String>,
}

async fn create_folder(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateFolderInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let parent_id = parse_optional_uuid(&input.parent_id)?;

    // Check name conflict
    let conflict = check_name_conflict(&state, game_id, parent_id, &input.name).await?;
    if conflict {
        return Err(ApiError::bad_request(format!(
            "文件夹 '{}' 已存在于当前目录",
            input.name
        )));
    }

    let row = sqlx::query_as::<_, FileRow>(
        "INSERT INTO files (game_id, name, type, parent_id) VALUES ($1, $2, 'folder', $3) \
         RETURNING id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at",
    )
    .bind(game_id)
    .bind(&input.name)
    .bind(parent_id)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(file_to_json(&row)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrepareUploadInput {
    game_id: String,
    name: String,
    parent_id: Option<String>,
    mime_type: Option<String>,
    size: Option<i64>,
}

async fn prepare_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<PrepareUploadInput>,
) -> ApiResult<Json<serde_json::Value>> {
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

    Ok(Json(serde_json::json!({
        "file": file_to_json(&row),
        "uploadUrl": presigned_url,
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmUploadInput {
    game_id: String,
    file_id: String,
}

async fn confirm_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ConfirmUploadInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let file_id = Uuid::parse_str(&input.file_id).map_err(|_| ApiError::bad_request("Invalid file_id"))?;

    // Verify the file exists and has a storage_key
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT storage_key FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL AND storage_key IS NOT NULL",
    )
    .bind(file_id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    if row.is_none() {
        return Err(ApiError::not_found("文件不存在或没有存储信息"));
    }

    // Optionally verify with S3 head_object
    // For now, just confirm
    Ok(Json(serde_json::json!({"confirmed": true, "fileId": file_id})))
}

async fn get_download_url(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT storage_key FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL AND type = 'file'",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let storage_key = row
        .and_then(|(k,)| k)
        .ok_or_else(|| ApiError::not_found("文件不存在"))?;

    let url = state
        .storage
        .get_download_url(&storage_key, 3600)
        .await
        .map_err(|e| ApiError::internal(format!("S3 presigned URL failed: {}", e)))?;

    Ok(Json(serde_json::json!({"url": url})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadUrlInput {
    game_id: String,
}

async fn get_upload_url(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UploadUrlInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let storage_key = format!("{}/{}", game_id, Uuid::new_v4());

    let url = state
        .storage
        .get_upload_url(&storage_key, None, 3600)
        .await
        .map_err(|e| ApiError::internal(format!("S3 presigned URL failed: {}", e)))?;

    Ok(Json(serde_json::json!({
        "url": url,
        "storageKey": storage_key,
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameInput {
    game_id: String,
    name: String,
}

async fn rename(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<RenameInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;

    // Get current file
    let file: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT id, parent_id FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let (_, parent_id) = file.ok_or_else(|| ApiError::not_found("文件不存在"))?;

    // Check name conflict
    let conflict = check_name_conflict_exclude(&state, game_id, parent_id, &input.name, id).await?;
    if conflict {
        return Err(ApiError::bad_request(format!("名称 '{}' 已存在", input.name)));
    }

    sqlx::query("UPDATE files SET name = $1, updated_at = NOW() WHERE id = $2 AND game_id = $3")
        .bind(&input.name)
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(serde_json::json!({"id": id, "name": input.name})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveInput {
    game_id: String,
    parent_id: Option<String>,
}

async fn move_file(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<MoveInput>,
) -> ApiResult<Json<serde_json::Value>> {
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
        sqlx::query("UPDATE files SET parent_id = $1, updated_at = NOW() WHERE id = $2 AND game_id = $3")
            .bind(pid)
            .bind(id)
            .bind(game_id)
            .execute(&state.db.pool)
            .await?;
    } else {
        sqlx::query("UPDATE files SET parent_id = NULL, updated_at = NOW() WHERE id = $1 AND game_id = $2")
            .bind(id)
            .bind(game_id)
            .execute(&state.db.pool)
            .await?;
    }

    Ok(Json(serde_json::json!({"id": id})))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    // Soft delete: set deleted_at, cascade to children
    soft_delete_recursive(&state, game_id, id).await?;

    Ok(Json(serde_json::json!({"id": id})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchPrepareInput {
    game_id: String,
    files: Vec<BatchFileEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchFileEntry {
    name: String,
    parent_id: Option<String>,
    mime_type: Option<String>,
    size: Option<i64>,
}

async fn batch_prepare_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchPrepareInput>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
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

        results.push(serde_json::json!({
            "file": file_to_json(&row),
            "uploadUrl": presigned_url,
        }));
    }

    Ok(Json(results))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchConfirmInput {
    game_id: String,
    file_ids: Vec<String>,
}

async fn batch_confirm_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchConfirmInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let _game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    // Batch confirm — just acknowledge
    Ok(Json(serde_json::json!({
        "confirmed": input.file_ids.len(),
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EnsureFolderPathInput {
    game_id: String,
    path: String,
}

async fn ensure_folder_path(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<EnsureFolderPathInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let parts: Vec<&str> = input
        .path
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();

    let mut parent_id: Option<Uuid> = None;

    for part in &parts {
        // Try to find existing folder
        let existing: Option<(Uuid,)> = if let Some(pid) = parent_id {
            sqlx::query_as(
                "SELECT id FROM files WHERE game_id = $1 AND parent_id = $2 AND LOWER(name) = LOWER($3) AND type = 'folder' AND deleted_at IS NULL",
            )
            .bind(game_id)
            .bind(pid)
            .bind(part)
            .fetch_optional(&state.db.pool)
            .await?
        } else {
            sqlx::query_as(
                "SELECT id FROM files WHERE game_id = $1 AND parent_id IS NULL AND LOWER(name) = LOWER($2) AND type = 'folder' AND deleted_at IS NULL",
            )
            .bind(game_id)
            .bind(part)
            .fetch_optional(&state.db.pool)
            .await?
        };

        match existing {
            Some((id,)) => {
                parent_id = Some(id);
            }
            None => {
                // Create folder
                let new_folder: (Uuid,) = if let Some(pid) = parent_id {
                    sqlx::query_as(
                        "INSERT INTO files (game_id, name, type, parent_id) VALUES ($1, $2, 'folder', $3) RETURNING id",
                    )
                    .bind(game_id)
                    .bind(part)
                    .bind(pid)
                    .fetch_one(&state.db.pool)
                    .await?
                } else {
                    sqlx::query_as(
                        "INSERT INTO files (game_id, name, type, parent_id) VALUES ($1, $2, 'folder', NULL) RETURNING id",
                    )
                    .bind(game_id)
                    .bind(part)
                    .fetch_one(&state.db.pool)
                    .await?
                };
                parent_id = Some(new_folder.0);
            }
        }
    }

    Ok(Json(serde_json::json!({
        "folderId": parent_id,
        "path": input.path,
    })))
}

// ===== Public resource route: GET /game/:slug/resources/* =====

pub async fn serve_resource(
    State(state): State<AppState>,
    Path((game_slug, resource_path)): Path<(String, String)>,
) -> Result<Response, ApiError> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;

    let parts: Vec<&str> = resource_path
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();

    if parts.is_empty() {
        return Err(ApiError::not_found("空路径"));
    }

    // Path traversal protection
    if parts.iter().any(|p| *p == ".." || *p == ".") {
        return Err(ApiError::bad_request("非法路径"));
    }

    // Resolve entire path in a single recursive CTE query (instead of N+1 queries)
    let segments: Vec<String> = parts.iter().map(|s| s.to_string()).collect();
    let row: Option<(Uuid, String, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"
        WITH RECURSIVE
          segments AS (
            SELECT seg, idx::bigint AS idx, count(*) OVER() AS total
            FROM unnest($2::text[]) WITH ORDINALITY AS t(seg, idx)
          ),
          path_walk AS (
            SELECT f.id, f.name, f.type AS file_type, f.storage_key, f.mime_type, s.idx AS depth, s.total
            FROM files f
            JOIN segments s ON s.idx = 1 AND LOWER(f.name) = LOWER(s.seg)
            WHERE f.game_id = $1 AND f.parent_id IS NULL AND f.deleted_at IS NULL

            UNION ALL

            SELECT f.id, f.name, f.type, f.storage_key, f.mime_type, s.idx, pw.total
            FROM files f
            JOIN path_walk pw ON f.parent_id = pw.id
            JOIN segments s ON s.idx = pw.depth + 1 AND LOWER(f.name) = LOWER(s.seg)
            WHERE f.game_id = $1 AND f.deleted_at IS NULL
          )
        SELECT id, name, file_type, storage_key, mime_type
        FROM path_walk
        WHERE depth = total
        LIMIT 1
        "#,
    )
    .bind(game_id)
    .bind(&segments)
    .fetch_optional(&state.db.pool)
    .await?;

    let (_, _, file_type, storage_key, mime_type) =
        row.ok_or_else(|| ApiError::not_found(format!("未找到: {}", resource_path)))?;

    if file_type == "folder" {
        return Err(ApiError::bad_request("不能直接访问文件夹"));
    }

    let storage_key =
        storage_key.ok_or_else(|| ApiError::not_found("文件没有存储信息"))?;

    // Stream from S3
    let (byte_stream, s3_content_type, content_length) = state
        .storage
        .get_file_stream(&storage_key)
        .await
        .map_err(|e| ApiError::internal(format!("S3 get failed: {}", e)))?;

    let content_type = mime_type
        .or(s3_content_type)
        .unwrap_or_else(|| guess_mime_type(&resource_path));

    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400");

    if let Some(len) = content_length {
        builder = builder.header(header::CONTENT_LENGTH, len);
    }

    let reader = byte_stream.into_async_read();
    let stream = ReaderStream::new(reader);

    Ok(builder
        .body(Body::from_stream(stream))
        .unwrap())
}

// ===== Internal helpers =====

fn file_to_json(f: &FileRow) -> serde_json::Value {
    serde_json::json!({
        "id": f.id,
        "name": f.name,
        "isFolder": f.file_type == "folder",
        "parentId": f.parent_id,
        "storageKey": f.storage_key,
        "size": f.size,
        "mimeType": f.mime_type,
        "createdAt": f.created_at.map(|d| d.to_rfc3339()),
        "updatedAt": f.updated_at.map(|d| d.to_rfc3339()),
    })
}

fn parse_optional_uuid(s: &Option<String>) -> Result<Option<Uuid>, ApiError> {
    match s {
        Some(v) if !v.is_empty() && v != "null" => {
            Uuid::parse_str(v).map(Some).map_err(|_| ApiError::bad_request("Invalid UUID"))
        }
        _ => Ok(None),
    }
}

async fn check_name_conflict(
    state: &AppState,
    game_id: Uuid,
    parent_id: Option<Uuid>,
    name: &str,
) -> Result<bool, ApiError> {
    let row: Option<(i64,)> = if let Some(pid) = parent_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM files WHERE game_id = $1 AND parent_id = $2 AND LOWER(name) = LOWER($3) AND deleted_at IS NULL",
        )
        .bind(game_id)
        .bind(pid)
        .bind(name)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT COUNT(*) FROM files WHERE game_id = $1 AND parent_id IS NULL AND LOWER(name) = LOWER($2) AND deleted_at IS NULL",
        )
        .bind(game_id)
        .bind(name)
        .fetch_optional(&state.db.pool)
        .await?
    };
    Ok(row.map(|(c,)| c > 0).unwrap_or(false))
}

async fn check_name_conflict_exclude(
    state: &AppState,
    game_id: Uuid,
    parent_id: Option<Uuid>,
    name: &str,
    exclude_id: Uuid,
) -> Result<bool, ApiError> {
    let row: Option<(i64,)> = if let Some(pid) = parent_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM files WHERE game_id = $1 AND parent_id = $2 AND LOWER(name) = LOWER($3) AND id != $4 AND deleted_at IS NULL",
        )
        .bind(game_id)
        .bind(pid)
        .bind(name)
        .bind(exclude_id)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT COUNT(*) FROM files WHERE game_id = $1 AND parent_id IS NULL AND LOWER(name) = LOWER($2) AND id != $3 AND deleted_at IS NULL",
        )
        .bind(game_id)
        .bind(name)
        .bind(exclude_id)
        .fetch_optional(&state.db.pool)
        .await?
    };
    Ok(row.map(|(c,)| c > 0).unwrap_or(false))
}

/// Check if `potential_ancestor` is an ancestor of `target`, used to prevent circular moves.
/// Uses a recursive CTE (single query instead of N+1).
async fn is_descendant(
    state: &AppState,
    game_id: Uuid,
    target: Uuid,
    potential_ancestor: Uuid,
) -> Result<bool, ApiError> {
    if target == potential_ancestor {
        return Ok(true);
    }
    let result: bool = sqlx::query_scalar(
        r#"
        WITH RECURSIVE ancestors AS (
            SELECT parent_id FROM files WHERE id = $1 AND game_id = $3 AND deleted_at IS NULL
            UNION ALL
            SELECT f.parent_id FROM files f JOIN ancestors a ON f.id = a.parent_id
            WHERE f.game_id = $3 AND f.deleted_at IS NULL
        )
        SELECT EXISTS(SELECT 1 FROM ancestors WHERE parent_id = $2)
        "#,
    )
    .bind(target)
    .bind(potential_ancestor)
    .bind(game_id)
    .fetch_one(&state.db.pool)
    .await?;
    Ok(result)
}

/// Soft delete a file/folder and all descendants using a single recursive CTE.
async fn soft_delete_recursive(
    state: &AppState,
    game_id: Uuid,
    file_id: Uuid,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        WITH RECURSIVE descendants AS (
            SELECT id FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL
            UNION ALL
            SELECT f.id FROM files f JOIN descendants d ON f.parent_id = d.id
            WHERE f.game_id = $2 AND f.deleted_at IS NULL
        )
        UPDATE files SET deleted_at = NOW()
        WHERE id IN (SELECT id FROM descendants)
        "#,
    )
    .bind(file_id)
    .bind(game_id)
    .execute(&state.db.pool)
    .await?;
    Ok(())
}

fn guess_mime_type(path: &str) -> String {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".json") {
        "application/json"
    } else if lower.ends_with(".js") || lower.ends_with(".mjs") {
        "application/javascript"
    } else if lower.ends_with(".css") {
        "text/css"
    } else if lower.ends_with(".html") {
        "text/html"
    } else if lower.ends_with(".txt") || lower.ends_with(".ini") || lower.ends_with(".npc") || lower.ends_with(".obj") {
        "text/plain"
    } else if lower.ends_with(".ogg") {
        "audio/ogg"
    } else if lower.ends_with(".mp3") {
        "audio/mpeg"
    } else if lower.ends_with(".wav") {
        "audio/wav"
    } else if lower.ends_with(".map") || lower.ends_with(".asf") || lower.ends_with(".mpc") || lower.ends_with(".shd") {
        "application/octet-stream"
    } else {
        "application/octet-stream"
    }
    .to_string()
}
