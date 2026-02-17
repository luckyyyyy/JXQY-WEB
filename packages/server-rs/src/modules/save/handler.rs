use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud::{DeleteResult, resolve_game_id, resolve_game_id_by_slug};
use crate::modules::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::validate_str;

use super::helpers::{
    SaveDataOutput, SaveRow, SaveSlotOutput, SaveSlotRow, SharedSaveOutput, SharedSaveRow,
    generate_share_code,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListSaveQuery {
    game_slug: String,
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListSaveQuery>,
) -> ApiResult<Json<Vec<SaveSlotOutput>>> {
    let game_id = resolve_game_id(&state, &q.game_slug).await?;
    let rows = sqlx::query_as::<_, SaveSlotRow>(
        "SELECT id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at \
         FROM saves WHERE game_id = $1 AND user_id = $2 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .bind(auth.0)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(Json(rows.iter().map(SaveSlotOutput::from).collect()))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<SaveDataOutput>> {
    let row = sqlx::query_as::<_, SaveRow>(
        "SELECT id, game_id, user_id, name, map_name, level, player_name, screenshot, \
             is_shared, share_code, data, created_at, updated_at \
             FROM saves WHERE id = $1 AND user_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("存档不存在"))?;
    Ok(Json(SaveDataOutput::from(&row)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertSaveInput {
    pub game_slug: String,
    pub save_id: Option<String>,
    pub name: String,
    pub data: serde_json::Value,
    pub screenshot: Option<String>,
}

pub async fn upsert(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpsertSaveInput>,
) -> ApiResult<Json<SaveSlotOutput>> {
    let game_id = resolve_game_id(&state, &input.game_slug).await?;
    let name = validate_str(&input.name, "存档名称", 100)?;
    let meta = crate::utils::SaveMetadata::extract(&input.data);

    if let Some(ref save_id_str) = input.save_id {
        let save_id =
            Uuid::parse_str(save_id_str).map_err(|_| ApiError::bad_request("无效的存档ID"))?;

        // Verify ownership
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM saves WHERE id = $1 AND user_id = $2)")
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
        .bind(&name)
        .bind(&meta.map_name)
        .bind(&meta.player_name)
        .bind(meta.level)
        .bind(&input.screenshot)
        .bind(&input.data)
        .bind(save_id)
        .fetch_one(&state.db.pool)
        .await?;

        Ok(Json(SaveSlotOutput::from(row)))
    } else {
        let row = sqlx::query_as::<_, SaveSlotRow>(
            "INSERT INTO saves (game_id, user_id, name, map_name, player_name, level, screenshot, data) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
             RETURNING id, game_id, user_id, name, map_name, level, player_name, screenshot, is_shared, share_code, created_at, updated_at",
        )
        .bind(game_id)
        .bind(auth.0)
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
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<DeleteResult>> {
    let result = sqlx::query("DELETE FROM saves WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.0)
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
    save_id: String,
    is_shared: bool,
}

pub async fn share(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ShareInput>,
) -> ApiResult<Json<SaveSlotOutput>> {
    let save_id =
        Uuid::parse_str(&input.save_id).map_err(|_| ApiError::bad_request("无效的存档ID"))?;

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

    Ok(Json(SaveSlotOutput::from(row)))
}

pub async fn get_shared(
    State(state): State<AppState>,
    Path((game_slug, share_code)): Path<(String, String)>,
) -> ApiResult<Json<SharedSaveOutput>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;

    let row = sqlx::query_as::<_, SharedSaveRow>(
        "SELECT saves.id, saves.name, saves.data, users.name AS user_name, \
         saves.map_name, saves.level, saves.player_name, saves.screenshot, saves.updated_at \
         FROM saves INNER JOIN users ON saves.user_id = users.id \
         WHERE saves.game_id = $1 AND saves.share_code = $2 AND saves.is_shared = true LIMIT 1",
    )
    .bind(game_id)
    .bind(&share_code)
    .fetch_optional(&state.db.pool)
    .await?;

    let r = row.ok_or_else(|| ApiError::not_found("共享存档不存在"))?;

    Ok(Json(SharedSaveOutput::from(r)))
}
