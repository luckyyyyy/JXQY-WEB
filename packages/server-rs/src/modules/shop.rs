use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Serialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{
    self, BatchImportResult, DeleteResult, EntityRow, GameQuery, verify_game_access,
};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{fmt_ts, validate_batch_items, validate_key};

const NOT_FOUND: &str = "商店不存在";

/// Typed detail response for shop.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopOutput {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    number_valid: bool,
    buy_percent: i64,
    recycle_percent: i64,
    items: serde_json::Value,
    created_at: String,
    updated_at: String,
}

impl From<EntityRow> for ShopOutput {
    fn from(r: EntityRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            number_valid: r.data.get("numberValid").and_then(|v| v.as_bool()).unwrap_or(false),
            buy_percent: r.data.get("buyPercent").and_then(|v| v.as_i64()).unwrap_or(100),
            recycle_percent: r.data.get("recyclePercent").and_then(|v| v.as_i64()).unwrap_or(100),
            items: r.data.get("items").cloned().unwrap_or(serde_json::json!([])),
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

/// List summary item for shop.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopListItem {
    id: Uuid,
    key: String,
    name: String,
    item_count: usize,
    updated_at: String,
}

impl From<EntityRow> for ShopListItem {
    fn from(r: EntityRow) -> Self {
        let item_count = r.data.get("items").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
        Self {
            id: r.id,
            key: r.key,
            name: r.name,
            item_count,
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
) -> ApiResult<Json<Vec<ShopListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, EntityRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM shops WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(Json(rows.into_iter().map(ShopListItem::from).collect()))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<ShopOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_get::<EntityRow, ShopOutput>(
        &state.db.pool,
        game_id,
        id,
        concat!("SELECT ", "id, game_id, key, name, data, created_at, updated_at", " FROM shops WHERE id = $1 AND game_id = $2 LIMIT 1"),
        NOT_FOUND,
    )
    .await
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<crate::modules::crud::CreateEntityInput>,
) -> ApiResult<Json<ShopOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();

    let row = sqlx::query_as::<_, EntityRow>(
        "INSERT INTO shops (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(&name)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(Json(ShopOutput::from(row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::modules::crud::UpdateEntityInput>,
) -> ApiResult<Json<ShopOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let row = sqlx::query_as::<_, EntityRow>(
        "UPDATE shops SET name = $1, data = $2, updated_at = NOW() WHERE id = $3 AND game_id = $4 \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("商店不存在"))?;
    Ok(Json(ShopOutput::from(row)))
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
        "DELETE FROM shops WHERE id = $1 AND game_id = $2",
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

    let mut tx = state.db.pool.begin().await?;

    for item in &input.items {
        let file_name = item.get("fileName").and_then(|v| v.as_str()).unwrap_or("unknown");
        let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_lowercase();
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
        let data = item.get("data").cloned().unwrap_or(serde_json::json!({"name": name, "items": []}));

        match sqlx::query_as::<_, EntityRow>(
            "INSERT INTO shops (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
             ON CONFLICT (game_id, key) DO UPDATE SET name = $3, data = $4, updated_at = NOW() \
             RETURNING id, game_id, key, name, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(&name)
        .bind(&data)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(row) => {
                let item_count = row.data.get("items").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
                success.push(serde_json::json!({"fileName": file_name, "id": row.id, "name": row.name, "itemCount": item_count}));
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
) -> ApiResult<Json<Vec<ShopOutput>>> {
    crud::entity_list_public::<EntityRow, ShopOutput>(
        &state,
        &slug,
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM shops WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}
