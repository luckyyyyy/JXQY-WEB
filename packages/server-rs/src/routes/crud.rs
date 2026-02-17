//! Shared helpers for JSONB entity CRUD routes.

use serde::Deserialize;
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
        let mut obj = match &self.data {
            serde_json::Value::Object(map) => map.clone(),
            _ => serde_json::Map::new(),
        };
        obj.insert("id".to_string(), serde_json::json!(self.id));
        obj.insert("gameId".to_string(), serde_json::json!(self.game_id));
        obj.insert("key".to_string(), serde_json::json!(self.key));
        obj.insert("name".to_string(), serde_json::json!(self.name));
        if let Some(created_at) = self.created_at {
            obj.insert(
                "createdAt".to_string(),
                serde_json::json!(created_at.to_rfc3339()),
            );
        }
        if let Some(updated_at) = self.updated_at {
            obj.insert(
                "updatedAt".to_string(),
                serde_json::json!(updated_at.to_rfc3339()),
            );
        }
        serde_json::Value::Object(obj)
    }
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
    let mut suffix = 1u32;
    loop {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM games WHERE slug = $1)")
            .bind(&slug)
            .fetch_one(&state.db.pool)
            .await?;
        if !exists {
            return Ok(slug);
        }
        slug = format!("{base}-{suffix}");
        suffix += 1;
    }
}
