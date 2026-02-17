//! Database models matching the PostgreSQL schema.


use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Users ──────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub email_verified: bool,
    pub settings: Option<serde_json::Value>,
    pub role: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserOutput {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
    pub email_verified: bool,
    pub settings: Option<serde_json::Value>,
}

impl From<User> for UserOutput {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            email_verified: u.email_verified,
            settings: u.settings,
        }
    }
}

// ── Sessions ───────────────────────────────────────

#[derive(Debug, Clone, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

// ── Games ──────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GameOutput {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Option<Uuid>,
    pub created_at: Option<String>,
}

impl From<Game> for GameOutput {
    fn from(g: Game) -> Self {
        Self {
            id: g.id,
            slug: g.slug,
            name: g.name,
            description: g.description,
            owner_id: g.owner_id,
            created_at: g.created_at.map(|d| d.to_rfc3339()),
        }
    }
}

// ── Game Members ───────────────────────────────────

#[derive(Debug, Clone, FromRow)]
pub struct GameMember {
    pub id: Uuid,
    pub game_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub created_at: Option<DateTime<Utc>>,
}

// ── Files ──────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct File {
    pub id: Uuid,
    pub game_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub file_type: String,
    pub storage_key: Option<String>,
    pub size: Option<String>,
    pub mime_type: Option<String>,
    pub checksum: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
}

// ── Generic JSONB entity (used for magic, goods, npc, obj, etc.) ──

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonbEntity {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Magic (extends JsonbEntity with user_type) ─────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Magic {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub user_type: String,
    pub name: String,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── LevelConfig ────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelConfig {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub user_type: String,
    pub max_level: i32,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Goods ──────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Goods {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub kind: String,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── NPC ────────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Npc {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub relation: String,
    pub resource_id: Option<Uuid>,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Obj ────────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Obj {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub resource_id: Option<Uuid>,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Player ─────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub index: i32,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Shops ──────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shop {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Save ───────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Save {
    pub id: Uuid,
    pub game_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub map_name: Option<String>,
    pub level: Option<i32>,
    pub player_name: Option<String>,
    pub screenshot: Option<String>,
    pub is_shared: bool,
    pub share_code: Option<String>,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Scene ──────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub map_file_name: String,
    pub mmf_data: Option<String>,
    pub data: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneItem {
    pub id: Uuid,
    pub game_id: Uuid,
    pub scene_id: Uuid,
    pub kind: String,
    pub key: String,
    pub name: String,
    pub file_id: Option<Uuid>,
    pub data: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Game Config ────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub id: Uuid,
    pub game_id: Uuid,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Talk / TalkPortrait ────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SingletonData {
    pub id: Uuid,
    pub game_id: Uuid,
    pub data: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ── Email Token ────────────────────────────────────

#[derive(Debug, Clone, FromRow)]
pub struct EmailToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token: String,
    #[sqlx(rename = "type")]
    pub token_type: String,
    pub new_email: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: Option<DateTime<Utc>>,
}

// ── API request/response DTOs ──────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AuthOutput {
    pub user: UserOutput,
    pub default_game_slug: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterInput {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LogoutOutput {
    pub success: bool,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateGameInput {
    pub name: String,
    pub slug: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGameInput {
    pub id: Uuid,
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGameInput {
    pub id: Uuid,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GameKeyInput {
    pub game_id: String,
}

/// Generic CRUD input for JSONB entities.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntityInput {
    pub game_id: String,
    pub key: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntityInput {
    pub id: Uuid,
    pub game_id: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntityInput {
    pub id: Uuid,
    pub game_id: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListEntityInput {
    pub game_id: String,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetEntityInput {
    pub game_id: String,
    pub id: Uuid,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportInput {
    pub game_id: String,
    pub items: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BatchImportOutput {
    pub created: i64,
    pub updated: i64,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct DeleteOutput {
    pub id: Uuid,
}
