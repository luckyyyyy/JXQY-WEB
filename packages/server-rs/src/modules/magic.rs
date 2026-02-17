use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{self, BatchImportResult, DeleteResult, GameQuery, verify_game_access};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{extract_data_map, fmt_ts, validate_batch_items, validate_key};

const NOT_FOUND: &str = "武功不存在";

/// Row type for magics table (extends EntityRow with user_type).
#[derive(sqlx::FromRow)]
struct MagicRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    user_type: String,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Typed detail response for magic (get/create/update/public).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicOutput {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    user_type: String,
    created_at: String,
    updated_at: String,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

impl From<MagicRow> for MagicOutput {
    fn from(r: MagicRow) -> Self {
        let extra = extract_data_map(
            r.data,
            &[
                "id",
                "gameId",
                "key",
                "name",
                "userType",
                "createdAt",
                "updatedAt",
            ],
        );
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            user_type: r.user_type,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

/// List summary item for magic.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicListItem {
    id: Uuid,
    key: String,
    name: String,
    user_type: String,
    move_kind: String,
    belong: String,
    icon: String,
    updated_at: String,
}

impl From<MagicRow> for MagicListItem {
    fn from(r: MagicRow) -> Self {
        let get_str = |k: &str| {
            r.data
                .get(k)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        };
        Self {
            id: r.id,
            key: r.key,
            name: r.name,
            user_type: r.user_type,
            move_kind: get_str("moveKind"),
            belong: get_str("belong"),
            icon: get_str("icon"),
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
pub struct ListMagicQuery {
    pub game_id: String,
    pub user_type: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListMagicQuery>,
) -> ApiResult<Json<Vec<MagicListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = crud::entity_list_filtered::<MagicRow>(
        &state.db.pool,
        game_id,
        concat!(
            "SELECT ",
            "id, game_id, key, name, user_type, data, created_at, updated_at",
            " FROM magics WHERE game_id = $1 ORDER BY updated_at DESC"
        ),
        concat!(
            "SELECT ",
            "id, game_id, key, name, user_type, data, created_at, updated_at",
            " FROM magics WHERE game_id = $1 AND user_type = $2 ORDER BY updated_at DESC"
        ),
        q.user_type.as_deref(),
    )
    .await?;
    Ok(Json(rows.into_iter().map(MagicListItem::from).collect()))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<MagicOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_get::<MagicRow, MagicOutput>(
        &state.db.pool,
        game_id,
        id,
        concat!(
            "SELECT ",
            "id, game_id, key, name, user_type, data, created_at, updated_at",
            " FROM magics WHERE id = $1 AND game_id = $2 LIMIT 1"
        ),
        NOT_FOUND,
    )
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMagicInput {
    pub game_id: String,
    pub key: String,
    pub user_type: Option<String>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateMagicInput>,
) -> ApiResult<Json<MagicOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;
    let user_type = input.user_type.as_deref().unwrap_or("npc");
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&key)
        .to_string();

    let row = sqlx::query_as::<_, MagicRow>(
        "INSERT INTO magics (game_id, key, user_type, name, data) VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(user_type)
    .bind(&name)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(Json(MagicOutput::from(row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::modules::crud::UpdateEntityInput>,
) -> ApiResult<Json<MagicOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let user_type = input
        .data
        .get("userType")
        .and_then(|v| v.as_str())
        .unwrap_or("npc")
        .to_string();
    let key = input
        .data
        .get("key")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let row = if let Some(ref k) = key {
        sqlx::query_as::<_, MagicRow>(
            "UPDATE magics SET key = $1, user_type = $2, name = $3, data = $4, updated_at = NOW() \
             WHERE id = $5 AND game_id = $6 \
             RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
        )
        .bind(k)
        .bind(&user_type)
        .bind(&name)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, MagicRow>(
            "UPDATE magics SET user_type = $1, name = $2, data = $3, updated_at = NOW() \
             WHERE id = $4 AND game_id = $5 \
             RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
        )
        .bind(&user_type)
        .bind(&name)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    };

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(Json(MagicOutput::from(row)))
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
        "DELETE FROM magics WHERE id = $1 AND game_id = $2",
        NOT_FOUND,
    )
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportInput {
    pub game_id: String,
    pub items: Vec<serde_json::Value>,
    pub user_type: Option<String>,
}

async fn batch_import(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchImportInput>,
) -> ApiResult<Json<BatchImportResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    validate_batch_items(&input.items)?;
    let default_user_type = input.user_type.as_deref().unwrap_or("npc");

    let mut success = Vec::new();
    let mut failed = Vec::new();

    let mut tx = state.db.pool.begin().await?;

    for item in &input.items {
        let file_name = item
            .get("fileName")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let ini_content = item.get("iniContent").and_then(|v| v.as_str());
        let user_type = item
            .get("userType")
            .and_then(|v| v.as_str())
            .unwrap_or(default_user_type);

        let Some(ini_content) = ini_content else {
            failed.push(serde_json::json!({"fileName": file_name, "error": "缺少 iniContent"}));
            continue;
        };

        // Parse key from filename
        let key = file_name
            .rsplit('/')
            .next()
            .unwrap_or(file_name)
            .trim_end_matches(".ini")
            .to_string();

        let name = key.clone(); // Will be overwritten by INI parsing on frontend

        // Store raw INI as data for now; INI parsing happens on frontend
        let data = item.get("data").cloned().unwrap_or_else(|| {
            serde_json::json!({
                "name": name,
                "userType": user_type,
                "iniContent": ini_content,
            })
        });

        match sqlx::query_as::<_, MagicRow>(
            "INSERT INTO magics (game_id, key, user_type, name, data) VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (game_id, key) DO UPDATE SET user_type = $3, name = $4, data = $5, updated_at = NOW() \
             RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(user_type)
        .bind(&name)
        .bind(&data)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(row) => {
                success.push(serde_json::json!({
                    "fileName": file_name,
                    "id": row.id,
                    "name": row.name,
                }));
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

/// Public: list all magics for a game slug (no auth).
pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<MagicOutput>>> {
    crud::entity_list_public::<MagicRow, MagicOutput>(
        &state,
        &game_slug,
        concat!(
            "SELECT ",
            "id, game_id, key, name, user_type, data, created_at, updated_at",
            " FROM magics WHERE game_id = $1 ORDER BY updated_at DESC"
        ),
    )
    .await
}
