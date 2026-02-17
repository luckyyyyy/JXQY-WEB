//! Authentication extractors — extract user from session cookie.

use axum::extract::FromRequestParts;
use axum::http::HeaderMap;
use axum::http::request::Parts;
use chrono::Utc;
use uuid::Uuid;

use crate::db::DEMO_DEV_USER_ID;
use crate::error::ApiError;
use crate::state::AppState;

pub const SESSION_COOKIE_NAME: &str = "SESSION_ID";

/// Extract session cookie value from headers.
pub fn get_cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    let cookie_header = headers.get("cookie")?.to_str().ok()?;
    cookie_header
        .split(';')
        .map(|s| s.trim())
        .find(|s| s.starts_with(&format!("{name}=")))
        .map(|s| {
            let value = &s[name.len() + 1..];
            urlencoding::decode(value)
                .unwrap_or_else(|_| value.into())
                .into_owned()
        })
}

/// Resolve user ID from session cookie.
///
/// Dev mode fallback: only when NO cookie is present (not when an invalid cookie is given).
pub async fn resolve_user_id(state: &AppState, headers: &HeaderMap) -> Option<Uuid> {
    let session_id = get_cookie_value(headers, SESSION_COOKIE_NAME);

    if let Some(session_id) = session_id {
        // A session cookie was provided — it MUST be valid (no dev fallback)
        let session_uuid: Uuid = session_id.parse().ok()?;
        let user_id: Option<Uuid> = sqlx::query_scalar(
            "SELECT user_id FROM sessions WHERE id = $1 AND expires_at > $2 LIMIT 1",
        )
        .bind(session_uuid)
        .bind(Utc::now())
        .fetch_optional(&state.db.pool)
        .await
        .ok()?;
        return user_id;
    }

    // No session cookie — dev auto-login only if explicitly enabled
    if state.config.dev_auto_login {
        tracing::debug!("Dev auto-login: authenticating as demo user (no session cookie)");
        return Some(DEMO_DEV_USER_ID.parse().unwrap());
    }

    None
}

/// Authenticated user extractor. Returns 401 if no valid session.
///
/// Usage: add `auth: AuthUser` to any handler that requires authentication.
/// No middleware layer needed — just declare it as a handler parameter.
#[derive(Clone, Debug)]
pub struct AuthUser(pub Uuid);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let user_id = resolve_user_id(state, &parts.headers)
            .await
            .ok_or_else(|| ApiError::unauthorized("请先登录"))?;
        Ok(AuthUser(user_id))
    }
}

/// Optional auth extractor — returns `None` if not authenticated (no error).
#[derive(Clone, Debug)]
pub struct OptionalAuth(pub Option<Uuid>);

impl FromRequestParts<AppState> for OptionalAuth {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let user_id = resolve_user_id(state, &parts.headers).await;
        Ok(OptionalAuth(user_id))
    }
}
