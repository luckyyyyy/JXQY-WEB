use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{self, BatchImportResult, DeleteResult, GameQuery, verify_game_access};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{extract_data_map, fmt_ts, validate_batch_items, validate_key};

const NOT_FOUND: &str = "玩家不存在";

#[derive(sqlx::FromRow)]
struct PlayerRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    index: i32,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Typed detail response for player.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerOutput {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    index: i32,
    created_at: String,
    updated_at: String,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

impl From<PlayerRow> for PlayerOutput {
    fn from(r: PlayerRow) -> Self {
        let extra = extract_data_map(
            r.data,
            &[
                "id",
                "gameId",
                "key",
                "name",
                "index",
                "createdAt",
                "updatedAt",
            ],
        );
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            index: r.index,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

/// List summary item for player.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerListItem {
    id: Uuid,
    key: String,
    name: String,
    index: i32,
    level: i64,
    npc_ini: String,
    updated_at: String,
}

impl From<PlayerRow> for PlayerListItem {
    fn from(r: PlayerRow) -> Self {
        Self {
            id: r.id,
            key: r.key,
            name: r.name,
            index: r.index,
            level: r.data.get("level").and_then(|v| v.as_i64()).unwrap_or(0),
            npc_ini: r
                .data
                .get("npcIni")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/batch-import", axum::routing::post(batch_import))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<PlayerListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, PlayerRow>(
        "SELECT id, game_id, key, name, index, data, created_at, updated_at FROM players WHERE game_id = $1 ORDER BY index",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(Json(rows.into_iter().map(PlayerListItem::from).collect()))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<PlayerOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_get::<PlayerRow, PlayerOutput>(
        &state.db.pool,
        game_id,
        id,
        "SELECT id, game_id, key, name, index, data, created_at, updated_at FROM players WHERE id = $1 AND game_id = $2 LIMIT 1",
        NOT_FOUND,
    )
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlayerInput {
    pub game_id: String,
    pub key: String,
    pub index: Option<i32>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreatePlayerInput>,
) -> ApiResult<Json<PlayerOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&key)
        .to_string();

    // Auto-increment index if not provided
    let index = if let Some(idx) = input.index {
        idx
    } else {
        let max_idx: Option<i32> =
            sqlx::query_scalar("SELECT MAX(index) FROM players WHERE game_id = $1")
                .bind(game_id)
                .fetch_one(&state.db.pool)
                .await?;
        max_idx.unwrap_or(-1) + 1
    };

    let row = sqlx::query_as::<_, PlayerRow>(
        "INSERT INTO players (game_id, key, name, index, data) VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, game_id, key, name, index, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(&name)
    .bind(index)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(Json(PlayerOutput::from(row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::modules::crud::UpdateEntityInput>,
) -> ApiResult<Json<PlayerOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let index = input
        .data
        .get("index")
        .and_then(|v| v.as_i64())
        .map(|i| i as i32);

    let row = if let Some(idx) = index {
        sqlx::query_as::<_, PlayerRow>(
            "UPDATE players SET name = $1, index = $2, data = $3, updated_at = NOW() \
             WHERE id = $4 AND game_id = $5 \
             RETURNING id, game_id, key, name, index, data, created_at, updated_at",
        )
        .bind(&name)
        .bind(idx)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, PlayerRow>(
            "UPDATE players SET name = $1, data = $2, updated_at = NOW() \
             WHERE id = $3 AND game_id = $4 \
             RETURNING id, game_id, key, name, index, data, created_at, updated_at",
        )
        .bind(&name)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    };

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(Json(PlayerOutput::from(row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_delete(
        &state.db.pool,
        game_id,
        id,
        "DELETE FROM players WHERE id = $1 AND game_id = $2",
        NOT_FOUND,
    )
    .await
}

async fn batch_import(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<crate::modules::crud::BatchImportInput>,
) -> ApiResult<Json<BatchImportResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    validate_batch_items(&input.items)?;
    let mut success = Vec::new();
    let mut failed = Vec::new();

    // Get current max index
    let max_idx: Option<i32> =
        sqlx::query_scalar("SELECT MAX(index) FROM players WHERE game_id = $1")
            .bind(game_id)
            .fetch_one(&state.db.pool)
            .await?;
    let mut next_idx = max_idx.unwrap_or(-1) + 1;

    let mut tx = state.db.pool.begin().await?;

    for item in &input.items {
        let file_name = item
            .get("fileName")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let key = item
            .get("key")
            .and_then(|v| v.as_str())
            .unwrap_or(file_name)
            .to_string();
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&key)
            .to_string();
        let data = item
            .get("data")
            .cloned()
            .unwrap_or(serde_json::json!({"name": name}));

        // Try to extract index from filename (e.g., "Player0" → 0)
        let index = item
            .get("index")
            .and_then(|v| v.as_i64())
            .map(|i| i as i32)
            .unwrap_or_else(|| {
                let idx = next_idx;
                next_idx += 1;
                idx
            });

        match sqlx::query_as::<_, PlayerRow>(
            "INSERT INTO players (game_id, key, name, index, data) VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (game_id, key) DO UPDATE SET name = $3, index = $4, data = $5, updated_at = NOW() \
             RETURNING id, game_id, key, name, index, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(&name)
        .bind(index)
        .bind(&data)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(row) => {
                success.push(serde_json::json!({"fileName": file_name, "id": row.id, "name": row.name, "index": row.index}));
            }
            Err(e) => {
                tracing::warn!("Batch import failed for {file_name}: {e}");
                failed.push(serde_json::json!({"fileName": file_name, "error": "导入失败"}));
            }
        }
    }

    tx.commit().await?;

    Ok(Json(BatchImportResult { success, failed }))
}

pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Json<Vec<PlayerOutput>>> {
    crud::entity_list_public::<PlayerRow, PlayerOutput>(
        &state,
        &slug,
        "SELECT id, game_id, key, name, index, data, created_at, updated_at FROM players WHERE game_id = $1 ORDER BY index",
    )
    .await
}
