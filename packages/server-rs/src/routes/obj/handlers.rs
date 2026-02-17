use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{
    self, verify_game_access, BatchImportInput, DeleteResult, GameQuery, UpdateEntityInput,
};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{extract_data_map, fmt_ts, validate_batch_items, validate_key};

const NOT_FOUND: &str = "物体不存在";

use super::resource::{ObjResOutput, ObjResRow, upsert_obj_resource};

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

/// Typed detail response for OBJ.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjOutput {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    kind: String,
    resource_id: Option<Uuid>,
    created_at: String,
    updated_at: String,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

const OBJ_EXCLUDE_KEYS: &[&str] = &[
    "id", "gameId", "key", "name", "kind", "resourceId", "createdAt", "updatedAt",
];

impl From<ObjRow> for ObjOutput {
    fn from(r: ObjRow) -> Self {
        let extra = extract_data_map(r.data, OBJ_EXCLUDE_KEYS);
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            kind: r.kind,
            resource_id: r.resource_id,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

impl From<&ObjRow> for ObjOutput {
    fn from(r: &ObjRow) -> Self {
        let extra = extract_data_map(r.data.clone(), OBJ_EXCLUDE_KEYS);
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key.clone(),
            name: r.name.clone(),
            kind: r.kind.clone(),
            resource_id: r.resource_id,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

/// List summary item for OBJ.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjListItem {
    id: Uuid,
    key: String,
    name: String,
    kind: String,
    obj_file: String,
    icon: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListObjQuery {
    pub game_id: String,
    pub kind: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListObjQuery>,
) -> ApiResult<Json<Vec<ObjListItem>>> {
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

    let items: Vec<ObjListItem> = rows
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
            ObjListItem {
                id: r.id,
                key: r.key.clone(),
                name: r.name.clone(),
                kind: r.kind.clone(),
                obj_file,
                icon,
                updated_at: fmt_ts(r.updated_at),
            }
        })
        .collect();

    Ok(Json(items))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<ObjOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_get::<ObjRow, ObjOutput>(
        &state.db.pool,
        game_id,
        id,
        "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at FROM objs WHERE id = $1 AND game_id = $2 LIMIT 1",
        NOT_FOUND,
    )
    .await
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

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateObjInput>,
) -> ApiResult<Json<ObjOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = validate_key(&input.key)?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("未命名物体")
        .to_string();
    let kind = input.kind.as_deref().unwrap_or("Static");
    let resource_id = input
        .resource_id
        .as_deref()
        .and_then(|s| Uuid::parse_str(s).ok());

    let row = sqlx::query_as::<_, ObjRow>(
        "INSERT INTO objs (game_id, key, name, kind, resource_id, data) VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, game_id, key, name, kind, resource_id, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(&name)
    .bind(kind)
    .bind(resource_id)
    .bind(&input.data)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(Json(ObjOutput::from(row)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityInput>,
) -> ApiResult<Json<ObjOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let kind = input
        .data
        .get("kind")
        .and_then(|v| v.as_str())
        .unwrap_or("Static")
        .to_string();
    let resource_id = input
        .data
        .get("resourceId")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

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

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(Json(ObjOutput::from(row)))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<DeleteResult>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_delete(
        &state.db.pool,
        game_id,
        id,
        "DELETE FROM objs WHERE id = $1 AND game_id = $2",
        NOT_FOUND,
    )
    .await
}

pub async fn batch_import(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<BatchImportInput>,
) -> ApiResult<Json<crate::routes::crud::BatchImportResult>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    validate_batch_items(&input.items)?;
    let mut success = Vec::new();
    let mut failed = Vec::new();

    let mut tx = state.db.pool.begin().await?;

    for item in &input.items {
        let file_name = item
            .get("fileName")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let item_type = item
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("obj");

        if item_type == "resource" {
            let key = item
                .get("key")
                .and_then(|v| v.as_str())
                .unwrap_or(file_name)
                .to_lowercase();
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(&key)
                .to_string();
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            match upsert_obj_resource(&mut *tx, game_id, &key, &name, &data).await {
                Ok(id) => {
                    success.push(serde_json::json!({"fileName": file_name, "id": id, "name": name, "type": "resource"}));
                }
                Err(e) => {
                    tracing::warn!("Batch import failed for {file_name}: {e}");
                    failed.push(
                        serde_json::json!({"fileName": file_name, "error": "导入失败"}),
                    );
                }
            }
        } else {
            let key = item
                .get("key")
                .and_then(|v| v.as_str())
                .unwrap_or(file_name)
                .to_string();
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("未命名物体")
                .to_string();
            let kind = item
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("Static");
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            let resource_id = if let Some(res_data) = item.get("objResData") {
                let res_key = item
                    .get("objResKey")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&key);
                upsert_obj_resource(&mut *tx, game_id, res_key, res_key, res_data)
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
            .fetch_one(&mut *tx)
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
                    tracing::warn!("Batch import failed for {file_name}: {e}");
                    failed.push(
                        serde_json::json!({"fileName": file_name, "error": "导入失败"}),
                    );
                }
            }
        }
    }

    tx.commit().await?;

    Ok(Json(crate::routes::crud::BatchImportResult { success, failed }))
}

pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Json<Vec<ObjOutput>>> {
    crud::entity_list_public::<ObjRow, ObjOutput>(
        &state,
        &slug,
        "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at FROM objs WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}

pub async fn list_obj_resources_public_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Json<Vec<ObjResOutput>>> {
    crud::entity_list_public::<ObjResRow, ObjResOutput>(
        &state,
        &slug,
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM obj_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}
