//! Shared helpers for JSONB entity CRUD routes.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

/// Common query params for list/get operations.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameQuery {
    pub game_id: String,
}

/// Verify that the user has access to this game, returning resolved game UUID.
pub async fn verify_game_access(
    state: &AppState,
    game_key: &str,
    user_id: Uuid,
) -> ApiResult<Uuid> {
    let game_id = resolve_game_id(state, game_key).await?;

    let is_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM game_members WHERE game_id = $1 AND user_id = $2)",
    )
    .bind(game_id)
    .bind(user_id)
    .fetch_one(&state.db.pool)
    .await?;

    if !is_member {
        return Err(ApiError::forbidden("没有访问此游戏的权限"));
    }

    Ok(game_id)
}

/// Resolve game ID from slug or UUID string.
pub async fn resolve_game_id(state: &AppState, key: &str) -> ApiResult<Uuid> {
    let game_id: Option<Uuid> = if let Ok(uuid) = Uuid::parse_str(key) {
        sqlx::query_scalar("SELECT id FROM games WHERE id = $1 LIMIT 1")
            .bind(uuid)
            .fetch_optional(&state.db.pool)
            .await?
    } else {
        sqlx::query_scalar("SELECT id FROM games WHERE slug = $1 LIMIT 1")
            .bind(key)
            .fetch_optional(&state.db.pool)
            .await?
    };
    game_id.ok_or_else(|| ApiError::not_found("游戏不存在"))
}

/// Verify admin role OR game membership (mirrors TS `verifyGameOrAdminAccess`).
/// Admins can access any game; non-admins require membership.
pub async fn verify_game_or_admin_access(
    state: &AppState,
    game_key: &str,
    user_id: Uuid,
) -> ApiResult<Uuid> {
    if is_admin(state, user_id).await? {
        // Admin bypasses membership check, just resolve the game_id
        return resolve_game_id(state, game_key).await;
    }
    // Non-admin: require game membership
    verify_game_access(state, game_key, user_id).await
}

/// Check if a user has the admin role.
pub async fn is_admin(state: &AppState, user_id: Uuid) -> ApiResult<bool> {
    let role: Option<String> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db.pool)
        .await?;
    Ok(role.as_deref() == Some("admin"))
}

/// Resolve game ID from slug only (public, no auth required).
pub async fn resolve_game_id_by_slug(state: &AppState, slug: &str) -> ApiResult<Uuid> {
    let game_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM games WHERE slug = $1 LIMIT 1")
        .bind(slug)
        .fetch_optional(&state.db.pool)
        .await?;
    game_id.ok_or_else(|| ApiError::not_found("Game not found"))
}

/// Row type for standard JSONB entity tables.
#[derive(sqlx::FromRow, serde::Serialize)]

pub struct EntityRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub data: serde_json::Value,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl EntityRow {
    /// Serialize to JSON, flattening `data` fields into the top-level object.
    /// This matches the old NestJS/tRPC response shape that the frontend expects.
    pub fn to_json(&self) -> serde_json::Value {
        use crate::utils::fmt_ts;
        crate::utils::merge_into_data(&self.data, &[
            ("id", serde_json::json!(self.id)),
            ("gameId", serde_json::json!(self.game_id)),
            ("key", serde_json::json!(self.key)),
            ("name", serde_json::json!(self.name)),
            ("createdAt", serde_json::json!(fmt_ts(self.created_at))),
            ("updatedAt", serde_json::json!(fmt_ts(self.updated_at))),
        ])
    }

    /// Convert into a typed output, flattening `data` via `#[serde(flatten)]`.
    pub fn into_output(self) -> EntityOutput {
        EntityOutput::from(self)
    }
}

// ── Typed response structs ─────────────────────────

/// Typed response for standard JSONB entities (get/create/update).
/// The `extra` field is flattened: JSONB data fields merge into the top-level.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl From<EntityRow> for EntityOutput {
    fn from(r: EntityRow) -> Self {
        use crate::utils::{extract_data_map, fmt_ts};
        let extra =
            extract_data_map(r.data, &["id", "gameId", "key", "name", "createdAt", "updatedAt"]);
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

/// Standard delete response.
#[derive(Serialize)]
pub struct DeleteResult {
    pub id: Uuid,
}

/// Generic success response (e.g. imports, singleton updates).
#[derive(Serialize)]
pub struct SuccessResult {
    pub success: bool,
}

/// Standard batch import response.
#[derive(Serialize)]
pub struct BatchImportResult {
    pub success: Vec<serde_json::Value>,
    pub failed: Vec<serde_json::Value>,
}

/// Input for creating an entity.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntityInput {
    pub game_id: String,
    pub key: String,
    pub data: serde_json::Value,
}

/// Input for updating an entity.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntityInput {
    pub game_id: String,
    pub data: serde_json::Value,
}

/// Input for batch import.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportInput {
    pub game_id: String,
    pub items: Vec<serde_json::Value>,
}

/// Input for singleton JSONB (talk, talk_portrait, game_config).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]

pub struct SingletonInput {
    pub game_id: String,
    pub data: serde_json::Value,
}

// ── Shared helpers ─────────────────────────────────

/// Generate a URL-safe slug from a string.
pub fn slugify(value: &str) -> String {
    value
        .to_lowercase()
        .trim()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Ensure a slug is unique in the games table, appending a suffix if needed.
pub async fn ensure_unique_slug(state: &AppState, base_slug: &str) -> ApiResult<String> {
    let base = if base_slug.is_empty() {
        "game"
    } else {
        base_slug
    };
    let mut slug = base.to_string();
    for suffix in 1u32..=1000 {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM games WHERE slug = $1)")
            .bind(&slug)
            .fetch_one(&state.db.pool)
            .await?;
        if !exists {
            return Ok(slug);
        }
        slug = format!("{base}-{suffix}");
    }
    Err(ApiError::internal("Too many slug collisions"))
}

// ── Generic CRUD helpers ──────────────────────────

/// Look up a single entity by id and game_id, returning a typed JSON output.
///
/// `select_sql` must use `$1` for `id` and `$2` for `game_id`.
pub async fn entity_get<R, O>(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    select_sql: &str,
    not_found_msg: &str,
) -> ApiResult<axum::Json<O>>
where
    R: for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> + Send + Unpin,
    O: From<R> + serde::Serialize,
{
    let row = sqlx::query_as::<_, R>(select_sql)
        .bind(id)
        .bind(game_id)
        .fetch_optional(pool)
        .await?;
    let row = row.ok_or_else(|| ApiError::not_found(not_found_msg))?;
    Ok(axum::Json(O::from(row)))
}

/// Delete a single entity by id and game_id.
///
/// `delete_sql` must use `$1` for `id` and `$2` for `game_id`.
pub async fn entity_delete(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    delete_sql: &str,
    not_found_msg: &str,
) -> ApiResult<axum::Json<DeleteResult>> {
    let result = sqlx::query(delete_sql)
        .bind(id)
        .bind(game_id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found(not_found_msg));
    }
    Ok(axum::Json(DeleteResult { id }))
}

/// List all entities for a public game slug (no auth). Consumes rows via `into_iter`.
///
/// `select_sql` must use `$1` for `game_id`.
pub async fn entity_list_public<R, O>(
    state: &AppState,
    slug: &str,
    select_sql: &str,
) -> ApiResult<axum::Json<Vec<O>>>
where
    R: for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> + Send + Unpin,
    O: From<R> + serde::Serialize,
{
    let game_id = resolve_game_id_by_slug(state, slug).await?;
    let rows = sqlx::query_as::<_, R>(select_sql)
        .bind(game_id)
        .fetch_all(&state.db.pool)
        .await?;
    Ok(axum::Json(rows.into_iter().map(O::from).collect()))
}

/// Fetch rows with an optional `&str` filter. Returns raw `Vec<R>` for caller to convert.
///
/// `base_sql`: `$1` = game_id. `filtered_sql`: `$1` = game_id, `$2` = filter value.
pub async fn entity_list_filtered<R>(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    base_sql: &str,
    filtered_sql: &str,
    filter: Option<&str>,
) -> ApiResult<Vec<R>>
where
    R: for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> + Send + Unpin,
{
    let rows = if let Some(val) = filter {
        sqlx::query_as::<_, R>(filtered_sql)
            .bind(game_id)
            .bind(val)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_as::<_, R>(base_sql)
            .bind(game_id)
            .fetch_all(pool)
            .await?
    };
    Ok(rows)
}

/// Convert a sqlx unique-constraint violation into a user-friendly 400 error.
/// Falls back to `ApiError::Database` for non-constraint errors.
pub fn handle_unique_violation(e: sqlx::Error, key: &str) -> ApiError {
    if let sqlx::Error::Database(ref db_err) = e {
        if db_err.constraint().is_some() {
            return ApiError::bad_request(format!("Key '{key}' 已存在"));
        }
    }
    ApiError::Database(e)
}
