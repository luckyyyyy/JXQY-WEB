//! File service: business logic for file/folder management + S3 interactions.
//! Types, DB helpers, and all CRUD operations.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::utils::{fmt_ts, validate_str};

// ── Types ─────────────────────────────────────────

#[derive(sqlx::FromRow)]
pub struct FileRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub name: String,
    #[sqlx(rename = "type")]
    pub file_type: String,
    pub parent_id: Option<Uuid>,
    pub storage_key: Option<String>,
    pub size: Option<i64>,
    pub mime_type: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
    #[allow(dead_code)]
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub parent_id: Option<Uuid>,
    pub path: String,
    pub storage_key: Option<String>,
    pub size: Option<String>,
    pub mime_type: Option<String>,
    pub checksum: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&FileRow> for FileOutput {
    fn from(f: &FileRow) -> Self {
        Self {
            id: f.id,
            game_id: f.game_id,
            name: f.name.clone(),
            file_type: f.file_type.clone(),
            parent_id: f.parent_id,
            path: String::new(),
            storage_key: f.storage_key.clone(),
            size: f.size.map(|s| s.to_string()),
            mime_type: f.mime_type.clone(),
            checksum: None,
            created_at: fmt_ts(f.created_at),
            updated_at: fmt_ts(f.updated_at),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareUploadOutput {
    pub file: FileOutput,
    pub upload_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmUploadOutput {
    pub confirmed: bool,
    pub file_id: Uuid,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadUrlOutput {
    pub url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadUrlOutput {
    pub url: String,
    pub storage_key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameOutput {
    pub id: Uuid,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConfirmOutput {
    pub confirmed: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureFolderPathOutput {
    pub folder_id: Option<Uuid>,
    pub path: String,
}

// ── Input types ───────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub game_id: String,
    pub parent_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderInput {
    pub game_id: String,
    pub name: String,
    pub parent_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareUploadInput {
    pub game_id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub mime_type: Option<String>,
    pub size: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmUploadInput {
    pub game_id: String,
    pub file_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadUrlInput {
    pub game_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameInput {
    pub game_id: String,
    pub name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveInput {
    pub game_id: String,
    pub parent_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchPrepareInput {
    pub game_id: String,
    pub files: Vec<BatchFileEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFileEntry {
    pub name: String,
    pub parent_id: Option<String>,
    pub mime_type: Option<String>,
    pub size: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConfirmInput {
    pub game_id: String,
    pub file_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureFolderPathInput {
    pub game_id: String,
    pub path: String,
}

// ── Helper functions ──────────────────────────────

pub fn parse_optional_uuid(s: &Option<String>) -> Result<Option<Uuid>, ApiError> {
    match s {
        Some(v) if !v.is_empty() && v != "null" => Uuid::parse_str(v)
            .map(Some)
            .map_err(|_| ApiError::bad_request("Invalid UUID")),
        _ => Ok(None),
    }
}

pub async fn check_name_conflict(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    parent_id: Option<Uuid>,
    name: &str,
) -> Result<bool, ApiError> {
    let (exists,): (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM files WHERE game_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND LOWER(name) = LOWER($3) AND deleted_at IS NULL)",
    )
    .bind(game_id)
    .bind(parent_id)
    .bind(name)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

pub async fn check_name_conflict_exclude(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    parent_id: Option<Uuid>,
    name: &str,
    exclude_id: Uuid,
) -> Result<bool, ApiError> {
    let (exists,): (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM files WHERE game_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND LOWER(name) = LOWER($3) AND id != $4 AND deleted_at IS NULL)",
    )
    .bind(game_id)
    .bind(parent_id)
    .bind(name)
    .bind(exclude_id)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

pub async fn is_descendant(
    pool: &sqlx::PgPool,
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
    .fetch_one(pool)
    .await?;
    Ok(result)
}

pub async fn soft_delete_recursive(
    pool: &sqlx::PgPool,
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
    .execute(pool)
    .await?;
    Ok(())
}

pub fn guess_mime_type(path: &str) -> String {
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
    } else if lower.ends_with(".txt")
        || lower.ends_with(".ini")
        || lower.ends_with(".npc")
        || lower.ends_with(".obj")
    {
        "text/plain"
    } else if lower.ends_with(".ogg") {
        "audio/ogg"
    } else if lower.ends_with(".mp3") {
        "audio/mpeg"
    } else if lower.ends_with(".wav") {
        "audio/wav"
    } else if lower.ends_with(".map")
        || lower.ends_with(".asf")
        || lower.ends_with(".mpc")
        || lower.ends_with(".shd")
    {
        "application/octet-stream"
    } else {
        "application/octet-stream"
    }
    .to_string()
}

// ── Service functions ─────────────────────────────

pub async fn list(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    parent_id: Option<Uuid>,
) -> ApiResult<Vec<FileOutput>> {
    let rows = if let Some(pid) = parent_id {
        sqlx::query_as::<_, FileRow>(
            "SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at \
             FROM files WHERE game_id = $1 AND parent_id = $2 AND deleted_at IS NULL ORDER BY type DESC, name ASC",
        )
        .bind(game_id)
        .bind(pid)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, FileRow>(
            "SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at \
             FROM files WHERE game_id = $1 AND parent_id IS NULL AND deleted_at IS NULL ORDER BY type DESC, name ASC",
        )
        .bind(game_id)
        .fetch_all(pool)
        .await?
    };

    Ok(rows.iter().map(FileOutput::from).collect())
}

pub async fn get(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<FileOutput> {
    let row = sqlx::query_as::<_, FileRow>(
        "SELECT id, game_id, name, type, parent_id, storage_key, size, mime_type, created_at, updated_at, deleted_at \
         FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(f) => Ok(FileOutput::from(&f)),
        None => Err(ApiError::not_found("文件不存在")),
    }
}

pub async fn get_path(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<Vec<FileOutput>> {
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
    .fetch_all(pool)
    .await?;

    // CTE returns leaf→root order, reverse to root→leaf
    let mut path: Vec<FileOutput> = rows.iter().map(FileOutput::from).collect();
    path.reverse();
    Ok(path)
}

pub async fn create_folder(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    name: &str,
    parent_id: Option<Uuid>,
) -> ApiResult<FileOutput> {
    let name = validate_str(name, "文件夹名称", 255)?;

    let conflict = check_name_conflict(pool, game_id, parent_id, &name).await?;
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
    .fetch_one(pool)
    .await?;

    Ok(FileOutput::from(&row))
}

pub async fn prepare_upload(
    state: &crate::state::AppState,
    game_id: Uuid,
    input: &PrepareUploadInput,
) -> ApiResult<PrepareUploadOutput> {
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

    Ok(PrepareUploadOutput {
        file: FileOutput::from(&row),
        upload_url: presigned_url,
    })
}

pub async fn confirm_upload(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    file_id: Uuid,
) -> ApiResult<ConfirmUploadOutput> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL AND storage_key IS NOT NULL)",
    )
    .bind(file_id)
    .bind(game_id)
    .fetch_one(pool)
    .await?;

    if !exists {
        return Err(ApiError::not_found("文件不存在或没有存储信息"));
    }

    Ok(ConfirmUploadOutput {
        confirmed: true,
        file_id,
    })
}

pub async fn get_download_url(
    state: &crate::state::AppState,
    game_id: Uuid,
    id: Uuid,
) -> ApiResult<DownloadUrlOutput> {
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

    Ok(DownloadUrlOutput { url })
}

pub async fn get_upload_url(
    state: &crate::state::AppState,
    game_id: Uuid,
) -> ApiResult<UploadUrlOutput> {
    let storage_key = format!("{}/{}", game_id, Uuid::new_v4());

    let url = state
        .storage
        .get_upload_url(&storage_key, None, 3600)
        .await
        .map_err(|e| ApiError::internal(format!("S3 presigned URL failed: {}", e)))?;

    Ok(UploadUrlOutput { url, storage_key })
}

pub async fn rename(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    new_name: &str,
) -> ApiResult<RenameOutput> {
    let name = validate_str(new_name, "文件名", 255)?;

    let parent_id: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT parent_id FROM files WHERE id = $1 AND game_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    let parent_id = parent_id.ok_or_else(|| ApiError::not_found("文件不存在"))?;

    let conflict = check_name_conflict_exclude(pool, game_id, parent_id, &name, id).await?;
    if conflict {
        return Err(ApiError::bad_request(format!("名称 '{}' 已存在", name)));
    }

    sqlx::query("UPDATE files SET name = $1, updated_at = NOW() WHERE id = $2 AND game_id = $3")
        .bind(&name)
        .bind(id)
        .bind(game_id)
        .execute(pool)
        .await?;

    Ok(RenameOutput { id, name })
}

pub async fn move_file(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    new_parent_id: Option<Uuid>,
) -> ApiResult<Uuid> {
    // Prevent moving into itself or its descendants
    if let Some(target) = new_parent_id {
        if target == id {
            return Err(ApiError::bad_request("不能将文件夹移动到自身内部"));
        }
        if is_descendant(pool, game_id, target, id).await? {
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
        .execute(pool)
        .await?;
    } else {
        sqlx::query(
            "UPDATE files SET parent_id = NULL, updated_at = NOW() WHERE id = $1 AND game_id = $2",
        )
        .bind(id)
        .bind(game_id)
        .execute(pool)
        .await?;
    }

    Ok(id)
}

pub async fn delete(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<Uuid> {
    soft_delete_recursive(pool, game_id, id).await?;
    Ok(id)
}

pub async fn batch_prepare_upload(
    state: &crate::state::AppState,
    game_id: Uuid,
    files: &[BatchFileEntry],
) -> ApiResult<Vec<PrepareUploadOutput>> {
    let mut results = Vec::new();

    for file in files {
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

    Ok(results)
}

pub async fn batch_confirm_upload(file_count: usize) -> ApiResult<BatchConfirmOutput> {
    Ok(BatchConfirmOutput {
        confirmed: file_count,
    })
}

pub async fn ensure_folder_path(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    path: &str,
) -> ApiResult<EnsureFolderPathOutput> {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let mut parent_id: Option<Uuid> = None;

    for part in &parts {
        let existing: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM files WHERE game_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND LOWER(name) = LOWER($3) AND type = 'folder' AND deleted_at IS NULL",
        )
        .bind(game_id)
        .bind(parent_id)
        .bind(part)
        .fetch_optional(pool)
        .await?;

        match existing {
            Some(id) => {
                parent_id = Some(id);
            }
            None => {
                let new_id: Uuid = sqlx::query_scalar(
                    "INSERT INTO files (game_id, name, type, parent_id) VALUES ($1, $2, 'folder', $3) RETURNING id",
                )
                .bind(game_id)
                .bind(part)
                .bind(parent_id)
                .fetch_one(pool)
                .await?;
                parent_id = Some(new_id);
            }
        }
    }

    Ok(EnsureFolderPathOutput {
        folder_id: parent_id,
        path: path.to_string(),
    })
}
