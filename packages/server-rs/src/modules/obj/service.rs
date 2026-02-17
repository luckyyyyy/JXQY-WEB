//! OBJ service: business logic for OBJ + OBJ resource CRUD.
//! No axum/HTTP dependencies — pure DB + data operations.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud;
use crate::utils::{extract_data_map, fmt_ts, validate_batch_items, validate_key};

// ── OBJ Row / Output types ───────────────────────

#[derive(sqlx::FromRow)]
pub struct ObjRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub resource_id: Option<Uuid>,
    pub data: serde_json::Value,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

const OBJ_EXCLUDE_KEYS: &[&str] = &[
    "id", "gameId", "key", "name", "kind", "resourceId", "createdAt", "updatedAt",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub resource_id: Option<Uuid>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

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
    pub id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub obj_file: String,
    pub icon: String,
    pub updated_at: String,
}

// ── OBJ Resource Row / Output types ──────────────

#[derive(sqlx::FromRow)]
pub struct ObjResRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub data: serde_json::Value,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjResOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub resources: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ObjResRow> for ObjResOutput {
    fn from(r: ObjResRow) -> Self {
        let resources = r
            .data
            .get("resources")
            .cloned()
            .unwrap_or(serde_json::json!({}));
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            resources,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

impl From<&ObjResRow> for ObjResOutput {
    fn from(r: &ObjResRow) -> Self {
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key.clone(),
            name: r.name.clone(),
            resources: r
                .data
                .get("resources")
                .cloned()
                .unwrap_or(serde_json::json!({})),
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

// ── Input types ───────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListObjQuery {
    pub game_id: String,
    pub kind: Option<String>,
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

// ── OBJ service functions ─────────────────────────

const NOT_FOUND: &str = "物体不存在";

pub async fn list(pool: &sqlx::PgPool, game_id: Uuid, kind: Option<&str>) -> ApiResult<Vec<ObjListItem>> {
    let rows = sqlx::query_as::<_, ObjRow>(
        "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at \
         FROM objs WHERE game_id = $1 \
         AND ($2::text IS NULL OR kind = $2) \
         ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .bind(kind)
    .fetch_all(pool)
    .await?;

    // Resolve resource icons
    let res_rows = sqlx::query_as::<_, ObjResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at \
         FROM obj_resources WHERE game_id = $1",
    )
    .bind(game_id)
    .fetch_all(pool)
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

    let items = rows
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

    Ok(items)
}

pub async fn get(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<axum::Json<ObjOutput>> {
    crud::entity_get::<ObjRow, ObjOutput>(
        pool,
        game_id,
        id,
        "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at \
         FROM objs WHERE id = $1 AND game_id = $2 LIMIT 1",
        NOT_FOUND,
    )
    .await
}

pub async fn create(pool: &sqlx::PgPool, game_id: Uuid, input: &CreateObjInput) -> ApiResult<ObjOutput> {
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
    .fetch_one(pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(ObjOutput::from(row))
}

pub async fn update(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    data: &serde_json::Value,
) -> ApiResult<ObjOutput> {
    let name = data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let kind = data
        .get("kind")
        .and_then(|v| v.as_str())
        .unwrap_or("Static")
        .to_string();
    let resource_id = data
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
    .bind(data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(ObjOutput::from(row))
}

pub async fn delete(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<Uuid> {
    crud::entity_delete(
        pool,
        game_id,
        id,
        "DELETE FROM objs WHERE id = $1 AND game_id = $2",
        NOT_FOUND,
    )
    .await
    .map(|r| r.0.id)
}

pub async fn batch_import(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    items: &[serde_json::Value],
) -> ApiResult<crud::BatchImportResult> {
    validate_batch_items(items)?;
    let mut success = Vec::new();
    let mut failed = Vec::new();
    let mut tx = pool.begin().await?;

    for item in items {
        let file_name = item
            .get("fileName")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("obj");

        if item_type == "resource" {
            let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_lowercase();
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            match upsert_obj_resource(&mut *tx, game_id, &key, &name, &data).await {
                Ok(id) => {
                    success.push(serde_json::json!({"fileName": file_name, "id": id, "name": name, "type": "resource"}));
                }
                Err(e) => {
                    tracing::warn!("Batch import failed for {file_name}: {e}");
                    failed.push(serde_json::json!({"fileName": file_name, "error": "导入失败"}));
                }
            }
        } else {
            let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_string();
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("未命名物体").to_string();
            let kind = item.get("kind").and_then(|v| v.as_str()).unwrap_or("Static");
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            let resource_id = if let Some(res_data) = item.get("objResData") {
                let res_key = item.get("objResKey").and_then(|v| v.as_str()).unwrap_or(&key);
                upsert_obj_resource(&mut *tx, game_id, res_key, res_key, res_data).await.ok()
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
                        "fileName": file_name, "id": row.id, "name": row.name, "type": "obj",
                    }));
                }
                Err(e) => {
                    tracing::warn!("Batch import failed for {file_name}: {e}");
                    failed.push(serde_json::json!({"fileName": file_name, "error": "导入失败"}));
                }
            }
        }
    }

    tx.commit().await?;
    Ok(crud::BatchImportResult { success, failed })
}

// ── OBJ Resource service functions ────────────────

pub async fn list_resources(pool: &sqlx::PgPool, game_id: Uuid) -> ApiResult<Vec<ObjResOutput>> {
    let rows = sqlx::query_as::<_, ObjResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at \
         FROM obj_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(ObjResOutput::from).collect())
}

pub async fn get_resource(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<ObjResOutput> {
    let row = sqlx::query_as::<_, ObjResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at \
         FROM obj_resources WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;
    let row = row.ok_or_else(|| ApiError::not_found("物体资源不存在"))?;
    Ok(ObjResOutput::from(row))
}

pub async fn create_resource(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    key: &str,
    data: &serde_json::Value,
) -> ApiResult<ObjResOutput> {
    let key = validate_key(key)?.to_lowercase();
    let name = data.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();

    let row = sqlx::query_as::<_, ObjResRow>(
        "INSERT INTO obj_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(&name)
    .bind(data)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return ApiError::bad_request(format!("Key '{key}' 已存在"));
            }
        }
        ApiError::Database(e)
    })?;

    Ok(ObjResOutput::from(row))
}

pub async fn update_resource(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    data: &serde_json::Value,
) -> ApiResult<ObjResOutput> {
    let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let row = sqlx::query_as::<_, ObjResRow>(
        "UPDATE obj_resources SET name = $1, data = $2, updated_at = NOW() WHERE id = $3 AND game_id = $4 \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("物体资源不存在"))?;
    Ok(ObjResOutput::from(row))
}

pub async fn delete_resource(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<Uuid> {
    let result = sqlx::query("DELETE FROM obj_resources WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("物体资源不存在"));
    }
    Ok(id)
}

/// Internal upsert for OBJ resource (used during batch import).
pub async fn upsert_obj_resource<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
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
    .fetch_one(executor)
    .await?;
    Ok(row.0)
}

/// Public: list all OBJs for a game slug (no auth).
pub async fn list_public(
    state: &crate::state::AppState,
    slug: &str,
) -> ApiResult<axum::Json<Vec<ObjOutput>>> {
    crud::entity_list_public::<ObjRow, ObjOutput>(
        state,
        slug,
        "SELECT id, game_id, key, name, kind, resource_id, data, created_at, updated_at \
         FROM objs WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}

/// Public: list all OBJ resources for a game slug (no auth).
pub async fn list_resources_public(
    state: &crate::state::AppState,
    slug: &str,
) -> ApiResult<axum::Json<Vec<ObjResOutput>>> {
    crud::entity_list_public::<ObjResRow, ObjResOutput>(
        state,
        slug,
        "SELECT id, game_id, key, name, data, created_at, updated_at \
         FROM obj_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}
