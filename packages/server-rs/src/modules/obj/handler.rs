//! OBJ routes: thin HTTP handlers delegating to services::obj.

use axum::extract::{Path, Query, State};
use axum::Json;
use uuid::Uuid;

use crate::error::ApiResult;
use crate::modules::crud::{BatchImportInput, DeleteResult, GameQuery, UpdateEntityInput, verify_game_access};
use crate::modules::middleware::AuthUser;
use super::service as obj_svc;
use crate::state::AppState;

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<obj_svc::ListObjQuery>,
) -> ApiResult<Json<Vec<obj_svc::ObjListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(obj_svc::list(&state.db.pool, game_id, q.kind.as_deref()).await?))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<obj_svc::ObjOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    obj_svc::get(&state.db.pool, game_id, id).await
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<obj_svc::CreateObjInput>,
) -> ApiResult<Json<obj_svc::ObjOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(obj_svc::create(&state.db.pool, game_id, &input).await?))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityInput>,
) -> ApiResult<Json<obj_svc::ObjOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(obj_svc::update(&state.db.pool, game_id, id, &input.data).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let id = obj_svc::delete(&state.db.pool, game_id, id).await?;
    Ok(Json(DeleteResult { id }))
}

pub async fn batch_import(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchImportInput>,
) -> ApiResult<Json<crate::modules::crud::BatchImportResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(obj_svc::batch_import(&state.db.pool, game_id, &input.items).await?))
}

/// Public: list all OBJs for a game slug (no auth).
pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<obj_svc::ObjOutput>>> {
    obj_svc::list_public(&state, &game_slug).await
}

/// Public: list all OBJ resources for a game slug (no auth).
pub async fn list_obj_resources_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<obj_svc::ObjResOutput>>> {
    obj_svc::list_resources_public(&state, &game_slug).await
}
