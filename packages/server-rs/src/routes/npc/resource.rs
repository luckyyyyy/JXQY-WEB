use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Serialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{
    CreateEntityInput, DeleteResult, GameQuery, UpdateEntityInput, verify_game_access,
};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{fmt_ts, validate_key};

#[derive(sqlx::FromRow)]
pub struct NpcResRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub data: serde_json::Value,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Typed output for NPC resource.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcResOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub resources: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&NpcResRow> for NpcResOutput {
    fn from(r: &NpcResRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key.clone(),
            name: r.name.clone(),
            resources: r
                .data
                .get("resources")
                .cloned()
                .unwrap_or(serde_json::json!({})),
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

impl From<NpcResRow> for NpcResOutput {
    fn from(r: NpcResRow) -> Self {
        let resources = r
            .data
            .get("resources")
            .cloned()
            .unwrap_or(serde_json::json!({}));
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            resources,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<NpcResOutput>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, NpcResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM npc_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(NpcResOutput::from).collect()))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<NpcResOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row = sqlx::query_as::<_, NpcResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM npc_resources WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;
    let row = row.ok_or_else(|| ApiError::not_found("NPC资源不存在"))?;
    Ok(Json(NpcResOutput::from(row)))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateEntityInput>,
) -> ApiResult<Json<NpcResOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?.to_lowercase();
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&key)
        .to_string();

    let row = sqlx::query_as::<_, NpcResRow>(
        "INSERT INTO npc_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(&name)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return ApiError::bad_request(format!("Key '{}' 已存在", key));
            }
        }
        ApiError::Database(e)
    })?;

    Ok(Json(NpcResOutput::from(row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityInput>,
) -> ApiResult<Json<NpcResOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let row = sqlx::query_as::<_, NpcResRow>(
        "UPDATE npc_resources SET name = $1, data = $2, updated_at = NOW() WHERE id = $3 AND game_id = $4 \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("NPC资源不存在"))?;
    Ok(Json(NpcResOutput::from(row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM npc_resources WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("NPC资源不存在"));
    }
    Ok(Json(DeleteResult { id }))
}

/// Internal upsert for NPC resource (used during NPC import).
pub async fn upsert_npc_resource<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    game_id: Uuid,
    key: &str,
    name: &str,
    data: &serde_json::Value,
) -> ApiResult<Uuid> {
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO npc_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (game_id, key) DO UPDATE SET name = $3, data = $4, updated_at = NOW() \
         RETURNING id",
    )
    .bind(game_id)
    .bind(&key.to_lowercase())
    .bind(name)
    .bind(data)
    .fetch_one(executor)
    .await?;
    Ok(row.0)
}
