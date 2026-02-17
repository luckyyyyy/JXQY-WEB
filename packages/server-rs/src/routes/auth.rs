//! Auth routes: login, register, logout.

use argon2::password_hash::SaltString;
use argon2::password_hash::rand_core::OsRng;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::{Json, Router};
use chrono::Utc;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::{AuthOutput, LoginInput, LogoutOutput, RegisterInput, UserOutput};
use crate::state::AppState;

use super::crud::{ensure_unique_slug, slugify};
use super::middleware::{SESSION_COOKIE_NAME, get_cookie_value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", axum::routing::post(login))
        .route("/register", axum::routing::post(register))
        .route("/logout", axum::routing::post(logout))
}

async fn login(
    State(state): State<AppState>,
    _headers: HeaderMap,
    Json(input): Json<LoginInput>,
) -> ApiResult<impl IntoResponse> {
    let user: Option<crate::models::User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&input.email)
        .fetch_optional(&state.db.pool)
        .await?;

    let user = user.ok_or_else(|| ApiError::bad_request("邮箱或密码错误"))?;

    // Verify password with argon2 (with legacy plain-text migration)
    if !verify_and_upgrade_password(
        &state.db.pool,
        user.id,
        &input.password,
        &user.password_hash,
    )
    .await?
    {
        return Err(ApiError::bad_request("邮箱或密码错误"));
    }

    // Get default game slug
    let default_game_slug: Option<String> = sqlx::query_scalar(
        r#"
        SELECT g.slug FROM game_members gm
        JOIN games g ON gm.game_id = g.id
        WHERE gm.user_id = $1
        ORDER BY g.created_at
        LIMIT 1
        "#,
    )
    .bind(user.id)
    .fetch_optional(&state.db.pool)
    .await?;

    // Create session
    let session_id = create_session(&state, user.id).await?;

    let mut response = Json(AuthOutput {
        user: UserOutput::from(user),
        default_game_slug,
    })
    .into_response();

    set_session_cookie(&state, &mut response, &session_id.to_string());

    Ok(response)
}

async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterInput>,
) -> ApiResult<impl IntoResponse> {
    // Input validation
    if input.name.trim().is_empty() || input.name.len() > 50 {
        return Err(ApiError::bad_request("名称长度应在1-50个字符之间"));
    }
    if !input.email.contains('@') || input.email.len() > 255 {
        return Err(ApiError::bad_request("邮箱格式不正确"));
    }
    if input.password.len() < 6 || input.password.len() > 128 {
        return Err(ApiError::bad_request("密码长度应在6-128个字符之间"));
    }

    // Check if email already exists
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
        .bind(&input.email)
        .fetch_one(&state.db.pool)
        .await?;

    if exists {
        return Err(ApiError::bad_request("邮箱已被注册"));
    }

    let game_name = format!("{}的游戏", input.name);
    let game_slug = ensure_unique_slug(&state, &slugify(&game_name)).await?;

    // Transaction: create user + game + membership
    let mut tx = state.db.pool.begin().await?;

    let user: crate::models::User = sqlx::query_as(
        r#"
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, 'user')
        RETURNING *
        "#,
    )
    .bind(&input.name)
    .bind(&input.email)
    .bind(&hash_password(&input.password)?)
    .fetch_one(&mut *tx)
    .await?;

    let game: crate::models::Game = sqlx::query_as(
        r#"
        INSERT INTO games (slug, name, description, owner_id)
        VALUES ($1, $2, '默认游戏', $3)
        RETURNING *
        "#,
    )
    .bind(&game_slug)
    .bind(&game_name)
    .bind(user.id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("INSERT INTO game_members (game_id, user_id, role) VALUES ($1, $2, 'owner')")
        .bind(game.id)
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    // Create session
    let session_id = create_session(&state, user.id).await?;

    let mut response = Json(AuthOutput {
        user: UserOutput::from(user),
        default_game_slug: Some(game.slug),
    })
    .into_response();

    set_session_cookie(&state, &mut response, &session_id.to_string());

    Ok(response)
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<impl IntoResponse> {
    if let Some(session_id) = get_cookie_value(&headers, SESSION_COOKIE_NAME) {
        if let Ok(uuid) = Uuid::parse_str(&session_id) {
            sqlx::query("DELETE FROM sessions WHERE id = $1")
                .bind(uuid)
                .execute(&state.db.pool)
                .await
                .ok();
        }
    }

    let mut response = Json(LogoutOutput { success: true }).into_response();
    clear_session_cookie(&state, &mut response);
    Ok(response)
}

// ── Helpers ────────────────────────────────────────

async fn create_session(state: &AppState, user_id: Uuid) -> ApiResult<Uuid> {
    let expires_at =
        Utc::now() + chrono::Duration::seconds(state.config.session_cookie_max_age_secs);

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id",
    )
    .bind(user_id)
    .bind(expires_at)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(id)
}

fn set_session_cookie(state: &AppState, response: &mut axum::response::Response, session_id: &str) {
    let secure = if state.config.session_cookie_secure {
        "; Secure"
    } else {
        ""
    };
    let max_age = state.config.session_cookie_max_age_secs;
    let cookie = format!(
        "{SESSION_COOKIE_NAME}={session_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}{secure}"
    );
    response
        .headers_mut()
        .append("set-cookie", cookie.parse().unwrap());
}

fn clear_session_cookie(state: &AppState, response: &mut axum::response::Response) {
    let secure = if state.config.session_cookie_secure {
        "; Secure"
    } else {
        ""
    };
    let cookie =
        format!("{SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure}");
    response
        .headers_mut()
        .append("set-cookie", cookie.parse().unwrap());
}

// ── Password hashing ───────────────────────────────

/// Hash a password with argon2.
pub fn hash_password(password: &str) -> ApiResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| ApiError::internal(format!("Password hash failed: {e}")))
}

/// Verify a password against a stored hash.
/// Supports legacy plain-text hashes: if argon2 parsing fails,
/// falls back to plain-text comparison and upgrades the hash in-place.
pub async fn verify_and_upgrade_password(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    password: &str,
    stored_hash: &str,
) -> ApiResult<bool> {
    // Try argon2 verification first
    if let Ok(parsed_hash) = PasswordHash::new(stored_hash) {
        return Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok());
    }

    // Fallback: legacy plain-text comparison (for migration from old data)
    if stored_hash == password {
        // Upgrade to argon2 hash transparently
        if let Ok(new_hash) = hash_password(password) {
            let _ = sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
                .bind(&new_hash)
                .bind(user_id)
                .execute(pool)
                .await;
            tracing::info!("Upgraded password hash for user {user_id}");
        }
        return Ok(true);
    }

    Ok(false)
}
