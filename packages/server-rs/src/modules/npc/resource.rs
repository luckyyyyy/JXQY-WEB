//! NPC Resource routes: thin HTTP handlers delegating to services::npc.

use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use uuid::Uuid;

use crate::error::ApiResult;
use crate::modules::crud::{CreateEntityInput, DeleteResult, GameQuery, UpdateEntityInput, verify_game_access};
use crate::modules::middleware::AuthUser;
use super::service as npc_svc;
use crate::state::AppState;

// Re-export for use by data.rs and other modules
pub use npc_svc::{NpcResOutput, NpcResRow, upsert_npc_resource};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<npc_svc::NpcResOutput>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(npc_svc::list_resources(&state.db.pool, game_id).await?))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<npc_svc::NpcResOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(npc_svc::get_resource(&state.db.pool, game_id, id).await?))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateEntityInput>,
) -> ApiResult<Json<npc_svc::NpcResOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(npc_svc::create_resource(&state.db.pool, game_id, &input.key, &input.data).await?))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityInput>,
) -> ApiResult<Json<npc_svc::NpcResOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(npc_svc::update_resource(&state.db.pool, game_id, id, &input.data).await?))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let id = npc_svc::delete_resource(&state.db.pool, game_id, id).await?;
    Ok(Json(DeleteResult { id }))
}
