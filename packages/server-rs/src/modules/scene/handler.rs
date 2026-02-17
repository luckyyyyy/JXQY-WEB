//! Scene routes: thin HTTP handlers delegating to services::scene.

use axum::extract::{Path, Query, State};
use axum::{Json, Router};

use crate::error::ApiResult;
use crate::modules::crud::{DeleteResult, GameQuery, resolve_game_id_by_slug, verify_game_access};
use crate::modules::middleware::AuthUser;
use super::service as scene_svc;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/import", axum::routing::post(import_scene))
        .route("/clear-all", axum::routing::post(clear_all))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<scene_svc::SceneListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(scene_svc::list(&state.db.pool, game_id).await?))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<uuid::Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<scene_svc::SceneOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    Ok(Json(scene_svc::get(&state.db.pool, game_id, id).await?))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<scene_svc::CreateSceneInput>,
) -> ApiResult<Json<scene_svc::SceneOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(scene_svc::create(&state.db.pool, game_id, &input).await?))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<uuid::Uuid>,
    Json(input): Json<scene_svc::CreateSceneInput>,
) -> ApiResult<Json<scene_svc::SceneOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(scene_svc::update(&state.db.pool, game_id, id, &input).await?))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<uuid::Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let id = scene_svc::delete(&state.db.pool, game_id, id).await?;
    Ok(Json(DeleteResult { id }))
}

async fn import_scene(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<scene_svc::ImportSceneBatchInput>,
) -> ApiResult<Json<Vec<scene_svc::ImportResultEntry>>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(scene_svc::import(&state.db.pool, game_id, &input.scenes).await?))
}

async fn clear_all(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<scene_svc::ClearAllInput>,
) -> ApiResult<Json<scene_svc::ClearAllResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    Ok(Json(scene_svc::clear_all(&state.db.pool, game_id).await?))
}

// ===== Public routes (no auth) =====

/// GET /game/:gameSlug/api/scene/:sceneKey/mmf — returns raw MMF binary
pub async fn get_mmf_binary(
    State(state): State<AppState>,
    Path((game_slug, scene_key)): Path<(String, String)>,
) -> ApiResult<axum::response::Response> {
    use axum::body::Body;
    use axum::http::{StatusCode, header};

    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let bytes = scene_svc::get_mmf_bytes(&state.db.pool, game_id, &scene_key).await?;

    axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, bytes.len())
        .header(header::CACHE_CONTROL, "public, max-age=3600")
        .body(Body::from(bytes))
        .map_err(|e| crate::error::ApiError::internal(format!("Failed to build response: {e}")))
}

/// GET /game/:gameSlug/api/scene/:sceneKey/npc/:npcKey
pub async fn get_npc_entries(
    State(state): State<AppState>,
    Path((game_slug, scene_key, npc_key)): Path<(String, String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    Ok(Json(scene_svc::get_item_entries(&state.db.pool, game_id, &scene_key, "npc", &npc_key).await?))
}

/// GET /game/:gameSlug/api/scene/:sceneKey/obj/:objKey
pub async fn get_obj_entries(
    State(state): State<AppState>,
    Path((game_slug, scene_key, obj_key)): Path<(String, String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    Ok(Json(scene_svc::get_item_entries(&state.db.pool, game_id, &scene_key, "obj", &obj_key).await?))
}
