use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::ApiError;
pub use crate::utils::fmt_ts;

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

/// Typed output for file/folder entries.
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

/// Response for prepare_upload / batch_prepare_upload.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareUploadOutput {
    pub file: FileOutput,
    pub upload_url: String,
}

/// Response for confirm_upload.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmUploadOutput {
    pub confirmed: bool,
    pub file_id: Uuid,
}

/// Response for get_download_url.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadUrlOutput {
    pub url: String,
}

/// Response for get_upload_url.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadUrlOutput {
    pub url: String,
    pub storage_key: String,
}

/// Response for rename.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameOutput {
    pub id: Uuid,
    pub name: String,
}

/// Response for batch_confirm_upload.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConfirmOutput {
    pub confirmed: usize,
}

/// Response for ensure_folder_path.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureFolderPathOutput {
    pub folder_id: Option<Uuid>,
    pub path: String,
}

pub fn parse_optional_uuid(s: &Option<String>) -> Result<Option<Uuid>, ApiError> {
    match s {
        Some(v) if !v.is_empty() && v != "null" => Uuid::parse_str(v)
            .map(Some)
            .map_err(|_| ApiError::bad_request("Invalid UUID")),
        _ => Ok(None),
    }
}

pub async fn check_name_conflict(
    state: &crate::state::AppState,
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
    .fetch_one(&state.db.pool)
    .await?;
    Ok(exists)
}

pub async fn check_name_conflict_exclude(
    state: &crate::state::AppState,
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
    .fetch_one(&state.db.pool)
    .await?;
    Ok(exists)
}

/// Check if `potential_ancestor` is an ancestor of `target`, used to prevent circular moves.
pub async fn is_descendant(
    state: &crate::state::AppState,
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
pub async fn soft_delete_recursive(
    state: &crate::state::AppState,
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

/// Input DTO types used by file handlers
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
