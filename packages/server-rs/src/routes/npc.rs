use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

// ===== NPC Resource sub-module =====

#[derive(sqlx::FromRow)]
struct NpcResRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn npc_res_to_json(r: &NpcResRow) -> serde_json::Value {
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

fn npc_resource_router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(npc_res_list).post(npc_res_create))
        .route(
            "/{id}",
            axum::routing::get(npc_res_get)
                .put(npc_res_update)
                .delete(npc_res_delete),
        )
}

async fn npc_res_list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, NpcResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM npc_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(npc_res_to_json).collect()))
}

async fn npc_res_get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row = sqlx::query_as::<_, NpcResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM npc_resources WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;
    let row = row.ok_or_else(|| ApiError::not_found("NPC资源不存在"))?;
    Ok(Json(npc_res_to_json(&row)))
}

async fn npc_res_create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<crate::routes::crud::CreateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = input.key.to_lowercase();
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();

    let row = sqlx::query_as::<_, NpcResRow>(
        "INSERT INTO npc_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
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

    Ok(Json(npc_res_to_json(&row)))
}

async fn npc_res_update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let row = sqlx::query_as::<_, NpcResRow>(
        "UPDATE npc_resources SET name = $1, data = $2, updated_at = NOW() WHERE id = $3 AND game_id = $4 \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("NPC资源不存在"))?;
    Ok(Json(npc_res_to_json(&row)))
}

async fn npc_res_delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM npc_resources WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("NPC资源不存在"));
    }
    Ok(Json(serde_json::json!({"id": id})))
}

/// Internal upsert for NPC resource (used during NPC import).
async fn upsert_npc_resource(
    state: &AppState,
    game_id: Uuid,
    key: &str,
    name: &str,
    data: &serde_json::Value,
) -> ApiResult<Uuid> {
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO npc_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
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

// ===== NPC main module =====

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/resource", npc_resource_router())
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/batch-import", axum::routing::post(batch_import))
}

#[derive(sqlx::FromRow)]
struct NpcRow {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    kind: String,
    relation: String,
    resource_id: Option<Uuid>,
    data: serde_json::Value,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListNpcQuery {
    pub game_id: String,
    pub kind: Option<String>,
    pub relation: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListNpcQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    // Build dynamic WHERE
    let mut sql = "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at FROM npcs WHERE game_id = $1".to_string();
    let mut param_idx = 2u32;
    if q.kind.is_some() {
        sql.push_str(&format!(" AND kind = ${param_idx}"));
        param_idx += 1;
    }
    if q.relation.is_some() {
        sql.push_str(&format!(" AND relation = ${param_idx}"));
    }
    sql.push_str(" ORDER BY updated_at DESC");

    let mut query = sqlx::query_as::<_, NpcRow>(&sql).bind(game_id);
    if let Some(ref k) = q.kind {
        query = query.bind(k);
    }
    if let Some(ref r) = q.relation {
        query = query.bind(r);
    }

    let rows = query.fetch_all(&state.db.pool).await?;

    // Resolve resource icons
    let resource_ids: Vec<Uuid> = rows.iter().filter_map(|r| r.resource_id).collect();
    let res_map = if !resource_ids.is_empty() {
        let res_rows = sqlx::query_as::<_, NpcResRow>(
            "SELECT id, game_id, key, name, data, created_at, updated_at FROM npc_resources WHERE game_id = $1",
        )
        .bind(game_id)
        .fetch_all(&state.db.pool)
        .await?;
        res_rows
            .into_iter()
            .map(|r| {
                let icon = r
                    .data
                    .get("resources")
                    .and_then(|res| res.get("stand"))
                    .and_then(|s| s.get("image"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                (r.id, (r.key, icon))
            })
            .collect::<std::collections::HashMap<_, _>>()
    } else {
        std::collections::HashMap::new()
    };

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let (npc_ini, icon) = if let Some(rid) = r.resource_id {
                if let Some((key, ic)) = res_map.get(&rid) {
                    (key.clone(), ic.clone())
                } else {
                    (r.key.clone(), String::new())
                }
            } else {
                let icon = r
                    .data
                    .get("resources")
                    .and_then(|res| res.get("stand"))
                    .and_then(|s| s.get("image"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                (r.key.clone(), icon)
            };
            let level = r.data.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
            serde_json::json!({
                "id": r.id,
                "key": r.key,
                "name": r.name,
                "kind": r.kind,
                "relation": r.relation,
                "level": level,
                "npcIni": npc_ini,
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

    let row = sqlx::query_as::<_, NpcRow>(
        "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at FROM npcs WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let r = row.ok_or_else(|| ApiError::not_found("NPC不存在"))?;
    Ok(Json(to_npc(&r)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNpcInput {
    pub game_id: String,
    pub key: String,
    pub kind: Option<String>,
    pub relation: Option<String>,
    pub resource_id: Option<String>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateNpcInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("未命名NPC").to_string();
    let kind = input.kind.as_deref().unwrap_or("Normal");
    let relation = input.relation.as_deref().unwrap_or("Friend");
    let resource_id = input.resource_id.as_deref().and_then(|s| Uuid::parse_str(s).ok());

    let row = sqlx::query_as::<_, NpcRow>(
        "INSERT INTO npcs (game_id, key, name, kind, relation, resource_id, data) VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&input.key)
    .bind(&name)
    .bind(kind)
    .bind(relation)
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

    Ok(Json(to_npc(&row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let kind = input.data.get("kind").and_then(|v| v.as_str()).unwrap_or("Normal").to_string();
    let relation = input.data.get("relation").and_then(|v| v.as_str()).unwrap_or("Friend").to_string();
    let resource_id = input
        .data
        .get("resourceId")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let row = sqlx::query_as::<_, NpcRow>(
        "UPDATE npcs SET name = $1, kind = $2, relation = $3, resource_id = $4, data = $5, updated_at = NOW() \
         WHERE id = $6 AND game_id = $7 \
         RETURNING id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(&kind)
    .bind(&relation)
    .bind(resource_id)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("NPC不存在"))?;
    Ok(Json(to_npc(&row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM npcs WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("NPC不存在"));
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
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("npc");

        if item_type == "resource" {
            // Import as NPC resource
            let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_lowercase();
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            match upsert_npc_resource(&state, game_id, &key, &name, &data).await {
                Ok(id) => {
                    success.push(serde_json::json!({"fileName": file_name, "id": id, "name": name, "type": "resource"}));
                }
                Err(e) => {
                    failed.push(serde_json::json!({"fileName": file_name, "error": e.to_string()}));
                }
            }
        } else {
            // Import as NPC
            let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_string();
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("未命名NPC").to_string();
            let kind = item.get("kind").and_then(|v| v.as_str()).unwrap_or("Normal");
            let relation = item.get("relation").and_then(|v| v.as_str()).unwrap_or("Friend");
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            // Optionally upsert linked resource
            let resource_id = if let Some(res_data) = item.get("npcResData") {
                let res_key = item.get("npcResKey").and_then(|v| v.as_str()).unwrap_or(&key);
                upsert_npc_resource(&state, game_id, res_key, res_key, res_data)
                    .await
                    .ok()
            } else {
                None
            };

            match sqlx::query_as::<_, NpcRow>(
                "INSERT INTO npcs (game_id, key, name, kind, relation, resource_id, data) VALUES ($1, $2, $3, $4, $5, $6, $7) \
                 ON CONFLICT (game_id, key) DO UPDATE SET name = $3, kind = $4, relation = $5, resource_id = $6, data = $7, updated_at = NOW() \
                 RETURNING id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at",
            )
            .bind(game_id)
            .bind(&key)
            .bind(&name)
            .bind(kind)
            .bind(relation)
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
                        "type": "npc",
                        "hasResources": resource_id.is_some(),
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

/// Public: list all NPCs for a game slug (no auth).
pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = crate::routes::crud::resolve_game_id_by_slug(&state, &game_slug).await?;
    let rows = sqlx::query_as::<_, NpcRow>(
        "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at FROM npcs WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(to_npc).collect()))
}

/// Public: list all NPC resources for a game slug (no auth).
pub async fn list_npc_resources_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = crate::routes::crud::resolve_game_id_by_slug(&state, &game_slug).await?;
    let rows = sqlx::query_as::<_, NpcResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM npc_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(npc_res_to_json).collect()))
}

fn to_npc(r: &NpcRow) -> serde_json::Value {
    let mut v = r.data.clone();
    if let Some(obj) = v.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(r.id));
        obj.insert("gameId".into(), serde_json::json!(r.game_id));
        obj.insert("key".into(), serde_json::json!(r.key));
        obj.insert("name".into(), serde_json::json!(r.name));
        obj.insert("kind".into(), serde_json::json!(r.kind));
        obj.insert("relation".into(), serde_json::json!(r.relation));
        obj.insert("resourceId".into(), serde_json::json!(r.resource_id));
        obj.insert("createdAt".into(), serde_json::json!(r.created_at.map(|d| d.to_rfc3339())));
        obj.insert("updatedAt".into(), serde_json::json!(r.updated_at.map(|d| d.to_rfc3339())));
    }
    v
}
