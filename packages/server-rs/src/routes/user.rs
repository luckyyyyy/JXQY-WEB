//! User routes: profile, settings, email verification.

use axum::extract::State;
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::UserOutput;
use crate::state::AppState;

use super::auth::{hash_password, verify_and_upgrade_password};
use super::middleware::AuthUser;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/profile", axum::routing::get(get_profile).put(update_profile))
        .route("/settings", axum::routing::put(update_settings))
        .route("/password", axum::routing::put(change_password))
        .route("/name", axum::routing::put(change_name))
        .route("/avatar", axum::routing::delete(delete_avatar))
        .route("/email/send-verify", axum::routing::post(send_verify_email))
        .route(
            "/email/request-change",
            axum::routing::post(request_email_change),
        )
        .route("/email/verify", axum::routing::post(verify_email))
        .route(
            "/email/confirm-change",
            axum::routing::post(confirm_email_change),
        )
}

async fn get_profile(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<UserOutput>> {
    let user: crate::models::User =
        sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(auth.0)
            .fetch_optional(&state.db.pool)
            .await?
            .ok_or_else(|| ApiError::not_found("用户不存在"))?;

    Ok(Json(UserOutput::from(user)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSettingsInput {
    settings: serde_json::Value,
}

async fn update_settings(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpdateSettingsInput>,
) -> ApiResult<Json<UserOutput>> {
    let user: crate::models::User = sqlx::query_as(
        "UPDATE users SET settings = $1 WHERE id = $2 RETURNING *",
    )
    .bind(&input.settings)
    .bind(auth.0)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(UserOutput::from(user)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangePasswordInput {
    current_password: String,
    new_password: String,
}

async fn change_password(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ChangePasswordInput>,
) -> ApiResult<Json<serde_json::Value>> {
    if input.new_password.len() < 6 || input.new_password.len() > 128 {
        return Err(ApiError::bad_request("新密码长度应在6-128个字符之间"));
    }

    let user: crate::models::User =
        sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(auth.0)
            .fetch_one(&state.db.pool)
            .await?;

    // Verify current password (supports legacy plain-text migration)
    if !verify_and_upgrade_password(
        &state.db.pool,
        user.id,
        &input.current_password,
        &user.password_hash,
    )
    .await?
    {
        return Err(ApiError::bad_request("当前密码错误"));
    }

    // Hash new password with argon2
    let new_hash = hash_password(&input.new_password)?;
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(auth.0)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(serde_json::json!({"success": true})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProfileInput {
    name: Option<String>,
    settings: Option<serde_json::Value>,
}

async fn update_profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpdateProfileInput>,
) -> ApiResult<Json<UserOutput>> {
    if let Some(ref name) = input.name {
        sqlx::query("UPDATE users SET name = $1 WHERE id = $2")
            .bind(name)
            .bind(auth.0)
            .execute(&state.db.pool)
            .await?;
    }
    if let Some(ref settings) = input.settings {
        sqlx::query("UPDATE users SET settings = $1 WHERE id = $2")
            .bind(settings)
            .bind(auth.0)
            .execute(&state.db.pool)
            .await?;
    }

    let user: crate::models::User =
        sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(auth.0)
            .fetch_one(&state.db.pool)
            .await?;

    Ok(Json(UserOutput::from(user)))
}

async fn delete_avatar(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<UserOutput>> {
    // Set settings.avatarUrl = null (remove the key via jsonb_set or coalesce)
    let user: crate::models::User = sqlx::query_as(
        "UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || '{\"avatarUrl\": null}'::jsonb WHERE id = $1 RETURNING *",
    )
    .bind(auth.0)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(UserOutput::from(user)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeNameInput {
    name: String,
}

async fn change_name(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ChangeNameInput>,
) -> ApiResult<Json<UserOutput>> {
    let user: crate::models::User = sqlx::query_as(
        "UPDATE users SET name = $1 WHERE id = $2 RETURNING *",
    )
    .bind(&input.name)
    .bind(auth.0)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(UserOutput::from(user)))
}

async fn send_verify_email(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<serde_json::Value>> {
    let user: crate::models::User =
        sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(auth.0)
            .fetch_one(&state.db.pool)
            .await?;

    if user.email_verified {
        return Err(ApiError::bad_request("邮箱已验证"));
    }

    let token = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);

    sqlx::query(
        "INSERT INTO email_tokens (user_id, token, type, expires_at) VALUES ($1, $2, 'verify', $3)",
    )
    .bind(auth.0)
    .bind(&token)
    .bind(expires_at)
    .execute(&state.db.pool)
    .await?;

    // TODO: Send email via SMTP (lettre)
    tracing::info!("Verify email token for {}: {token}", user.email);

    Ok(Json(serde_json::json!({"success": true})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyEmailInput {
    token: String,
}

/// Public — no auth required. Users click the link in their email.
async fn verify_email(
    State(state): State<AppState>,
    Json(input): Json<VerifyEmailInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let token: Option<crate::models::EmailToken> = sqlx::query_as(
        "SELECT * FROM email_tokens WHERE token = $1 AND type = 'verify' AND expires_at > NOW()",
    )
    .bind(&input.token)
    .fetch_optional(&state.db.pool)
    .await?;

    let token = token.ok_or_else(|| ApiError::bad_request("无效或过期的验证链接"))?;

    sqlx::query("UPDATE users SET email_verified = true WHERE id = $1")
        .bind(token.user_id)
        .execute(&state.db.pool)
        .await?;

    sqlx::query("DELETE FROM email_tokens WHERE id = $1")
        .bind(token.id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(serde_json::json!({"success": true})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestEmailChangeInput {
    new_email: String,
}

async fn request_email_change(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<RequestEmailChangeInput>,
) -> ApiResult<Json<serde_json::Value>> {
    // Check if the new email is already taken
    let existing: Option<crate::models::User> =
        sqlx::query_as("SELECT * FROM users WHERE email = $1")
            .bind(&input.new_email)
            .fetch_optional(&state.db.pool)
            .await?;

    if existing.is_some() {
        return Err(ApiError::bad_request("该邮箱已被使用"));
    }

    let token = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);

    sqlx::query(
        "INSERT INTO email_tokens (user_id, token, type, new_email, expires_at) VALUES ($1, $2, 'change', $3, $4)",
    )
    .bind(auth.0)
    .bind(&token)
    .bind(&input.new_email)
    .bind(expires_at)
    .execute(&state.db.pool)
    .await?;

    // TODO: Send email via SMTP (lettre)
    tracing::info!("Email change token for user {}: {token}", auth.0);

    Ok(Json(serde_json::json!({"success": true})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmEmailChangeInput {
    token: String,
}

/// Public — no auth required. Users click the link in their email.
async fn confirm_email_change(
    State(state): State<AppState>,
    Json(input): Json<ConfirmEmailChangeInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let token: Option<crate::models::EmailToken> = sqlx::query_as(
        "SELECT * FROM email_tokens WHERE token = $1 AND type = 'change' AND expires_at > NOW()",
    )
    .bind(&input.token)
    .fetch_optional(&state.db.pool)
    .await?;

    let token = token.ok_or_else(|| ApiError::bad_request("无效或过期的验证链接"))?;

    let new_email = token
        .new_email
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("令牌缺少新邮箱信息"))?;

    // Check again that the email isn't taken (race condition guard)
    let existing: Option<crate::models::User> =
        sqlx::query_as("SELECT * FROM users WHERE email = $1")
            .bind(new_email)
            .fetch_optional(&state.db.pool)
            .await?;

    if existing.is_some() {
        return Err(ApiError::bad_request("该邮箱已被使用"));
    }

    sqlx::query("UPDATE users SET email = $1 WHERE id = $2")
        .bind(new_email)
        .bind(token.user_id)
        .execute(&state.db.pool)
        .await?;

    sqlx::query("DELETE FROM email_tokens WHERE id = $1")
        .bind(token.id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(serde_json::json!({"success": true})))
}
