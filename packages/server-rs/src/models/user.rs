use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

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
