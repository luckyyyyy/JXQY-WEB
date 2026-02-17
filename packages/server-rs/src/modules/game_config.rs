use std::sync::LazyLock;

use axum::extract::{Query, State};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::ApiResult;
use crate::modules::crud::{verify_game_access, resolve_game_id_by_slug, GameQuery};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;

/// GameConfig is a singleton per game with auto-created defaults.

static DEFAULT_CONFIG: LazyLock<serde_json::Value> = LazyLock::new(|| {
    serde_json::from_str(r#"{
        "gameEnabled": false,
        "player": {},
        "drop": {},
        "magicExp": {}
    }"#).expect("valid default config JSON")
});

/// DB row for game_configs table
#[derive(sqlx::FromRow)]
struct GameConfigRow {
    id: Uuid,
    game_id: Uuid,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Typed output for game config.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfigOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub data: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<GameConfigRow> for GameConfigOutput {
    fn from(r: GameConfigRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            data: merge_with_defaults(r.data),
            created_at: crate::utils::fmt_ts(r.created_at),
            updated_at: crate::utils::fmt_ts(r.updated_at),
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(get).put(update))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<GameConfigOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row: Option<GameConfigRow> = sqlx::query_as(
        "SELECT id, game_id, data, created_at, updated_at FROM game_configs WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some(row) => Ok(Json(GameConfigOutput::from(row))),
        None => {
            // Auto-create with defaults
            let new_row: GameConfigRow = sqlx::query_as(
                "INSERT INTO game_configs (game_id, data) VALUES ($1, $2) \
                 ON CONFLICT (game_id) DO UPDATE SET data = game_configs.data \
                 RETURNING id, game_id, data, created_at, updated_at",
            )
            .bind(game_id)
            .bind(&*DEFAULT_CONFIG)
            .fetch_one(&state.db.pool)
            .await?;
            Ok(Json(GameConfigOutput::from(new_row)))
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateConfigInput {
    game_id: String,
    data: serde_json::Value,
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpdateConfigInput>,
) -> ApiResult<Json<GameConfigOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;

    let row: GameConfigRow = sqlx::query_as(
        "INSERT INTO game_configs (game_id, data) VALUES ($1, $2) \
         ON CONFLICT (game_id) DO UPDATE SET data = $2, updated_at = NOW() \
         RETURNING id, game_id, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(GameConfigOutput::from(row)))
}

// ===== Public routes =====

pub async fn get_public_by_slug(
    State(state): State<AppState>,
    axum::extract::Path(game_slug): axum::extract::Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let data: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT data FROM game_configs WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match data {
        Some(data) => {
            let game_enabled = data
                .get("gameEnabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            if !game_enabled {
                return Ok(Json(serde_json::json!({"gameEnabled": false})));
            }

            // Conditionally include player/drop/magicExp only if gameEnabled
            let mut config = merge_with_defaults(data);
            // The config is fully returned when gameEnabled=true
            config["gameEnabled"] = serde_json::Value::Bool(true);
            Ok(Json(config))
        }
        None => Ok(Json(serde_json::json!({"gameEnabled": false}))),
    }
}

fn merge_with_defaults(mut data: serde_json::Value) -> serde_json::Value {
    if let (Some(data_obj), Some(defaults_obj)) = (data.as_object_mut(), DEFAULT_CONFIG.as_object()) {
        for (key, default_val) in defaults_obj {
            if !data_obj.contains_key(key) {
                data_obj.insert(key.clone(), default_val.clone());
            }
        }
    }
    data
}
