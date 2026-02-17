//! NPC service: business logic for NPC + NPC resource CRUD.
//! No axum/HTTP dependencies — pure DB + data operations.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::modules::crud;
use crate::utils::{extract_data_map, fmt_ts, validate_batch_items, validate_key};

// ── NPC Row / Output types ────────────────────────

#[derive(sqlx::FromRow)]
pub struct NpcRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub relation: String,
    pub resource_id: Option<Uuid>,
    pub data: serde_json::Value,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

const NPC_EXCLUDE_KEYS: &[&str] = &[
    "id", "gameId", "key", "name", "kind", "relation", "resourceId", "createdAt", "updatedAt",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub relation: String,
    pub resource_id: Option<Uuid>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl From<NpcRow> for NpcOutput {
    fn from(r: NpcRow) -> Self {
        let extra = extract_data_map(r.data, NPC_EXCLUDE_KEYS);
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key,
            name: r.name,
            kind: r.kind,
            relation: r.relation,
            resource_id: r.resource_id,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

impl From<&NpcRow> for NpcOutput {
    fn from(r: &NpcRow) -> Self {
        let extra = extract_data_map(r.data.clone(), NPC_EXCLUDE_KEYS);
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key.clone(),
            name: r.name.clone(),
            kind: r.kind.clone(),
            relation: r.relation.clone(),
            resource_id: r.resource_id,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
            extra,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcListItem {
    pub id: Uuid,
    pub key: String,
    pub name: String,
    pub kind: String,
    pub relation: String,
    pub level: i64,
    pub npc_ini: String,
    pub icon: String,
    pub updated_at: String,
}

// ── NPC Resource Row / Output types ───────────────

#[derive(sqlx::FromRow)]
pub struct NpcResRow {
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
pub struct NpcResOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub resources: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<NpcResRow> for NpcResOutput {
    fn from(r: NpcResRow) -> Self {
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

impl From<&NpcResRow> for NpcResOutput {
    fn from(r: &NpcResRow) -> Self {
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
pub struct ListNpcQuery {
    pub game_id: String,
    pub kind: Option<String>,
    pub relation: Option<String>,
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

// ── NPC service functions ─────────────────────────

const NOT_FOUND: &str = "NPC不存在";

pub async fn list(pool: &sqlx::PgPool, game_id: Uuid, kind: Option<&str>, relation: Option<&str>) -> ApiResult<Vec<NpcListItem>> {
    let rows = sqlx::query_as::<_, NpcRow>(
        "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at \
         FROM npcs WHERE game_id = $1 \
         AND ($2::text IS NULL OR kind = $2) \
         AND ($3::text IS NULL OR relation = $3) \
         ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .bind(kind)
    .bind(relation)
    .fetch_all(pool)
    .await?;

    // Resolve resource icons
    let resource_ids: Vec<Uuid> = rows.iter().filter_map(|r| r.resource_id).collect();
    let res_map = if !resource_ids.is_empty() {
        let res_rows = sqlx::query_as::<_, NpcResRow>(
            "SELECT id, game_id, key, name, data, created_at, updated_at \
             FROM npc_resources WHERE game_id = $1",
        )
        .bind(game_id)
        .fetch_all(pool)
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

    let items = rows
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
            NpcListItem {
                id: r.id,
                key: r.key.clone(),
                name: r.name.clone(),
                kind: r.kind.clone(),
                relation: r.relation.clone(),
                level,
                npc_ini,
                icon,
                updated_at: fmt_ts(r.updated_at),
            }
        })
        .collect();

    Ok(items)
}

pub async fn get(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<axum::Json<NpcOutput>> {
    crud::entity_get::<NpcRow, NpcOutput>(
        pool,
        game_id,
        id,
        "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at \
         FROM npcs WHERE id = $1 AND game_id = $2 LIMIT 1",
        NOT_FOUND,
    )
    .await
}

pub async fn create(pool: &sqlx::PgPool, game_id: Uuid, input: &CreateNpcInput) -> ApiResult<NpcOutput> {
    let key = validate_key(&input.key)?;
    let name = input
        .data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("未命名NPC")
        .to_string();
    let kind = input.kind.as_deref().unwrap_or("Normal");
    let relation = input.relation.as_deref().unwrap_or("Friend");
    let resource_id = input
        .resource_id
        .as_deref()
        .and_then(|s| Uuid::parse_str(s).ok());

    let row = sqlx::query_as::<_, NpcRow>(
        "INSERT INTO npcs (game_id, key, name, kind, relation, resource_id, data) VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(&name)
    .bind(kind)
    .bind(relation)
    .bind(resource_id)
    .bind(&input.data)
    .fetch_one(pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(NpcOutput::from(row))
}

pub async fn update(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    data: &serde_json::Value,
) -> ApiResult<NpcOutput> {
    let name = data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let kind = data
        .get("kind")
        .and_then(|v| v.as_str())
        .unwrap_or("Normal")
        .to_string();
    let relation = data
        .get("relation")
        .and_then(|v| v.as_str())
        .unwrap_or("Friend")
        .to_string();
    let resource_id = data
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
    .bind(data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(NpcOutput::from(row))
}

pub async fn delete(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<Uuid> {
    crud::entity_delete(
        pool,
        game_id,
        id,
        "DELETE FROM npcs WHERE id = $1 AND game_id = $2",
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
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("npc");

        if item_type == "resource" {
            let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_lowercase();
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            match upsert_npc_resource(&mut *tx, game_id, &key, &name, &data).await {
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
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("未命名NPC").to_string();
            let kind = item.get("kind").and_then(|v| v.as_str()).unwrap_or("Normal");
            let relation = item.get("relation").and_then(|v| v.as_str()).unwrap_or("Friend");
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            let resource_id = if let Some(res_data) = item.get("npcResData") {
                let res_key = item.get("npcResKey").and_then(|v| v.as_str()).unwrap_or(&key);
                upsert_npc_resource(&mut *tx, game_id, res_key, res_key, res_data).await.ok()
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
            .fetch_one(&mut *tx)
            .await
            {
                Ok(row) => {
                    success.push(serde_json::json!({
                        "fileName": file_name, "id": row.id, "name": row.name,
                        "type": "npc", "hasResources": resource_id.is_some(),
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

// ── NPC Resource service functions ────────────────

pub async fn list_resources(pool: &sqlx::PgPool, game_id: Uuid) -> ApiResult<Vec<NpcResOutput>> {
    let rows = sqlx::query_as::<_, NpcResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at \
         FROM npc_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(NpcResOutput::from).collect())
}

pub async fn get_resource(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<NpcResOutput> {
    let row = sqlx::query_as::<_, NpcResRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at \
         FROM npc_resources WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;
    let row = row.ok_or_else(|| ApiError::not_found("NPC资源不存在"))?;
    Ok(NpcResOutput::from(row))
}

pub async fn create_resource(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    key: &str,
    data: &serde_json::Value,
) -> ApiResult<NpcResOutput> {
    let key = validate_key(key)?.to_lowercase();
    let name = data.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();

    let row = sqlx::query_as::<_, NpcResRow>(
        "INSERT INTO npc_resources (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
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

    Ok(NpcResOutput::from(row))
}

pub async fn update_resource(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    data: &serde_json::Value,
) -> ApiResult<NpcResOutput> {
    let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let row = sqlx::query_as::<_, NpcResRow>(
        "UPDATE npc_resources SET name = $1, data = $2, updated_at = NOW() WHERE id = $3 AND game_id = $4 \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("NPC资源不存在"))?;
    Ok(NpcResOutput::from(row))
}

pub async fn delete_resource(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<Uuid> {
    let result = sqlx::query("DELETE FROM npc_resources WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("NPC资源不存在"));
    }
    Ok(id)
}

/// Internal upsert for NPC resource (used during batch import).
pub async fn upsert_npc_resource<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
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
    .fetch_one(executor)
    .await?;
    Ok(row.0)
}

/// Public: list all NPCs for a game slug (no auth).
pub async fn list_public(
    state: &crate::state::AppState,
    slug: &str,
) -> ApiResult<axum::Json<Vec<NpcOutput>>> {
    crud::entity_list_public::<NpcRow, NpcOutput>(
        state,
        slug,
        "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at \
         FROM npcs WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}

/// Public: list all NPC resources for a game slug (no auth).
pub async fn list_resources_public(
    state: &crate::state::AppState,
    slug: &str,
) -> ApiResult<axum::Json<Vec<NpcResOutput>>> {
    crud::entity_list_public::<NpcResRow, NpcResOutput>(
        state,
        slug,
        "SELECT id, game_id, key, name, data, created_at, updated_at \
         FROM npc_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}
