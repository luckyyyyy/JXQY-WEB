use axum::extract::{Query, State};
use axum::{Json, Router};
use serde::Deserialize;

use crate::error::ApiResult;
use crate::modules::crud::{verify_game_access, resolve_game_id_by_slug, SuccessResult, GameQuery};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::validate_batch_items;

/// TalkPortrait is a singleton per game: one row in talk_portraits, data = PortraitEntry[].

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(get).put(update))
        .route("/import", axum::routing::post(import_from_ini))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let data: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT data FROM talk_portraits WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    Ok(Json(data.unwrap_or(serde_json::json!([]))))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInput {
    game_id: String,
    entries: Vec<serde_json::Value>,
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpdateInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    validate_batch_items(&input.entries)?;
    let mut entries = input.entries;
    // Sort by idx
    entries.sort_by(|a, b| {
        let a_idx = a.get("idx").and_then(|v| v.as_i64()).unwrap_or(0);
        let b_idx = b.get("idx").and_then(|v| v.as_i64()).unwrap_or(0);
        a_idx.cmp(&b_idx)
    });
    let data = serde_json::Value::Array(entries);

    sqlx::query(
        "INSERT INTO talk_portraits (game_id, data) VALUES ($1, $2) \
         ON CONFLICT (game_id) DO UPDATE SET data = $2, updated_at = NOW()",
    )
    .bind(game_id)
    .bind(&data)
    .execute(&state.db.pool)
    .await?;

    Ok(Json(data))
}

async fn import_from_ini(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpdateInput>,
) -> ApiResult<Json<SuccessResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    validate_batch_items(&input.entries)?;
    let mut entries = input.entries;
    entries.sort_by(|a, b| {
        let a_idx = a.get("idx").and_then(|v| v.as_i64()).unwrap_or(0);
        let b_idx = b.get("idx").and_then(|v| v.as_i64()).unwrap_or(0);
        a_idx.cmp(&b_idx)
    });
    let data = serde_json::Value::Array(entries);

    sqlx::query(
        "INSERT INTO talk_portraits (game_id, data) VALUES ($1, $2) \
         ON CONFLICT (game_id) DO UPDATE SET data = $2, updated_at = NOW()",
    )
    .bind(game_id)
    .bind(&data)
    .execute(&state.db.pool)
    .await?;

    Ok(Json(SuccessResult { success: true }))
}

// ===== Public routes =====

pub async fn list_public_by_slug(
    State(state): State<AppState>,
    axum::extract::Path(game_slug): axum::extract::Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let data: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT data FROM talk_portraits WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    Ok(Json(data.unwrap_or(serde_json::json!([]))))
}
