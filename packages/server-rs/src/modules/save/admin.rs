use axum::Json;
use axum::extract::{Path, Query, State};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{DeleteResult, is_admin, verify_game_or_admin_access};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{SaveMetadata, fmt_ts, validate_str};

use super::handler::UpsertSaveInput;
use super::helpers::{SaveSlotOutput, SaveSlotRow, generate_share_code};

/// Row type for admin list query (join saves + users).
#[derive(sqlx::FromRow)]
struct AdminSaveListRow {
    id: Uuid,
    game_id: Uuid,
    user_id: Uuid,
    name: String,
    map_name: Option<String>,
    level: Option<i32>,
    player_name: Option<String>,
    screenshot: Option<String>,
    is_shared: bool,
    share_code: Option<String>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
    user_name: String,
}

/// Row type for admin get / shared save (join saves + users, includes data).
#[derive(sqlx::FromRow)]
struct AdminSaveDetailRow {
    id: Uuid,
    #[allow(dead_code)]
    game_id: Uuid,
    name: String,
    data: serde_json::Value,
    user_name: String,
    map_name: Option<String>,
    level: Option<i32>,
    player_name: Option<String>,
    screenshot: Option<String>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AdminListQuery {
    game_slug: Option<String>,
    user_id: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}

/// Typed output for a single admin save list item.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminSaveListItem {
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
    pub user_name: String,
}

impl From<&AdminSaveListRow> for AdminSaveListItem {
    fn from(r: &AdminSaveListRow) -> Self {
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
            user_name: r.user_name.clone(),
        }
    }
}

/// Paginated admin list response.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminListOutput {
    pub items: Vec<AdminSaveListItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

/// Typed output for admin save detail.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminSaveDetailOutput {
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

impl From<AdminSaveDetailRow> for AdminSaveDetailOutput {
    fn from(r: AdminSaveDetailRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            data: r.data,
            user_name: r.user_name,
            map_name: r.map_name,
            level: r.level,
            player_name: r.player_name,
            screenshot: r.screenshot,
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

pub async fn admin_list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<AdminListQuery>,
) -> ApiResult<Json<AdminListOutput>> {
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    // Auth: if game_slug provided, verify game access or admin; otherwise require admin role
    let game_id: Option<Uuid> = if let Some(ref slug) = q.game_slug {
        Some(verify_game_or_admin_access(&state, slug, auth.0).await?)
    } else {
        if !is_admin(&state, auth.0).await? {
            return Err(ApiError::forbidden("需要管理员权限"));
        }
        None
    };

    // Parse user_id filter safely
    let user_id: Option<Uuid> = if let Some(ref uid) = q.user_id {
        Some(Uuid::parse_str(uid).map_err(|_| ApiError::bad_request("无效的用户ID"))?)
    } else {
        None
    };

    // Parameterized query with optional filters
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM saves WHERE ($1::uuid IS NULL OR saves.game_id = $1) AND ($2::uuid IS NULL OR saves.user_id = $2)",
    )
    .bind(game_id)
    .bind(user_id)
    .fetch_one(&state.db.pool)
    .await?;

    let rows = sqlx::query_as::<_, AdminSaveListRow>(
            "SELECT saves.id, saves.game_id, saves.user_id, saves.name, saves.map_name, saves.level, \
             saves.player_name, saves.screenshot, saves.is_shared, saves.share_code, \
             saves.created_at, saves.updated_at, users.name AS user_name \
             FROM saves INNER JOIN users ON saves.user_id = users.id \
             WHERE ($1::uuid IS NULL OR saves.game_id = $1) AND ($2::uuid IS NULL OR saves.user_id = $2) \
             ORDER BY saves.created_at DESC LIMIT $3 OFFSET $4",
        )
        .bind(game_id)
        .bind(user_id)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&state.db.pool)
        .await?;

    let items: Vec<AdminSaveListItem> = rows.iter().map(AdminSaveListItem::from).collect();

    Ok(Json(AdminListOutput {
        items,
        total,
        page,
        page_size,
    }))
}

pub async fn admin_get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<AdminSaveDetailOutput>> {
    let row = sqlx::query_as::<_, AdminSaveDetailRow>(
        "SELECT saves.id, saves.game_id, saves.name, saves.data, users.name AS user_name, \
         saves.map_name, saves.level, saves.player_name, saves.screenshot, saves.updated_at \
         FROM saves INNER JOIN users ON saves.user_id = users.id WHERE saves.id = $1 LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?;

    let r = row.ok_or_else(|| ApiError::not_found("存档不存在"))?;

    // Verify admin or game access
    verify_game_or_admin_access(&state, &r.game_id.to_string(), auth.0).await?;

    Ok(Json(AdminSaveDetailOutput::from(r)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AdminCreateInput {
    game_slug: String,
    user_id: String,
    name: String,
    data: serde_json::Value,
    screenshot: Option<String>,
}

pub async fn admin_create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<AdminCreateInput>,
) -> ApiResult<Json<SaveSlotOutput>> {
    let game_id = verify_game_or_admin_access(&state, &input.game_slug, auth.0).await?;
    let user_id =
        Uuid::parse_str(&input.user_id).map_err(|_| ApiError::bad_request("无效的用户ID"))?;
    let name = validate_str(&input.name, "存档名称", 100)?;
    let meta = SaveMetadata::extract(&input.data);

    let row = sqlx::query_as::<_, SaveSlotRow>(
        "INSERT INTO saves (game_id, user_id, name, map_name, player_name, level, screenshot, data) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
    )
    .bind(game_id)
    .bind(user_id)
    .bind(&name)
    .bind(&meta.map_name)
    .bind(&meta.player_name)
    .bind(meta.level)
    .bind(&input.screenshot)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(SaveSlotOutput::from(row)))
}

pub async fn admin_update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpsertSaveInput>,
) -> ApiResult<Json<SaveSlotOutput>> {
    // Look up save's game_id and verify access
    let save_game_id: Option<Uuid> = sqlx::query_scalar("SELECT game_id FROM saves WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await?;
    let save_game_id = save_game_id.ok_or_else(|| ApiError::not_found("存档不存在"))?;
    verify_game_or_admin_access(&state, &save_game_id.to_string(), auth.0).await?;

    let name = validate_str(&input.name, "存档名称", 100)?;
    let meta = SaveMetadata::extract(&input.data);

    let row = sqlx::query_as::<_, SaveSlotRow>(
        "UPDATE saves SET name = $1, map_name = $2, player_name = $3, level = $4, screenshot = $5, data = $6, updated_at = NOW() \
         WHERE id = $7 \
         RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
    )
    .bind(&name)
    .bind(&meta.map_name)
    .bind(&meta.player_name)
    .bind(meta.level)
    .bind(&input.screenshot)
    .bind(&input.data)
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("存档不存在"))?;

    Ok(Json(SaveSlotOutput::from(row)))
}

pub async fn admin_delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<DeleteResult>> {
    // Look up save's game_id and verify access
    let save_game_id: Option<Uuid> = sqlx::query_scalar("SELECT game_id FROM saves WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await?;
    let save_game_id = save_game_id.ok_or_else(|| ApiError::not_found("存档不存在"))?;
    verify_game_or_admin_access(&state, &save_game_id.to_string(), auth.0).await?;

    let result = sqlx::query("DELETE FROM saves WHERE id = $1")
        .bind(id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("存档不存在"));
    }
    Ok(Json(DeleteResult { id }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShareInput {
    is_shared: bool,
}

pub async fn admin_share(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<ShareInput>,
) -> ApiResult<Json<SaveSlotOutput>> {
    let existing = sqlx::query_as::<_, SaveSlotRow>(
        "SELECT id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at \
         FROM saves WHERE id = $1 LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("存档不存在"))?;

    // Verify admin or game access
    verify_game_or_admin_access(&state, &existing.game_id.to_string(), auth.0).await?;

    let share_code = if input.is_shared {
        existing.share_code.or_else(|| Some(generate_share_code()))
    } else {
        existing.share_code
    };

    let row = sqlx::query_as::<_, SaveSlotRow>(
        "UPDATE saves SET is_shared = $1, share_code = $2, updated_at = NOW() WHERE id = $3 \
         RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
    )
    .bind(input.is_shared)
    .bind(&share_code)
    .bind(id)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(SaveSlotOutput::from(row)))
}
