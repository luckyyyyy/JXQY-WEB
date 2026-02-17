//! Data route: thin HTTP handler delegating to services::data.

use axum::Json;
use axum::extract::{Path, State};

use crate::error::ApiResult;
use crate::modules::crud::resolve_game_id_by_slug;
use super::service as data_svc;
use crate::state::AppState;

/// Aggregation endpoint — builds full game data for the engine runtime.
/// GET /game/:gameSlug/api/data
pub async fn build_game_data(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    Ok(Json(data_svc::build_game_data(&state.db.pool, game_id).await?))
}
