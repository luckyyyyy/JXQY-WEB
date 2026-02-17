//! Auth service: business logic for login, register, logout.
//! No axum/HTTP dependencies — pure DB + crypto operations.

use argon2::password_hash::SaltString;
use argon2::password_hash::rand_core::OsRng;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::Utc;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::{AuthOutput, User, UserOutput};
use crate::modules::crud::{ensure_unique_slug, slugify};
use crate::state::AppState;
use crate::utils::{validate_email, validate_password, validate_str};

/// Result of a successful login/register — caller adds the cookie.
pub struct AuthResult {
    pub output: AuthOutput,
    pub session_id: Uuid,
}

/// Authenticate a user by email/password, creating a new session.
pub async fn login(state: &AppState, email: &str, password: &str) -> ApiResult<AuthResult> {
    let user: Option<User> = sqlx::query_as(
        "SELECT id, name, email, password_hash, email_verified, settings, role, created_at \
         FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(&state.db.pool)
    .await?;

    let user = user.ok_or_else(|| ApiError::bad_request("邮箱或密码错误"))?;

    if !verify_and_upgrade_password(&state.db.pool, user.id, password, &user.password_hash).await? {
        return Err(ApiError::bad_request("邮箱或密码错误"));
    }

    let default_game_slug: Option<String> = sqlx::query_scalar(
        "SELECT g.slug FROM game_members gm \
         JOIN games g ON gm.game_id = g.id \
         WHERE gm.user_id = $1 ORDER BY g.created_at LIMIT 1",
    )
    .bind(user.id)
    .fetch_optional(&state.db.pool)
    .await?;

    let session_id = create_session(state, user.id).await?;

    Ok(AuthResult {
        output: AuthOutput {
            user: UserOutput::from(user),
            default_game_slug,
        },
        session_id,
    })
}

/// Register a new user, auto-create a default game, and return a session.
pub async fn register(
    state: &AppState,
    name: &str,
    email: &str,
    password: &str,
) -> ApiResult<AuthResult> {
    let name = validate_str(name, "名称", 50)?;
    let email = validate_email(email)?;
    validate_password(password)?;

    // Check uniqueness
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
        .bind(&email)
        .fetch_one(&state.db.pool)
        .await?;
    if exists {
        return Err(ApiError::bad_request("邮箱已被注册"));
    }

    let game_name = format!("{}的游戏", name);
    let game_slug = ensure_unique_slug(state, &slugify(&game_name)).await?;

    // Transaction: create user + game + membership
    let mut tx = state.db.pool.begin().await?;

    let user: User = sqlx::query_as(
        "INSERT INTO users (name, email, password_hash, role) \
         VALUES ($1, $2, $3, 'user') \
         RETURNING id, name, email, password_hash, email_verified, settings, role, created_at",
    )
    .bind(&name)
    .bind(&email)
    .bind(&hash_password(password)?)
    .fetch_one(&mut *tx)
    .await?;

    let game: crate::models::Game = sqlx::query_as(
        "INSERT INTO games (slug, name, description, owner_id) \
         VALUES ($1, $2, '默认游戏', $3) \
         RETURNING id, slug, name, description, owner_id, created_at",
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

    let session_id = create_session(state, user.id).await?;

    Ok(AuthResult {
        output: AuthOutput {
            user: UserOutput::from(user),
            default_game_slug: Some(game.slug),
        },
        session_id,
    })
}

/// Delete the session identified by the given UUID string.
pub async fn logout(pool: &sqlx::PgPool, session_id: &str) -> ApiResult<()> {
    if let Ok(uuid) = Uuid::parse_str(session_id) {
        sqlx::query("DELETE FROM sessions WHERE id = $1")
            .bind(uuid)
            .execute(pool)
            .await
            .ok();
    }
    Ok(())
}

// ── Internal helpers ───────────────────────────────

/// Create a new session row, returning its UUID.
pub async fn create_session(state: &AppState, user_id: Uuid) -> ApiResult<Uuid> {
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

/// Hash a password with argon2.
pub fn hash_password(password: &str) -> ApiResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| ApiError::internal(format!("Password hash failed: {e}")))
}

/// Verify a password; auto-upgrade legacy plain-text hashes to argon2.
pub async fn verify_and_upgrade_password(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    password: &str,
    stored_hash: &str,
) -> ApiResult<bool> {
    if let Ok(parsed_hash) = PasswordHash::new(stored_hash) {
        return Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok());
    }

    // Fallback: legacy plain-text comparison (constant-time)
    let password_bytes = password.as_bytes();
    let stored_bytes = stored_hash.as_bytes();
    let is_match = password_bytes.len() == stored_bytes.len()
        && password_bytes
            .iter()
            .zip(stored_bytes.iter())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0;
    if is_match {
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
