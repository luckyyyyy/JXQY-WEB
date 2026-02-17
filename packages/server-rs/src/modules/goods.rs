use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{self, BatchImportResult, DeleteResult, GameQuery, verify_game_access};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{extract_data_map, fmt_ts, validate_batch_items, validate_key};

const NOT_FOUND: &str = "物品不存在";

/// Row type for goods table (no `name` column, has `kind` instead).
#[derive(sqlx::FromRow)]

struct GoodsRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub kind: String,
    pub data: serde_json::Value,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Typed detail response for goods (get/create/update/public).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoodsOutput {
    id: Uuid,
    game_id: Uuid,
    key: String,
    kind: String,
    created_at: String,
    updated_at: String,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

impl From<GoodsRow> for GoodsOutput {
    fn from(r: GoodsRow) -> Self {
        let extra = extract_data_map(
            r.data,
            &["id", "gameId", "key", "kind", "createdAt", "updatedAt"],
        );
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            kind: r.kind,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

/// List summary item for goods.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoodsListItem {
    id: Uuid,
    key: String,
    name: String,
    kind: String,
    part: String,
    icon: String,
    cost: i64,
    life: i64,
    thew: i64,
    mana: i64,
    life_max: i64,
    thew_max: i64,
    mana_max: i64,
    attack: i64,
    defend: i64,
    evade: i64,
    effect_type: String,
    updated_at: String,
}

impl From<GoodsRow> for GoodsListItem {
    fn from(r: GoodsRow) -> Self {
        let get_str = |k: &str| {
            r.data
                .get(k)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        };
        let get_num = |k: &str| r.data.get(k).and_then(|v| v.as_i64()).unwrap_or(0);
        Self {
            id: r.id,
            key: r.key,
            name: r
                .data
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            kind: r.kind,
            part: get_str("part"),
            icon: get_str("icon"),
            cost: get_num("cost"),
            life: get_num("life"),
            thew: get_num("thew"),
            mana: get_num("mana"),
            life_max: get_num("lifeMax"),
            thew_max: get_num("thewMax"),
            mana_max: get_num("manaMax"),
            attack: get_num("attack"),
            defend: get_num("defend"),
            evade: get_num("evade"),
            effect_type: get_str("effectType"),
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListGoodsQuery {
    pub game_id: String,
    pub kind: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListGoodsQuery>,
) -> ApiResult<Json<Vec<GoodsListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = crud::entity_list_filtered::<GoodsRow>(
        &state.db.pool,
        game_id,
        "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE game_id = $1 ORDER BY updated_at DESC",
        "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE game_id = $1 AND kind = $2 ORDER BY updated_at DESC",
        q.kind.as_deref(),
    )
    .await?;
    Ok(Json(rows.into_iter().map(GoodsListItem::from).collect()))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<GoodsOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_get::<GoodsRow, GoodsOutput>(
        &state.db.pool,
        game_id,
        id,
        "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE id = $1 AND game_id = $2 LIMIT 1",
        NOT_FOUND,
    )
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGoodsInput {
    pub game_id: String,
    pub key: String,
    pub kind: Option<String>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateGoodsInput>,
) -> ApiResult<Json<GoodsOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;
    let kind = input.kind.as_deref().unwrap_or("Drug");

    let row = sqlx::query_as::<_, GoodsRow>(
        "INSERT INTO goods (game_id, key, kind, data) VALUES ($1, $2, $3, $4) \
         RETURNING id, game_id, key, kind, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(kind)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(Json(GoodsOutput::from(row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::modules::crud::UpdateEntityInput>,
) -> ApiResult<Json<GoodsOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let kind = input
        .data
        .get("kind")
        .and_then(|v| v.as_str())
        .unwrap_or("Drug")
        .to_string();
    let key = input
        .data
        .get("key")
        .and_then(|v| v.as_str())
        .map(|s| s.to_lowercase());

    let row = if let Some(ref k) = key {
        sqlx::query_as::<_, GoodsRow>(
            "UPDATE goods SET key = $1, kind = $2, data = $3, updated_at = NOW() \
             WHERE id = $4 AND game_id = $5 \
             RETURNING id, game_id, key, kind, data, created_at, updated_at",
        )
        .bind(k)
        .bind(&kind)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, GoodsRow>(
            "UPDATE goods SET kind = $1, data = $2, updated_at = NOW() \
             WHERE id = $3 AND game_id = $4 \
             RETURNING id, game_id, key, kind, data, created_at, updated_at",
        )
        .bind(&kind)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    };

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(Json(GoodsOutput::from(row)))
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
        "DELETE FROM goods WHERE id = $1 AND game_id = $2",
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
        let file_name = item
            .get("fileName")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let key = item
            .get("key")
            .and_then(|v| v.as_str())
            .unwrap_or(file_name)
            .to_lowercase();
        let kind = item.get("kind").and_then(|v| v.as_str()).unwrap_or("Drug");
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&key)
            .to_string();
        let data = item
            .get("data")
            .cloned()
            .unwrap_or(serde_json::json!({"name": name, "kind": kind}));

        match sqlx::query_as::<_, GoodsRow>(
            "INSERT INTO goods (game_id, key, kind, data) VALUES ($1, $2, $3, $4) \
             ON CONFLICT (game_id, key) DO UPDATE SET kind = $3, data = $4, updated_at = NOW() \
             RETURNING id, game_id, key, kind, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(kind)
        .bind(&data)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(row) => {
                let name = row
                    .data
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                success.push(serde_json::json!({"fileName": file_name, "id": row.id, "name": name, "kind": row.kind}));
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
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<GoodsOutput>>> {
    crud::entity_list_public::<GoodsRow, GoodsOutput>(
        &state,
        &game_slug,
        "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}
