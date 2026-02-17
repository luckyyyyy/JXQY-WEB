use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

#[derive(sqlx::FromRow)]
struct PlayerRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    index: i32,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/batch-import", axum::routing::post(batch_import))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, PlayerRow>(
        "SELECT id, game_id, key, name, index, data, created_at, updated_at FROM players WHERE game_id = $1 ORDER BY index",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let level = r.data.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
            let npc_ini = r.data.get("npcIni").and_then(|v| v.as_str()).unwrap_or("").to_string();
            serde_json::json!({
                "id": r.id,
                "key": r.key,
                "name": r.name,
                "index": r.index,
                "level": level,
                "npcIni": npc_ini,
                "updatedAt": r.updated_at.map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(items))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row = sqlx::query_as::<_, PlayerRow>(
        "SELECT id, game_id, key, name, index, data, created_at, updated_at FROM players WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;
    match row {
        Some(r) => Ok(Json(to_player(&r))),
        None => Err(ApiError::not_found("玩家不存在")),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlayerInput {
    pub game_id: String,
    pub key: String,
    pub index: Option<i32>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreatePlayerInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or(&input.key).to_string();

    // Auto-increment index if not provided
    let index = if let Some(idx) = input.index {
        idx
    } else {
        let max_idx: Option<i32> =
            sqlx::query_scalar("SELECT MAX(index) FROM players WHERE game_id = $1")
                .bind(game_id)
                .fetch_one(&state.db.pool)
                .await?;
        max_idx.unwrap_or(-1) + 1
    };

    let row = sqlx::query_as::<_, PlayerRow>(
        "INSERT INTO players (game_id, key, name, index, data) VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, game_id, key, name, index, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&input.key)
    .bind(&name)
    .bind(index)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return ApiError::bad_request(format!("Key '{}' 已存在", input.key));
            }
        }
        ApiError::Database(e)
    })?;

    Ok(Json(to_player(&row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let index = input.data.get("index").and_then(|v| v.as_i64()).map(|i| i as i32);

    let row = if let Some(idx) = index {
        sqlx::query_as::<_, PlayerRow>(
            "UPDATE players SET name = $1, index = $2, data = $3, updated_at = NOW() \
             WHERE id = $4 AND game_id = $5 \
             RETURNING id, game_id, key, name, index, data, created_at, updated_at",
        )
        .bind(&name)
        .bind(idx)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, PlayerRow>(
            "UPDATE players SET name = $1, data = $2, updated_at = NOW() \
             WHERE id = $3 AND game_id = $4 \
             RETURNING id, game_id, key, name, index, data, created_at, updated_at",
        )
        .bind(&name)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    };

    let row = row.ok_or_else(|| ApiError::not_found("玩家不存在"))?;
    Ok(Json(to_player(&row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM players WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("玩家不存在"));
    }
    Ok(Json(serde_json::json!({"id": id})))
}

async fn batch_import(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<crate::routes::crud::BatchImportInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let mut success = Vec::new();
    let mut failed = Vec::new();

    // Get current max index
    let max_idx: Option<i32> =
        sqlx::query_scalar("SELECT MAX(index) FROM players WHERE game_id = $1")
            .bind(game_id)
            .fetch_one(&state.db.pool)
            .await?;
    let mut next_idx = max_idx.unwrap_or(-1) + 1;

    for item in &input.items {
        let file_name = item.get("fileName").and_then(|v| v.as_str()).unwrap_or("unknown");
        let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_string();
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
        let data = item.get("data").cloned().unwrap_or(serde_json::json!({"name": name}));

        // Try to extract index from filename (e.g., "Player0" → 0)
        let index = item
            .get("index")
            .and_then(|v| v.as_i64())
            .map(|i| i as i32)
            .unwrap_or_else(|| {
                let idx = next_idx;
                next_idx += 1;
                idx
            });

        match sqlx::query_as::<_, PlayerRow>(
            "INSERT INTO players (game_id, key, name, index, data) VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (game_id, key) DO UPDATE SET name = $3, index = $4, data = $5, updated_at = NOW() \
             RETURNING id, game_id, key, name, index, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(&name)
        .bind(index)
        .bind(&data)
        .fetch_one(&state.db.pool)
        .await
        {
            Ok(row) => {
                success.push(serde_json::json!({"fileName": file_name, "id": row.id, "name": row.name, "index": row.index}));
            }
            Err(e) => {
                failed.push(serde_json::json!({"fileName": file_name, "error": e.to_string()}));
            }
        }
    }

    Ok(Json(serde_json::json!({"success": success, "failed": failed})))
}

pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = crate::routes::crud::resolve_game_id_by_slug(&state, &slug).await?;
    let rows = sqlx::query_as::<_, PlayerRow>(
        "SELECT id, game_id, key, name, index, data, created_at, updated_at FROM players WHERE game_id = $1 ORDER BY index",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(to_player).collect()))
}

fn to_player(r: &PlayerRow) -> serde_json::Value {
    let mut v = r.data.clone();
    if let Some(obj) = v.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(r.id));
        obj.insert("gameId".into(), serde_json::json!(r.game_id));
        obj.insert("key".into(), serde_json::json!(r.key));
        obj.insert("name".into(), serde_json::json!(r.name));
        obj.insert("index".into(), serde_json::json!(r.index));
        obj.insert("createdAt".into(), serde_json::json!(r.created_at.map(|d| d.to_rfc3339())));
        obj.insert("updatedAt".into(), serde_json::json!(r.updated_at.map(|d| d.to_rfc3339())));
    }
    v
}
