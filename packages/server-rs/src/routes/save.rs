use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use rand::Rng;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{is_admin, resolve_game_id, resolve_game_id_by_slug, verify_game_or_admin_access};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

#[derive(sqlx::FromRow)]

struct SaveRow {
    id: Uuid,
    game_id: Uuid,
    _user_id: Uuid,
    name: String,
    map_name: Option<String>,
    level: Option<i32>,
    player_name: Option<String>,
    screenshot: Option<String>,
    is_shared: bool,
    share_code: Option<String>,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(sqlx::FromRow)]
struct SaveSlotRow {
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
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list))
        .route("/{id}", axum::routing::get(get).delete(delete))
        .route("/upsert", axum::routing::post(upsert))
        .route("/share", axum::routing::post(share))
        .route("/admin", axum::routing::get(admin_list))
        .route("/admin/{id}", axum::routing::get(admin_get).put(admin_update).delete(admin_delete))
        .route("/admin/create", axum::routing::post(admin_create))
        .route("/admin/{id}/share", axum::routing::post(admin_share))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListSaveQuery {
    game_slug: String,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListSaveQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = resolve_game_id(&state, &q.game_slug).await?;
    let rows = sqlx::query_as::<_, SaveSlotRow>(
        "SELECT id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at \
         FROM saves WHERE game_id = $1 AND user_id = $2 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .bind(auth.0)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(Json(rows.iter().map(to_slot).collect()))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<serde_json::Value>> {
    let row = sqlx::query_as::<_, SaveRow>(
        "SELECT * FROM saves WHERE id = $1 AND user_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("存档不存在"))?;
    Ok(Json(to_save_data(&row)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertSaveInput {
    game_slug: String,
    save_id: Option<String>,
    name: String,
    data: serde_json::Value,
    screenshot: Option<String>,
}

async fn upsert(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpsertSaveInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id(&state, &input.game_slug).await?;

    // Extract metadata from data
    let map_name = input.data.get("mapFileName").and_then(|v| v.as_str()).map(String::from);
    let player_name = input
        .data
        .get("player")
        .and_then(|p| p.get("name"))
        .and_then(|v| v.as_str())
        .map(String::from);
    let level = input
        .data
        .get("player")
        .and_then(|p| p.get("level"))
        .and_then(|v| v.as_i64())
        .map(|l| l as i32);

    if let Some(ref save_id_str) = input.save_id {
        let save_id = Uuid::parse_str(save_id_str)
            .map_err(|_| ApiError::bad_request("无效的存档ID"))?;

        // Verify ownership
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM saves WHERE id = $1 AND user_id = $2)",
        )
        .bind(save_id)
        .bind(auth.0)
        .fetch_one(&state.db.pool)
        .await?;

        if !exists {
            return Err(ApiError::not_found("存档不存在"));
        }

        let row = sqlx::query_as::<_, SaveSlotRow>(
            "UPDATE saves SET name = $1, map_name = $2, player_name = $3, level = $4, screenshot = $5, data = $6, updated_at = NOW() \
             WHERE id = $7 \
             RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
        )
        .bind(&input.name)
        .bind(&map_name)
        .bind(&player_name)
        .bind(level)
        .bind(&input.screenshot)
        .bind(&input.data)
        .bind(save_id)
        .fetch_one(&state.db.pool)
        .await?;

        Ok(Json(to_slot(&row)))
    } else {
        let row = sqlx::query_as::<_, SaveSlotRow>(
            "INSERT INTO saves (game_id, user_id, name, map_name, player_name, level, screenshot, data) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
             RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
        )
        .bind(game_id)
        .bind(auth.0)
        .bind(&input.name)
        .bind(&map_name)
        .bind(&player_name)
        .bind(level)
        .bind(&input.screenshot)
        .bind(&input.data)
        .fetch_one(&state.db.pool)
        .await?;

        Ok(Json(to_slot(&row)))
    }
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM saves WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.0)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("存档不存在"));
    }
    Ok(Json(serde_json::json!({"id": id})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShareInput {
    save_id: String,
    is_shared: bool,
}

async fn share(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ShareInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let save_id = Uuid::parse_str(&input.save_id)
        .map_err(|_| ApiError::bad_request("无效的存档ID"))?;

    // Get existing
    let existing = sqlx::query_as::<_, SaveSlotRow>(
        "SELECT id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at \
         FROM saves WHERE id = $1 AND user_id = $2 LIMIT 1",
    )
    .bind(save_id)
    .bind(auth.0)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("存档不存在"))?;

    // Generate share code if enabling sharing and no code exists
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
    .bind(save_id)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(to_slot(&row)))
}

pub async fn get_shared(
    State(state): State<AppState>,
    Path((game_slug, share_code)): Path<(String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;

    let row: Option<(Uuid, String, serde_json::Value, String, Option<String>, Option<i32>, Option<String>, Option<String>, Option<chrono::DateTime<chrono::Utc>>)> = sqlx::query_as(
        "SELECT saves.id, saves.name, saves.data, users.name, saves.map_name, saves.level, saves.player_name, saves.screenshot, saves.updated_at \
         FROM saves INNER JOIN users ON saves.user_id = users.id \
         WHERE saves.game_id = $1 AND saves.share_code = $2 AND saves.is_shared = true LIMIT 1",
    )
    .bind(game_id)
    .bind(&share_code)
    .fetch_optional(&state.db.pool)
    .await?;

    let (id, name, data, user_name, map_name, level, player_name, screenshot, updated_at) =
        row.ok_or_else(|| ApiError::not_found("共享存档不存在"))?;

    Ok(Json(serde_json::json!({
        "id": id,
        "name": name,
        "data": data,
        "userName": user_name,
        "mapName": map_name,
        "level": level,
        "playerName": player_name,
        "screenshot": screenshot,
        "updatedAt": updated_at.map(|d| d.to_rfc3339()),
    })))
}

// ===== Admin routes =====

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminListQuery {
    game_slug: Option<String>,
    user_id: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}

async fn admin_list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<AdminListQuery>,
) -> ApiResult<Json<serde_json::Value>> {
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

    let rows: Vec<(Uuid, Uuid, Uuid, String, Option<String>, Option<i32>, Option<String>, Option<String>, bool, Option<String>, Option<chrono::DateTime<chrono::Utc>>, Option<chrono::DateTime<chrono::Utc>>, String)> =
        sqlx::query_as(
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

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|(id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at, user_name)| {
            serde_json::json!({
                "id": id,
                "gameId": game_id,
                "userId": user_id,
                "name": name,
                "mapName": map_name,
                "level": level,
                "playerName": player_name,
                "screenshot": screenshot,
                "isShared": is_shared,
                "shareCode": share_code,
                "userName": user_name,
                "createdAt": created_at.map(|d| d.to_rfc3339()),
                "updatedAt": updated_at.map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    })))
}

async fn admin_get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<serde_json::Value>> {
    let row: Option<(Uuid, String, serde_json::Value, String, Option<String>, Option<i32>, Option<String>, Option<String>, Option<chrono::DateTime<chrono::Utc>>, Uuid)> = sqlx::query_as(
        "SELECT saves.id, saves.name, saves.data, users.name, saves.map_name, saves.level, saves.player_name, saves.screenshot, saves.updated_at, saves.game_id \
         FROM saves INNER JOIN users ON saves.user_id = users.id WHERE saves.id = $1 LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?;

    let (id, name, data, user_name, map_name, level, player_name, screenshot, updated_at, game_id) =
        row.ok_or_else(|| ApiError::not_found("存档不存在"))?;

    // Verify admin or game access
    verify_game_or_admin_access(&state, &game_id.to_string(), auth.0).await?;

    Ok(Json(serde_json::json!({
        "id": id,
        "name": name,
        "data": data,
        "userName": user_name,
        "mapName": map_name,
        "level": level,
        "playerName": player_name,
        "screenshot": screenshot,
        "updatedAt": updated_at.map(|d| d.to_rfc3339()),
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminCreateInput {
    game_slug: String,
    user_id: String,
    name: String,
    data: serde_json::Value,
    screenshot: Option<String>,
}

async fn admin_create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<AdminCreateInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_or_admin_access(&state, &input.game_slug, auth.0).await?;
    let user_id = Uuid::parse_str(&input.user_id)
        .map_err(|_| ApiError::bad_request("无效的用户ID"))?;
    let map_name = input.data.get("mapFileName").and_then(|v| v.as_str()).map(String::from);
    let player_name = input.data.get("player").and_then(|p| p.get("name")).and_then(|v| v.as_str()).map(String::from);
    let level = input.data.get("player").and_then(|p| p.get("level")).and_then(|v| v.as_i64()).map(|l| l as i32);

    let row = sqlx::query_as::<_, SaveSlotRow>(
        "INSERT INTO saves (game_id, user_id, name, map_name, player_name, level, screenshot, data) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
    )
    .bind(game_id)
    .bind(user_id)
    .bind(&input.name)
    .bind(&map_name)
    .bind(&player_name)
    .bind(level)
    .bind(&input.screenshot)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await?;

    Ok(Json(to_slot(&row)))
}

async fn admin_update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpsertSaveInput>,
) -> ApiResult<Json<serde_json::Value>> {
    // Look up save's game_id and verify access
    let save_game_id: Option<Uuid> = sqlx::query_scalar("SELECT game_id FROM saves WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await?;
    let save_game_id = save_game_id.ok_or_else(|| ApiError::not_found("存档不存在"))?;
    verify_game_or_admin_access(&state, &save_game_id.to_string(), auth.0).await?;

    let map_name = input.data.get("mapFileName").and_then(|v| v.as_str()).map(String::from);
    let player_name = input.data.get("player").and_then(|p| p.get("name")).and_then(|v| v.as_str()).map(String::from);
    let level = input.data.get("player").and_then(|p| p.get("level")).and_then(|v| v.as_i64()).map(|l| l as i32);

    let row = sqlx::query_as::<_, SaveSlotRow>(
        "UPDATE saves SET name = $1, map_name = $2, player_name = $3, level = $4, screenshot = $5, data = $6, updated_at = NOW() \
         WHERE id = $7 \
         RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
    )
    .bind(&input.name)
    .bind(&map_name)
    .bind(&player_name)
    .bind(level)
    .bind(&input.screenshot)
    .bind(&input.data)
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("存档不存在"))?;

    Ok(Json(to_slot(&row)))
}

async fn admin_delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<serde_json::Value>> {
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
    Ok(Json(serde_json::json!({"id": id})))
}

async fn admin_share(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<ShareInput>,
) -> ApiResult<Json<serde_json::Value>> {
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

    Ok(Json(to_slot(&row)))
}

fn to_slot(r: &SaveSlotRow) -> serde_json::Value {
    serde_json::json!({
        "id": r.id,
        "gameId": r.game_id,
        "userId": r.user_id,
        "name": r.name,
        "mapName": r.map_name,
        "level": r.level,
        "playerName": r.player_name,
        "screenshot": r.screenshot,
        "isShared": r.is_shared,
        "shareCode": r.share_code,
        "createdAt": r.created_at.map(|d| d.to_rfc3339()),
        "updatedAt": r.updated_at.map(|d| d.to_rfc3339()),
    })
}

fn to_save_data(r: &SaveRow) -> serde_json::Value {
    serde_json::json!({
        "id": r.id,
        "gameId": r.game_id,
        "name": r.name,
        "data": r.data,
        "mapName": r.map_name,
        "level": r.level,
        "playerName": r.player_name,
        "screenshot": r.screenshot,
        "isShared": r.is_shared,
        "shareCode": r.share_code,
        "createdAt": r.created_at.map(|d| d.to_rfc3339()),
        "updatedAt": r.updated_at.map(|d| d.to_rfc3339()),
    })
}

fn generate_share_code() -> String {
    use base64::Engine;
    let mut rng = rand::rng();
    let bytes: [u8; 6] = rng.random();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}
