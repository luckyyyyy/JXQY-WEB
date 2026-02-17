use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

// ===== Obj Resource sub-module =====

#[derive(sqlx::FromRow)]
struct ObjResRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn obj_res_to_json(r: &ObjResRow) -> serde_json::Value {
    let resources = r
        .data
        .get("resources")
        .cloned()
        .unwrap_or(serde_json::json!({}));
    serde_json::json!({
        "id": r.id,
        "gameId": r.game_id,
        "key": r.key,
        "name": r.name,
        "resources": resources,
        "createdAt": r.created_at.map(|d| d.to_rfc3339()),
        "updatedAt": r.updated_at.map(|d| d.to_rfc3339()),
    })
}

fn obj_resource_router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(obj_res_list).post(obj_res_create))
        .route(
            "/{id}",
            axum::routing::get(obj_res_get)
                .put(obj_res_update)
                .delete(obj_res_delete),
        )
}

async fn obj_res_list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, ObjResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM obj_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(obj_res_to_json).collect()))
}

async fn obj_res_get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row = sqlx::query_as::<_, ObjResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM obj_resources WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;
    let row = row.ok_or_else(|| ApiError::not_found("物体资源不存在"))?;
    Ok(Json(obj_res_to_json(&row)))
}

async fn obj_res_create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<crate::routes::crud::CreateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = input.key.to_lowercase();
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();

    let row = sqlx::query_as::<_, ObjResRow>(
        "INSERT INTO obj_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(&name)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return ApiError::bad_request(format!("Key '{}' 已存在", key));
            }
        }
        ApiError::Database(e)
    })?;

    Ok(Json(obj_res_to_json(&row)))
}

async fn obj_res_update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let row = sqlx::query_as::<_, ObjResRow>(
        "UPDATE obj_resources SET name = $1, data = $2, updated_at = NOW() WHERE id = $3 AND game_id = $4 \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("物体资源不存在"))?;
    Ok(Json(obj_res_to_json(&row)))
}

async fn obj_res_delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM obj_resources WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("物体资源不存在"));
    }
    Ok(Json(serde_json::json!({"id": id})))
}

/// Internal upsert for Obj resource (used during Obj import).
async fn upsert_obj_resource(
    state: &AppState,
    game_id: Uuid,
    key: &str,
    name: &str,
    data: &serde_json::Value,
) -> ApiResult<Uuid> {
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO obj_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (game_id, key) DO UPDATE SET name = $3, data = $4, updated_at = NOW() \
         RETURNING id",
    )
    .bind(game_id)
    .bind(&key.to_lowercase())
    .bind(name)
    .bind(data)
    .fetch_one(&state.db.pool)
    .await?;
    Ok(row.0)
}

// ===== Obj main module =====

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/resource", obj_resource_router())
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/batch-import", axum::routing::post(batch_import))
}

#[derive(sqlx::FromRow)]
struct ObjRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    kind: String,
    resource_id: Option<Uuid>,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListObjQuery {
    pub game_id: String,
    pub kind: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListObjQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    let rows = if let Some(ref kind) = q.kind {
        sqlx::query_as::<_, ObjRow>(
            "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at FROM objs WHERE game_id = $1 AND kind = $2 ORDER BY updated_at DESC",
        )
        .bind(game_id)
        .bind(kind)
        .fetch_all(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, ObjRow>(
            "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at FROM objs WHERE game_id = $1 ORDER BY updated_at DESC",
        )
        .bind(game_id)
        .fetch_all(&state.db.pool)
        .await?
    };

    // Resolve resource icons
    let res_rows = sqlx::query_as::<_, ObjResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM obj_resources WHERE game_id = $1",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    let res_map: std::collections::HashMap<Uuid, (String, String)> = res_rows
        .into_iter()
        .map(|r| {
            let icon = r
                .data
                .get("resources")
                .and_then(|res| res.get("common"))
                .and_then(|s| s.get("image"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (r.id, (r.key, icon))
        })
        .collect();

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let (obj_file, icon) = if let Some(rid) = r.resource_id {
                if let Some((key, ic)) = res_map.get(&rid) {
                    (key.clone(), ic.clone())
                } else {
                    (r.key.clone(), String::new())
                }
            } else {
                (r.key.clone(), String::new())
            };
            serde_json::json!({
                "id": r.id,
                "key": r.key,
                "name": r.name,
                "kind": r.kind,
                "objFile": obj_file,
                "icon": icon,
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
    let row = sqlx::query_as::<_, ObjRow>(
        "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at FROM objs WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;
    let r = row.ok_or_else(|| ApiError::not_found("物体不存在"))?;
    Ok(Json(to_obj(&r)))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateObjInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("未命名物体").to_string();
    let kind = input.kind.as_deref().unwrap_or("Static");
    let resource_id = input.resource_id.as_deref().and_then(|s| Uuid::parse_str(s).ok());

    let row = sqlx::query_as::<_, ObjRow>(
        "INSERT INTO objs (game_id, key, name, kind, resource_id, data) VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, game_id, key, name, kind, resource_id, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&input.key)
    .bind(&name)
    .bind(kind)
    .bind(resource_id)
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

    Ok(Json(to_obj(&row)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateObjInput {
    pub game_id: String,
    pub key: String,
    pub kind: Option<String>,
    pub resource_id: Option<String>,
    pub data: serde_json::Value,
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let kind = input.data.get("kind").and_then(|v| v.as_str()).unwrap_or("Static").to_string();
    let resource_id = input.data.get("resourceId").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok());

    let row = sqlx::query_as::<_, ObjRow>(
        "UPDATE objs SET name = $1, kind = $2, resource_id = $3, data = $4, updated_at = NOW() \
         WHERE id = $5 AND game_id = $6 \
         RETURNING id, game_id, key, name, kind, resource_id, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(&kind)
    .bind(resource_id)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("物体不存在"))?;
    Ok(Json(to_obj(&row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM objs WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("物体不存在"));
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

    for item in &input.items {
        let file_name = item.get("fileName").and_then(|v| v.as_str()).unwrap_or("unknown");
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("obj");

        if item_type == "resource" {
            let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_lowercase();
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            match upsert_obj_resource(&state, game_id, &key, &name, &data).await {
                Ok(id) => {
                    success.push(serde_json::json!({"fileName": file_name, "id": id, "name": name, "type": "resource"}));
                }
                Err(e) => {
                    failed.push(serde_json::json!({"fileName": file_name, "error": e.to_string()}));
                }
            }
        } else {
            let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_string();
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("未命名物体").to_string();
            let kind = item.get("kind").and_then(|v| v.as_str()).unwrap_or("Static");
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            let resource_id = if let Some(res_data) = item.get("objResData") {
                let res_key = item.get("objResKey").and_then(|v| v.as_str()).unwrap_or(&key);
                upsert_obj_resource(&state, game_id, res_key, res_key, res_data)
                    .await
                    .ok()
            } else {
                None
            };

            match sqlx::query_as::<_, ObjRow>(
                "INSERT INTO objs (game_id, key, name, kind, resource_id, data) VALUES ($1, $2, $3, $4, $5, $6) \
                 ON CONFLICT (game_id, key) DO UPDATE SET name = $3, kind = $4, resource_id = $5, data = $6, updated_at = NOW() \
                 RETURNING id, game_id, key, name, kind, resource_id, data, created_at, updated_at",
            )
            .bind(game_id)
            .bind(&key)
            .bind(&name)
            .bind(kind)
            .bind(resource_id)
            .bind(&data)
            .fetch_one(&state.db.pool)
            .await
            {
                Ok(row) => {
                    success.push(serde_json::json!({
                        "fileName": file_name,
                        "id": row.id,
                        "name": row.name,
                        "type": "obj",
                    }));
                }
                Err(e) => {
                    failed.push(serde_json::json!({"fileName": file_name, "error": e.to_string()}));
                }
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
    let rows = sqlx::query_as::<_, ObjRow>(
        "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at FROM objs WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(to_obj).collect()))
}

pub async fn list_obj_resources_public_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = crate::routes::crud::resolve_game_id_by_slug(&state, &slug).await?;
    let rows = sqlx::query_as::<_, ObjResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM obj_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(obj_res_to_json).collect()))
}

fn to_obj(r: &ObjRow) -> serde_json::Value {
    let mut v = r.data.clone();
    if let Some(obj) = v.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(r.id));
        obj.insert("gameId".into(), serde_json::json!(r.game_id));
        obj.insert("key".into(), serde_json::json!(r.key));
        obj.insert("name".into(), serde_json::json!(r.name));
        obj.insert("kind".into(), serde_json::json!(r.kind));
        obj.insert("resourceId".into(), serde_json::json!(r.resource_id));
        obj.insert("createdAt".into(), serde_json::json!(r.created_at.map(|d| d.to_rfc3339())));
        obj.insert("updatedAt".into(), serde_json::json!(r.updated_at.map(|d| d.to_rfc3339())));
    }
    v
}
