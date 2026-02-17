use axum::extract::{Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::ApiResult;
use crate::routes::crud::{verify_game_access, resolve_game_id_by_slug, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

/// GameConfig is a singleton per game with auto-created defaults.

const DEFAULT_CONFIG: &str = r#"{
    "gameEnabled": false,
    "player": {},
    "drop": {},
    "magicExp": {}
}"#;

/// DB row for game_configs table
#[derive(sqlx::FromRow)]
struct GameConfigRow {
    id: Uuid,
    game_id: Uuid,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl GameConfigRow {
    /// Convert to the frontend-expected shape: { id, gameId, data, createdAt, updatedAt }
    fn to_json(self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "gameId": self.game_id,
            "data": merge_with_defaults(self.data),
            "createdAt": self.created_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
            "updatedAt": self.updated_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
        })
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
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row: Option<GameConfigRow> = sqlx::query_as(
        "SELECT id, game_id, data, created_at, updated_at FROM game_configs WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some(row) => Ok(Json(row.to_json())),
        None => {
            // Auto-create with defaults
            let defaults: serde_json::Value = serde_json::from_str(DEFAULT_CONFIG).unwrap();
            let new_row: GameConfigRow = sqlx::query_as(
                "INSERT INTO game_configs (game_id, data) VALUES ($1, $2) \
                 ON CONFLICT (game_id) DO UPDATE SET data = game_configs.data \
                 RETURNING id, game_id, data, created_at, updated_at",
            )
            .bind(game_id)
            .bind(&defaults)
            .fetch_one(&state.db.pool)
            .await?;
            Ok(Json(new_row.to_json()))
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
) -> ApiResult<Json<serde_json::Value>> {
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

    Ok(Json(row.to_json()))
}

// ===== Public routes =====

pub async fn get_public_by_slug(
    State(state): State<AppState>,
    axum::extract::Path(game_slug): axum::extract::Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let row: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT data FROM game_configs WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some((data,)) => {
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
    let defaults: serde_json::Value = serde_json::from_str(DEFAULT_CONFIG).unwrap();
    if let (Some(data_obj), Some(defaults_obj)) = (data.as_object_mut(), defaults.as_object()) {
        for (key, default_val) in defaults_obj {
            if !data_obj.contains_key(key) {
                data_obj.insert(key.clone(), default_val.clone());
            }
        }
    }
    data
}
