use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

/// Row type for magics table (extends EntityRow with user_type).
#[derive(sqlx::FromRow)]
struct MagicRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    user_type: String,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMagicQuery {
    pub game_id: String,
    pub user_type: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListMagicQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    let rows = if let Some(ref ut) = q.user_type {
        sqlx::query_as::<_, MagicRow>(
            "SELECT id, game_id, key, name, user_type, data, created_at, updated_at FROM magics WHERE game_id = $1 AND user_type = $2 ORDER BY updated_at DESC",
        )
        .bind(game_id)
        .bind(ut)
        .fetch_all(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, MagicRow>(
            "SELECT id, game_id, key, name, user_type, data, created_at, updated_at FROM magics WHERE game_id = $1 ORDER BY updated_at DESC",
        )
        .bind(game_id)
        .fetch_all(&state.db.pool)
        .await?
    };

    let items: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            let move_kind = r.data.get("moveKind").and_then(|v| v.as_str()).unwrap_or("");
            let belong = r.data.get("belong").and_then(|v| v.as_str()).unwrap_or("");
            let icon = r.data.get("icon").and_then(|v| v.as_str()).unwrap_or("");
            serde_json::json!({
                "id": r.id,
                "key": r.key,
                "name": r.name,
                "moveKind": move_kind,
                "belong": belong,
                "icon": icon,
                "userType": r.user_type,
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

    let row = sqlx::query_as::<_, MagicRow>(
        "SELECT id, game_id, key, name, user_type, data, created_at, updated_at FROM magics WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some(r) => Ok(Json(to_magic(&r))),
        None => Err(ApiError::not_found("武功不存在")),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMagicInput {
    pub game_id: String,
    pub key: String,
    pub user_type: Option<String>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateMagicInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let user_type = input.user_type.as_deref().unwrap_or("npc");
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&input.key)
        .to_string();

    let row = sqlx::query_as::<_, MagicRow>(
        "INSERT INTO magics (game_id, key, user_type, name, data) VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&input.key)
    .bind(user_type)
    .bind(&name)
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

    Ok(Json(to_magic(&row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let user_type = input
        .data
        .get("userType")
        .and_then(|v| v.as_str())
        .unwrap_or("npc")
        .to_string();
    let key = input
        .data
        .get("key")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let row = if let Some(ref k) = key {
        sqlx::query_as::<_, MagicRow>(
            "UPDATE magics SET key = $1, user_type = $2, name = $3, data = $4, updated_at = NOW() \
             WHERE id = $5 AND game_id = $6 \
             RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
        )
        .bind(k)
        .bind(&user_type)
        .bind(&name)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, MagicRow>(
            "UPDATE magics SET user_type = $1, name = $2, data = $3, updated_at = NOW() \
             WHERE id = $4 AND game_id = $5 \
             RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
        )
        .bind(&user_type)
        .bind(&name)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    };

    let row = row.ok_or_else(|| ApiError::not_found("武功不存在"))?;
    Ok(Json(to_magic(&row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM magics WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("武功不存在"));
    }
    Ok(Json(serde_json::json!({"id": id})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportInput {
    pub game_id: String,
    pub items: Vec<serde_json::Value>,
    pub user_type: Option<String>,
}

async fn batch_import(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchImportInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let default_user_type = input.user_type.as_deref().unwrap_or("npc");

    let mut success = Vec::new();
    let mut failed = Vec::new();

    for item in &input.items {
        let file_name = item
            .get("fileName")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let ini_content = item.get("iniContent").and_then(|v| v.as_str());
        let user_type = item
            .get("userType")
            .and_then(|v| v.as_str())
            .unwrap_or(default_user_type);

        let Some(ini_content) = ini_content else {
            failed.push(serde_json::json!({"fileName": file_name, "error": "缺少 iniContent"}));
            continue;
        };

        // Parse key from filename
        let key = file_name
            .rsplit('/')
            .next()
            .unwrap_or(file_name)
            .trim_end_matches(".ini")
            .to_string();

        let name = key.clone(); // Will be overwritten by INI parsing on frontend

        // Store raw INI as data for now; INI parsing happens on frontend
        let data = item.get("data").cloned().unwrap_or_else(|| {
            serde_json::json!({
                "name": name,
                "userType": user_type,
                "iniContent": ini_content,
            })
        });

        match sqlx::query_as::<_, MagicRow>(
            "INSERT INTO magics (game_id, key, user_type, name, data) VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (game_id, key) DO UPDATE SET user_type = $3, name = $4, data = $5, updated_at = NOW() \
             RETURNING id, game_id, key, name, user_type, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(user_type)
        .bind(&name)
        .bind(&data)
        .fetch_one(&state.db.pool)
        .await
        {
            Ok(row) => {
                success.push(serde_json::json!({
                    "fileName": file_name,
                    "id": row.id,
                    "name": row.name,
                }));
            }
            Err(e) => {
                failed.push(serde_json::json!({"fileName": file_name, "error": e.to_string()}));
            }
        }
    }

    Ok(Json(serde_json::json!({"success": success, "failed": failed})))
}

/// Public: list all magics for a game slug (no auth).
pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = crate::routes::crud::resolve_game_id_by_slug(&state, &game_slug).await?;
    let rows = sqlx::query_as::<_, MagicRow>(
        "SELECT id, game_id, key, name, user_type, data, created_at, updated_at FROM magics WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    Ok(Json(rows.iter().map(to_magic).collect()))
}

fn to_magic(r: &MagicRow) -> serde_json::Value {
    let mut v = r.data.clone();
    if let Some(obj) = v.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(r.id));
        obj.insert("gameId".into(), serde_json::json!(r.game_id));
        obj.insert("key".into(), serde_json::json!(r.key));
        obj.insert("userType".into(), serde_json::json!(r.user_type));
        obj.insert("name".into(), serde_json::json!(r.name));
        obj.insert("createdAt".into(), serde_json::json!(r.created_at.map(|d| d.to_rfc3339())));
        obj.insert("updatedAt".into(), serde_json::json!(r.updated_at.map(|d| d.to_rfc3339())));
    }
    v
}
