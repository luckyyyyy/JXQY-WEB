use serde::Serialize;
use uuid::Uuid;

use crate::utils::fmt_ts;

#[derive(sqlx::FromRow)]
pub struct SaveRow {
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
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(sqlx::FromRow)]
pub struct SaveSlotRow {
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
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Row type for shared save queries (join saves + users, no auth context).
#[derive(sqlx::FromRow)]
pub struct SharedSaveRow {
    pub id: Uuid,
    pub name: String,
    pub data: serde_json::Value,
    pub user_name: String,
    pub map_name: Option<String>,
    pub level: Option<i32>,
    pub player_name: Option<String>,
    pub screenshot: Option<String>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Typed save slot output (without data).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSlotOutput {
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
    pub created_at: String,
    pub updated_at: String,
}

impl From<&SaveSlotRow> for SaveSlotOutput {
    fn from(r: &SaveSlotRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            user_id: r.user_id,
            name: r.name.clone(),
            map_name: r.map_name.clone(),
            level: r.level,
            player_name: r.player_name.clone(),
            screenshot: r.screenshot.clone(),
            is_shared: r.is_shared,
            share_code: r.share_code.clone(),
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

impl From<SaveSlotRow> for SaveSlotOutput {
    fn from(r: SaveSlotRow) -> Self {
        let created_at = fmt_ts(r.created_at);
        let updated_at = fmt_ts(r.updated_at);
        Self {
            id: r.id,
            game_id: r.game_id,
            user_id: r.user_id,
            name: r.name,
            map_name: r.map_name,
            level: r.level,
            player_name: r.player_name,
            screenshot: r.screenshot,
            is_shared: r.is_shared,
            share_code: r.share_code,
            created_at,
            updated_at,
        }
    }
}

/// Typed save data output (with data).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDataOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub data: serde_json::Value,
    pub map_name: Option<String>,
    pub level: Option<i32>,
    pub player_name: Option<String>,
    pub screenshot: Option<String>,
    pub is_shared: bool,
    pub share_code: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&SaveRow> for SaveDataOutput {
    fn from(r: &SaveRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            user_id: r.user_id,
            name: r.name.clone(),
            data: r.data.clone(),
            map_name: r.map_name.clone(),
            level: r.level,
            player_name: r.player_name.clone(),
            screenshot: r.screenshot.clone(),
            is_shared: r.is_shared,
            share_code: r.share_code.clone(),
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

/// Typed shared save output.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedSaveOutput {
    pub id: Uuid,
    pub name: String,
    pub data: serde_json::Value,
    pub user_name: String,
    pub map_name: Option<String>,
    pub level: Option<i32>,
    pub player_name: Option<String>,
    pub screenshot: Option<String>,
    pub updated_at: String,
}

impl From<SharedSaveRow> for SharedSaveOutput {
    fn from(r: SharedSaveRow) -> Self {
        let updated_at = fmt_ts(r.updated_at);
        Self {
            id: r.id,
            name: r.name,
            data: r.data,
            user_name: r.user_name,
            map_name: r.map_name,
            level: r.level,
            player_name: r.player_name,
            screenshot: r.screenshot,
            updated_at,
        }
    }
}

pub fn generate_share_code() -> String {
    use base64::Engine;
    let mut rng = rand::rng();
    let bytes: [u8; 6] = rand::Rng::random(&mut rng);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}
