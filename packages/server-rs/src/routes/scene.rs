use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, resolve_game_id_by_slug, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

#[derive(sqlx::FromRow)]

struct SceneRow {
    id: Uuid,
    key: String,
    name: String,
    map_file_name: Option<String>,
    data: serde_json::Value,
    _mmf_data: Option<String>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/import", axum::routing::post(import_scene))
        .route("/clear-all", axum::routing::post(clear_all))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, SceneRow>(
        "SELECT id, key, name, map_file_name, data, mmf_data, created_at, updated_at FROM scenes WHERE game_id = $1 ORDER BY key ASC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let (script_keys, trap_keys, npc_keys, obj_keys) = get_scene_data_counts(&r.data);
            serde_json::json!({
                "id": r.id,
                "key": r.key,
                "name": r.name,
                "mapFileName": r.map_file_name,
                "scriptKeys": script_keys,
                "trapKeys": trap_keys,
                "npcKeys": npc_keys,
                "objKeys": obj_keys,
                "createdAt": r.created_at.map(|d| d.to_rfc3339()),
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
    let row = sqlx::query_as::<_, SceneRow>(
        "SELECT id, key, name, map_file_name, data, mmf_data, created_at, updated_at FROM scenes WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;
    match row {
        Some(r) => Ok(Json(to_scene(&r))),
        None => Err(ApiError::not_found("场景不存在")),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSceneInput {
    game_id: String,
    key: String,
    name: Option<String>,
    map_file_name: Option<String>,
    data: serde_json::Value,
    mmf_data: Option<String>,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateSceneInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.name.as_deref().unwrap_or(&input.key);

    let row = sqlx::query_as::<_, SceneRow>(
        "INSERT INTO scenes (game_id, key, name, map_file_name, data, mmf_data) VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, key, name, map_file_name, data, mmf_data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&input.key)
    .bind(name)
    .bind(&input.map_file_name)
    .bind(&input.data)
    .bind(&input.mmf_data)
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

    Ok(Json(to_scene(&row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<CreateSceneInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.name.as_deref().unwrap_or(&input.key);

    let row = sqlx::query_as::<_, SceneRow>(
        "UPDATE scenes SET name = $1, map_file_name = $2, data = $3, mmf_data = COALESCE($4, mmf_data), updated_at = NOW() \
         WHERE id = $5 AND game_id = $6 \
         RETURNING id, key, name, map_file_name, data, mmf_data, created_at, updated_at",
    )
    .bind(name)
    .bind(&input.map_file_name)
    .bind(&input.data)
    .bind(&input.mmf_data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("场景不存在"))?;
    Ok(Json(to_scene(&row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM scenes WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("场景不存在"));
    }
    Ok(Json(serde_json::json!({"id": id})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportSceneBatchInput {
    game_id: String,
    scenes: Vec<serde_json::Value>,
}

async fn import_scene(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ImportSceneBatchInput>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let mut results = Vec::new();

    for scene in &input.scenes {
        let key = scene.get("key").and_then(|v| v.as_str()).unwrap_or("unknown");
        let name = scene.get("name").and_then(|v| v.as_str()).unwrap_or(key);
        let map_file_name = scene.get("mapFileName").and_then(|v| v.as_str());
        let data = scene.get("data").cloned().unwrap_or(serde_json::json!({}));
        let mmf_data = scene.get("mmfData").and_then(|v| v.as_str());

        match sqlx::query_as::<_, SceneRow>(
            "INSERT INTO scenes (game_id, key, name, map_file_name, data, mmf_data) VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (game_id, key) DO UPDATE SET name = $3, map_file_name = $4, data = $5, mmf_data = COALESCE($6, scenes.mmf_data), updated_at = NOW() \
             RETURNING id, key, name, map_file_name, data, mmf_data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(key)
        .bind(name)
        .bind(map_file_name)
        .bind(&data)
        .bind(mmf_data)
        .fetch_one(&state.db.pool)
        .await
        {
            Ok(_row) => {
                results.push(serde_json::json!({"ok": true, "sceneName": name, "action": "upserted"}));
            }
            Err(e) => {
                results.push(serde_json::json!({"ok": false, "sceneName": name, "action": "error", "error": e.to_string()}));
            }
        }
    }

    Ok(Json(results))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClearAllInput {
    game_id: String,
}

async fn clear_all(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ClearAllInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM scenes WHERE game_id = $1")
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(serde_json::json!({"deletedCount": result.rows_affected()})))
}

// ===== Public routes (no auth) =====

/// GET /game/:gameSlug/api/scene/:sceneKey/mmf — returns raw MMF binary
pub async fn get_mmf_binary(
    State(state): State<AppState>,
    Path((game_slug, scene_key)): Path<(String, String)>,
) -> ApiResult<axum::response::Response> {
    use axum::body::Body;
    use axum::http::{header, StatusCode};

    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let mmf_data: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT mmf_data FROM scenes WHERE game_id = $1 AND key = $2 LIMIT 1",
    )
    .bind(game_id)
    .bind(&scene_key)
    .fetch_optional(&state.db.pool)
    .await?;

    let mmf_base64 = mmf_data
        .and_then(|(d,)| d)
        .ok_or_else(|| ApiError::not_found("MMF data not found"))?;

    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&mmf_base64)
        .map_err(|_| ApiError::internal("Failed to decode MMF data"))?;

    Ok(axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, bytes.len())
        .header(header::CACHE_CONTROL, "public, max-age=3600")
        .body(Body::from(bytes))
        .unwrap())
}

/// GET /game/:gameSlug/api/scene/:sceneKey/npc/:npcKey
pub async fn get_npc_entries(
    State(state): State<AppState>,
    Path((game_slug, scene_key, npc_key)): Path<(String, String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let data: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT data FROM scenes WHERE game_id = $1 AND key = $2 LIMIT 1",
    )
    .bind(game_id)
    .bind(&scene_key)
    .fetch_optional(&state.db.pool)
    .await?;

    let data = data.ok_or_else(|| ApiError::not_found("Scene not found"))?.0;
    let entries = data
        .get("npc")
        .and_then(|n| n.get(&npc_key))
        .and_then(|n| n.get("entries"))
        .cloned()
        .unwrap_or(serde_json::Value::Null);

    Ok(Json(entries))
}

/// GET /game/:gameSlug/api/scene/:sceneKey/obj/:objKey
pub async fn get_obj_entries(
    State(state): State<AppState>,
    Path((game_slug, scene_key, obj_key)): Path<(String, String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let data: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT data FROM scenes WHERE game_id = $1 AND key = $2 LIMIT 1",
    )
    .bind(game_id)
    .bind(&scene_key)
    .fetch_optional(&state.db.pool)
    .await?;

    let data = data.ok_or_else(|| ApiError::not_found("Scene not found"))?.0;
    let entries = data
        .get("obj")
        .and_then(|n| n.get(&obj_key))
        .and_then(|n| n.get("entries"))
        .cloned()
        .unwrap_or(serde_json::Value::Null);

    Ok(Json(entries))
}

fn get_scene_data_counts(data: &serde_json::Value) -> (Vec<String>, Vec<String>, Vec<String>, Vec<String>) {
    let get_keys = |section: &str| -> Vec<String> {
        data.get(section)
            .and_then(|v| v.as_object())
            .map(|obj| obj.keys().cloned().collect())
            .unwrap_or_default()
    };
    (
        get_keys("script"),
        get_keys("trap"),
        get_keys("npc"),
        get_keys("obj"),
    )
}

fn to_scene(r: &SceneRow) -> serde_json::Value {
    let (script_keys, trap_keys, npc_keys, obj_keys) = get_scene_data_counts(&r.data);
    serde_json::json!({
        "id": r.id,
        "key": r.key,
        "name": r.name,
        "mapFileName": r.map_file_name,
        "data": r.data,
        "scriptKeys": script_keys,
        "trapKeys": trap_keys,
        "npcKeys": npc_keys,
        "objKeys": obj_keys,
        "createdAt": r.created_at.map(|d| d.to_rfc3339()),
        "updatedAt": r.updated_at.map(|d| d.to_rfc3339()),
    })
}
