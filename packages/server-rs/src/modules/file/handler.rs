//! File routes: thin HTTP handlers delegating to services::file.

use axum::Json;
use axum::extract::{Path, Query, State};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{DeleteResult, GameQuery, verify_game_access};
use crate::modules::middleware::AuthUser;
use super::service as file_svc;
use crate::state::AppState;

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<file_svc::ListQuery>,
) -> ApiResult<Json<Vec<file_svc::FileOutput>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let parent_id = match &q.parent_id {
        Some(pid) if !pid.is_empty() && pid != "null" => {
            Some(Uuid::parse_str(pid).map_err(|_| ApiError::bad_request("Invalid parent_id"))?)
        }
        _ => None,
    };
    Ok(Json(file_svc::list(&state.db.pool, game_id, parent_id).await?))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<file_svc::FileOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(file_svc::get(&state.db.pool, game_id, id).await?))
}

pub async fn get_path(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<file_svc::FileOutput>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(file_svc::get_path(&state.db.pool, game_id, id).await?))
}

pub async fn create_folder(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<file_svc::CreateFolderInput>,
) -> ApiResult<Json<file_svc::FileOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let parent_id = file_svc::parse_optional_uuid(&input.parent_id)?;
    Ok(Json(file_svc::create_folder(&state.db.pool, game_id, &input.name, parent_id).await?))
}

pub async fn prepare_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<file_svc::PrepareUploadInput>,
) -> ApiResult<Json<file_svc::PrepareUploadOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(file_svc::prepare_upload(&state, game_id, &input).await?))
}

pub async fn confirm_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<file_svc::ConfirmUploadInput>,
) -> ApiResult<Json<file_svc::ConfirmUploadOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let file_id = Uuid::parse_str(&input.file_id)
        .map_err(|_| ApiError::bad_request("Invalid file_id"))?;
    Ok(Json(file_svc::confirm_upload(&state.db.pool, game_id, file_id).await?))
}

pub async fn get_download_url(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<file_svc::DownloadUrlOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(file_svc::get_download_url(&state, game_id, id).await?))
}

pub async fn get_upload_url(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<file_svc::UploadUrlInput>,
) -> ApiResult<Json<file_svc::UploadUrlOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(file_svc::get_upload_url(&state, game_id).await?))
}

pub async fn rename(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<file_svc::RenameInput>,
) -> ApiResult<Json<file_svc::RenameOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(file_svc::rename(&state.db.pool, game_id, id, &input.name).await?))
}

pub async fn move_file(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<file_svc::MoveInput>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let new_parent_id = file_svc::parse_optional_uuid(&input.parent_id)?;
    let id = file_svc::move_file(&state.db.pool, game_id, id, new_parent_id).await?;
    Ok(Json(DeleteResult { id }))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let id = file_svc::delete(&state.db.pool, game_id, id).await?;
    Ok(Json(DeleteResult { id }))
}

pub async fn batch_prepare_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<file_svc::BatchPrepareInput>,
) -> ApiResult<Json<Vec<file_svc::PrepareUploadOutput>>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(file_svc::batch_prepare_upload(&state, game_id, &input.files).await?))
}

pub async fn batch_confirm_upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<file_svc::BatchConfirmInput>,
) -> ApiResult<Json<file_svc::BatchConfirmOutput>> {
    let _game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(file_svc::batch_confirm_upload(input.file_ids.len()).await?))
}

pub async fn ensure_folder_path(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<file_svc::EnsureFolderPathInput>,
) -> ApiResult<Json<file_svc::EnsureFolderPathOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(file_svc::ensure_folder_path(&state.db.pool, game_id, &input.path).await?))
}
