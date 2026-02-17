use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{
    self, DeleteResult, GameQuery, verify_game_access,
};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{fmt_ts, validate_key};

const NOT_FOUND: &str = "等级配置不存在";

#[derive(sqlx::FromRow)]
struct LevelRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    user_type: String,
    max_level: i32,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Typed detail response for level config.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelOutput {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    user_type: String,
    max_level: i32,
    levels: serde_json::Value,
    created_at: String,
    updated_at: String,
}

impl From<LevelRow> for LevelOutput {
    fn from(r: LevelRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            user_type: r.user_type,
            max_level: r.max_level,
            levels: r.data,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

impl From<&LevelRow> for LevelOutput {
    fn from(r: &LevelRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key.clone(),
            name: r.name.clone(),
            user_type: r.user_type.clone(),
            max_level: r.max_level,
            levels: r.data.clone(),
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

/// List summary item for level config.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelListItem {
    id: Uuid,
    key: String,
    name: String,
    user_type: String,
    max_level: i32,
    updated_at: String,
}

impl From<LevelRow> for LevelListItem {
    fn from(r: LevelRow) -> Self {
        Self {
            id: r.id,
            key: r.key,
            name: r.name,
            user_type: r.user_type,
            max_level: r.max_level,
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/batch-import", axum::routing::post(import_from_ini))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLevelQuery {
    pub game_id: String,
    pub user_type: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListLevelQuery>,
) -> ApiResult<Json<Vec<LevelListItem>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = crud::entity_list_filtered::<LevelRow>(
        &state.db.pool,
        game_id,
        "SELECT id, game_id, key, name, user_type, max_level, data, created_at, updated_at FROM level_configs WHERE game_id = $1 ORDER BY updated_at DESC",
        "SELECT id, game_id, key, name, user_type, max_level, data, created_at, updated_at FROM level_configs WHERE game_id = $1 AND user_type = $2 ORDER BY updated_at DESC",
        q.user_type.as_deref(),
    )
    .await?;
    Ok(Json(rows.into_iter().map(LevelListItem::from).collect()))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<LevelOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_get::<LevelRow, LevelOutput>(
        &state.db.pool,
        game_id,
        id,
        "SELECT id, game_id, key, name, user_type, max_level, data, created_at, updated_at FROM level_configs WHERE id = $1 AND game_id = $2 LIMIT 1",
        NOT_FOUND,
    )
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLevelInput {
    pub game_id: String,
    pub key: String,
    pub name: Option<String>,
    pub user_type: Option<String>,
    pub max_level: Option<i32>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateLevelInput>,
) -> ApiResult<Json<LevelOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;

    // Check unique key
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM level_configs WHERE game_id = $1 AND key = $2)",
    )
    .bind(game_id)
    .bind(&key)
    .fetch_one(&state.db.pool)
    .await?;

    if exists {
        return Err(ApiError::bad_request(format!("Key '{}' 已存在", key)));
    }

    let name = input.name.as_deref().unwrap_or(&key);
    let user_type = input.user_type.as_deref().unwrap_or("player");
    let max_level = input.max_level.unwrap_or(80).clamp(1, 999);

    let row = sqlx::query_as::<_, LevelRow>(
        "INSERT INTO level_configs (game_id, key, name, user_type, max_level, data) VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, game_id, key, name, user_type, max_level, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(name)
    .bind(user_type)
    .bind(max_level)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(LevelOutput::from(row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<CreateLevelInput>,
) -> ApiResult<Json<LevelOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;

    // Key conflict check
    let conflict: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM level_configs WHERE game_id = $1 AND key = $2 AND id != $3)",
    )
    .bind(game_id)
    .bind(&key)
    .bind(id)
    .fetch_one(&state.db.pool)
    .await?;

    if conflict {
        return Err(ApiError::bad_request(format!("Key '{}' 已存在", key)));
    }

    let name = input.name.as_deref().unwrap_or(&key);
    let user_type = input.user_type.as_deref().unwrap_or("player");
    let max_level = input.max_level.unwrap_or(80).clamp(1, 999);

    let row = sqlx::query_as::<_, LevelRow>(
        "UPDATE level_configs SET key = $1, name = $2, user_type = $3, max_level = $4, data = $5, updated_at = NOW() \
         WHERE id = $6 AND game_id = $7 \
         RETURNING id, game_id, key, name, user_type, max_level, data, created_at, updated_at",
    )
    .bind(&key)
    .bind(name)
    .bind(user_type)
    .bind(max_level)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(Json(LevelOutput::from(row)))
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
        "DELETE FROM level_configs WHERE id = $1 AND game_id = $2",
        NOT_FOUND,
    )
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLevelInput {
    pub game_id: String,
    pub key: String,
    pub name: Option<String>,
    pub user_type: Option<String>,
    pub data: serde_json::Value,
}

async fn import_from_ini(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ImportLevelInput>,
) -> ApiResult<Json<LevelOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;
    let user_type = input.user_type.as_deref().unwrap_or("player");
    let name = input.name.as_deref().unwrap_or(&key);
    let max_level = input
        .data
        .as_array()
        .map(|a| a.len() as i32)
        .unwrap_or(80)
        .clamp(1, 999);

    // Upsert
    let row = sqlx::query_as::<_, LevelRow>(
        "INSERT INTO level_configs (game_id, key, name, user_type, max_level, data) VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (game_id, key) DO UPDATE SET name = $3, user_type = $4, max_level = $5, data = $6, updated_at = NOW() \
         RETURNING id, game_id, key, name, user_type, max_level, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(name)
    .bind(user_type)
    .bind(max_level)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(LevelOutput::from(row)))
}

/// Public: list all level configs for a game slug.
pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<LevelPublicOutput>> {
    let game_id = crate::modules::crud::resolve_game_id_by_slug(&state, &game_slug).await?;
    let rows = sqlx::query_as::<_, LevelRow>(
        "SELECT id, game_id, key, name, user_type, max_level, data, created_at, updated_at FROM level_configs WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    let mut player = Vec::new();
    let mut npc = Vec::new();
    for r in &rows {
        let val = LevelOutput::from(r);
        match r.user_type.as_str() {
            "npc" => npc.push(val),
            _ => player.push(val),
        }
    }

    Ok(Json(LevelPublicOutput { player, npc }))
}

/// Public level output grouped by user type.
#[derive(Serialize)]
pub struct LevelPublicOutput {
    player: Vec<LevelOutput>,
    npc: Vec<LevelOutput>,
}

/// Public: get a single level config by game slug and key.
pub async fn get_public_by_slug_and_key(
    State(state): State<AppState>,
    Path((game_slug, key)): Path<(String, String)>,
) -> ApiResult<Json<Option<LevelOutput>>> {
    let game_id = crate::modules::crud::resolve_game_id_by_slug(&state, &game_slug).await?;
    let row = sqlx::query_as::<_, LevelRow>(
        "SELECT id, game_id, key, name, user_type, max_level, data, created_at, updated_at FROM level_configs WHERE game_id = $1 AND key = $2 LIMIT 1",
    )
    .bind(game_id)
    .bind(&key)
    .fetch_optional(&state.db.pool)
    .await?;
    Ok(Json(row.map(LevelOutput::from)))
}
