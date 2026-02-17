//! Game CRUD routes.

use axum::body::Body;
use axum::extract::{Multipart, Query, State};
use axum::http::{StatusCode, header};
use axum::response::Response;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::{CreateGameInput, GameOutput, UpdateGameInput};
use crate::state::AppState;
use crate::utils::validate_str;

use crate::modules::crud::{DeleteResult, SuccessResult, ensure_unique_slug, resolve_game_id_by_slug, slugify, verify_game_access};
use crate::modules::middleware::AuthUser;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/validate", axum::routing::get(validate))
        .route("/", axum::routing::get(list).post(create))
        .route(
            "/{id}",
            axum::routing::get(get_by_id).put(update).delete(delete),
        )
        .route("/by-slug/{slug}", axum::routing::get(get_by_slug))
}

#[derive(Deserialize)]
struct ValidateQuery {
    slug: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateOutput {
    pub exists: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

async fn validate(
    State(state): State<AppState>,
    Query(q): Query<ValidateQuery>,
) -> ApiResult<Json<ValidateOutput>> {
    let game: Option<crate::models::Game> = sqlx::query_as(
        "SELECT id, slug, name, description, owner_id, created_at FROM games WHERE slug = $1 LIMIT 1",
    )
    .bind(&q.slug)
    .fetch_optional(&state.db.pool)
    .await?;

    match game {
        Some(g) => Ok(Json(ValidateOutput {
            exists: true,
            name: Some(g.name),
            description: g.description,
        })),
        None => Ok(Json(ValidateOutput {
            exists: false,
            name: None,
            description: None,
        })),
    }
}

async fn list(State(state): State<AppState>, auth: AuthUser) -> ApiResult<Json<Vec<GameOutput>>> {
    let games: Vec<crate::models::Game> = sqlx::query_as(
        r#"
        SELECT g.id, g.slug, g.name, g.description, g.owner_id, g.created_at FROM game_members gm
        JOIN games g ON gm.game_id = g.id
        WHERE gm.user_id = $1
        "#,
    )
    .bind(auth.0)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(Json(games.into_iter().map(GameOutput::from).collect()))
}

async fn get_by_id(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> ApiResult<Json<Option<GameOutput>>> {
    let game: Option<crate::models::Game> = sqlx::query_as(
        r#"
        SELECT g.id, g.slug, g.name, g.description, g.owner_id, g.created_at FROM game_members gm
        JOIN games g ON gm.game_id = g.id
        WHERE gm.user_id = $1 AND g.id = $2
        LIMIT 1
        "#,
    )
    .bind(auth.0)
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?;

    Ok(Json(game.map(GameOutput::from)))
}

async fn get_by_slug(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(slug): axum::extract::Path<String>,
) -> ApiResult<Json<Option<GameOutput>>> {
    let game: Option<crate::models::Game> = sqlx::query_as(
        r#"
        SELECT g.id, g.slug, g.name, g.description, g.owner_id, g.created_at FROM game_members gm
        JOIN games g ON gm.game_id = g.id
        WHERE gm.user_id = $1 AND g.slug = $2
        LIMIT 1
        "#,
    )
    .bind(auth.0)
    .bind(&slug)
    .fetch_optional(&state.db.pool)
    .await?;

    Ok(Json(game.map(GameOutput::from)))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateGameInput>,
) -> ApiResult<Json<GameOutput>> {
    let name = validate_str(&input.name, "游戏名称", 100)?;
    if let Some(ref desc) = input.description {
        if desc.len() > 1000 {
            return Err(ApiError::bad_request("描述不能超过1000个字符"));
        }
    }
    let base_slug = input
        .slug
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| slugify(s))
        .unwrap_or_else(|| slugify(&name));
    let slug = ensure_unique_slug(&state, &base_slug).await?;

    let mut tx = state.db.pool.begin().await?;

    let game: crate::models::Game = sqlx::query_as(
        r#"
        INSERT INTO games (name, slug, description, owner_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, slug, name, description, owner_id, created_at
        "#,
    )
    .bind(&name)
    .bind(&slug)
    .bind(&input.description)
    .bind(auth.0)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("INSERT INTO game_members (game_id, user_id, role) VALUES ($1, $2, 'owner')")
        .bind(game.id)
        .bind(auth.0)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(GameOutput::from(game)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
    Json(input): Json<UpdateGameInput>,
) -> ApiResult<Json<GameOutput>> {
    if let Some(ref n) = input.name {
        validate_str(n, "游戏名称", 100)?;
    }
    if let Some(ref desc) = input.description {
        if desc.len() > 1000 {
            return Err(ApiError::bad_request("描述不能超过1000个字符"));
        }
    }

    let game: crate::models::Game = sqlx::query_as(
        "SELECT id, slug, name, description, owner_id, created_at FROM games WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("游戏不存在"))?;

    if game.owner_id != Some(auth.0) {
        return Err(ApiError::forbidden("只有所有者可以修改游戏"));
    }

    let new_name = input.name.as_deref().unwrap_or(&game.name);
    let new_description = input.description.as_deref().or(game.description.as_deref());
    let new_slug = if let Some(ref s) = input.slug {
        if s != &game.slug {
            let exists: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM games WHERE slug = $1)")
                    .bind(s)
                    .fetch_one(&state.db.pool)
                    .await?;
            if exists {
                return Err(ApiError::bad_request("Slug 已被使用"));
            }
            s.as_str()
        } else {
            &game.slug
        }
    } else {
        &game.slug
    };

    let updated: crate::models::Game = sqlx::query_as(
        "UPDATE games SET name = $1, slug = $2, description = $3 WHERE id = $4 RETURNING id, slug, name, description, owner_id, created_at",
    )
    .bind(new_name)
    .bind(new_slug)
    .bind(new_description)
    .bind(id)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(GameOutput::from(updated)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> ApiResult<Json<DeleteResult>> {
    let game: crate::models::Game = sqlx::query_as(
        "SELECT id, slug, name, description, owner_id, created_at FROM games WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("游戏不存在"))?;

    if game.owner_id != Some(auth.0) {
        return Err(ApiError::forbidden("只有所有者可以删除游戏"));
    }

    sqlx::query("DELETE FROM games WHERE id = $1")
        .bind(id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(DeleteResult { id }))
}

// ===== Logo handlers (auth checked manually for POST/DELETE) =====

pub async fn serve_logo(
    State(state): State<AppState>,
    axum::extract::Path(slug): axum::extract::Path<String>,
) -> Result<Response, ApiError> {
    let game_id = resolve_game_id_by_slug(&state, &slug).await?;

    let logo_key = format!("games/{game_id}/_logo");

    let bytes = state
        .storage
        .download_file(&logo_key)
        .await
        .map_err(|e| ApiError::not_found(format!("Logo not found: {e}")))?;

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "public, max-age=3600")
        .header(header::CONTENT_LENGTH, bytes.len())
        .body(Body::from(bytes))
        .map_err(|e| ApiError::internal(format!("Failed to build response: {e}")))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoUrlOutput {
    pub logo_url: String,
}

pub async fn upload_logo(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(slug): axum::extract::Path<String>,
    mut multipart: Multipart,
) -> ApiResult<Json<LogoUrlOutput>> {
    let game_id = verify_game_access(&state, &slug, auth.0).await?;

    let field = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::bad_request(format!("Invalid multipart: {e}")))?
        .ok_or_else(|| ApiError::bad_request("No file field"))?;

    let content_type = field
        .content_type()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "image/png".to_string());
    let data = field
        .bytes()
        .await
        .map_err(|e| ApiError::bad_request(format!("Failed to read file: {e}")))?;

    let logo_key = format!("games/{game_id}/_logo");

    state
        .storage
        .upload_file(&logo_key, data.to_vec(), Some(&content_type))
        .await
        .map_err(|e| ApiError::internal(format!("S3 upload failed: {e}")))?;

    // Upsert logoUrl into game_configs (store API path, not S3 key)
    let logo_url = format!("/game/{slug}/api/logo");
    sqlx::query(
        "INSERT INTO game_configs (game_id, data) VALUES ($1, $2) \
         ON CONFLICT (game_id) DO UPDATE SET data = game_configs.data || $2, updated_at = NOW()",
    )
    .bind(game_id)
    .bind(serde_json::json!({ "logoUrl": logo_url }))
    .execute(&state.db.pool)
    .await?;

    Ok(Json(LogoUrlOutput { logo_url }))
}

pub async fn delete_logo(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(slug): axum::extract::Path<String>,
) -> ApiResult<Json<SuccessResult>> {
    let game_id = verify_game_access(&state, &slug, auth.0).await?;

    let logo_key = format!("games/{game_id}/_logo");

    // Delete from S3 (ignore if not exists)
    let _ = state.storage.delete_file(&logo_key).await;

    // Clear logoUrl in game_configs (set to empty string like NestJS)
    sqlx::query(
        r#"UPDATE game_configs SET data = jsonb_set(data, '{logoUrl}', '""'::jsonb), updated_at = NOW() WHERE game_id = $1"#,
    )
    .bind(game_id)
    .execute(&state.db.pool)
    .await?;

    Ok(Json(SuccessResult { success: true }))
}
