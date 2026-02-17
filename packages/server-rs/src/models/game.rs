use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

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
            created_at: Some(crate::utils::fmt_ts(g.created_at)),
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

// ── API request/response DTOs ──────────────────────

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
