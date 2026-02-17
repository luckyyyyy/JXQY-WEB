//! NPC routes: thin HTTP handlers delegating to services::npc.

use axum::extract::{Path, Query, State};
use axum::Json;
use uuid::Uuid;

use crate::error::ApiResult;
use crate::modules::crud::{BatchImportInput, DeleteResult, GameQuery, UpdateEntityInput, verify_game_access};
use crate::modules::middleware::AuthUser;
use super::service as npc_svc;
use crate::state::AppState;

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<npc_svc::ListNpcQuery>,
) -> ApiResult<Json<Vec<npc_svc::NpcListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(npc_svc::list(&state.db.pool, game_id, q.kind.as_deref(), q.relation.as_deref()).await?))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<npc_svc::NpcOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    npc_svc::get(&state.db.pool, game_id, id).await
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<npc_svc::CreateNpcInput>,
) -> ApiResult<Json<npc_svc::NpcOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(npc_svc::create(&state.db.pool, game_id, &input).await?))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityInput>,
) -> ApiResult<Json<npc_svc::NpcOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(npc_svc::update(&state.db.pool, game_id, id, &input.data).await?))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let id = npc_svc::delete(&state.db.pool, game_id, id).await?;
    Ok(Json(DeleteResult { id }))
}

pub async fn batch_import(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchImportInput>,
) -> ApiResult<Json<crate::modules::crud::BatchImportResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(npc_svc::batch_import(&state.db.pool, game_id, &input.items).await?))
}

/// Public: list all NPCs for a game slug (no auth).
pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<npc_svc::NpcOutput>>> {
    npc_svc::list_public(&state, &game_slug).await
}

/// Public: list all NPC resources for a game slug (no auth).
pub async fn list_npc_resources_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<npc_svc::NpcResOutput>>> {
    npc_svc::list_resources_public(&state, &game_slug).await
}
