use axum::Json;
use axum::extract::{Path, Query, State};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{
    self, BatchImportInput, DeleteResult, GameQuery, UpdateEntityInput, verify_game_access,
};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;
use crate::utils::{extract_data_map, fmt_ts, validate_batch_items, validate_key};

const NOT_FOUND: &str = "NPC不存在";

use super::resource::{NpcResOutput, NpcResRow, upsert_npc_resource};

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

/// Typed detail response for NPC.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcOutput {
    id: Uuid,
    game_id: Uuid,
    key: String,
    name: String,
    kind: String,
    relation: String,
    resource_id: Option<Uuid>,
    created_at: String,
    updated_at: String,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

const NPC_EXCLUDE_KEYS: &[&str] = &[
    "id",
    "gameId",
    "key",
    "name",
    "kind",
    "relation",
    "resourceId",
    "createdAt",
    "updatedAt",
];

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

/// List summary item for NPC.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcListItem {
    id: Uuid,
    key: String,
    name: String,
    kind: String,
    relation: String,
    level: i64,
    npc_ini: String,
    icon: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListNpcQuery {
    pub game_id: String,
    pub kind: Option<String>,
    pub relation: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListNpcQuery>,
) -> ApiResult<Json<Vec<NpcListItem>>> {
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

    let items: Vec<NpcListItem> = rows
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

    Ok(Json(items))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<NpcOutput>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    crud::entity_get::<NpcRow, NpcOutput>(
        &state.db.pool,
        game_id,
        id,
        "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at FROM npcs WHERE id = $1 AND game_id = $2 LIMIT 1",
        NOT_FOUND,
    )
    .await
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

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateNpcInput>,
) -> ApiResult<Json<NpcOutput>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
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
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| crud::handle_unique_violation(e, &key))?;

    Ok(Json(NpcOutput::from(row)))
}

pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEntityInput>,
) -> ApiResult<Json<NpcOutput>> {
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
        .unwrap_or("Normal")
        .to_string();
    let relation = input
        .data
        .get("relation")
        .and_then(|v| v.as_str())
        .unwrap_or("Friend")
        .to_string();
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

    let row = row.ok_or_else(|| ApiError::not_found(NOT_FOUND))?;
    Ok(Json(NpcOutput::from(row)))
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
        "DELETE FROM npcs WHERE id = $1 AND game_id = $2",
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
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("npc");

        if item_type == "resource" {
            // Import as NPC resource
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
            // Import as NPC
            let key = item
                .get("key")
                .and_then(|v| v.as_str())
                .unwrap_or(file_name)
                .to_string();
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("未命名NPC")
                .to_string();
            let kind = item
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("Normal");
            let relation = item
                .get("relation")
                .and_then(|v| v.as_str())
                .unwrap_or("Friend");
            let data = item.get("data").cloned().unwrap_or(serde_json::json!({}));

            // Optionally upsert linked resource
            let resource_id = if let Some(res_data) = item.get("npcResData") {
                let res_key = item
                    .get("npcResKey")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&key);
                upsert_npc_resource(&mut *tx, game_id, res_key, res_key, res_data)
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
            .fetch_one(&mut *tx)
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
                    tracing::warn!("Batch import failed for {file_name}: {e}");
                    failed.push(
                        serde_json::json!({"fileName": file_name, "error": "导入失败"}),
                    );
                }
            }
        }
    }

    tx.commit().await?;

    Ok(Json(crate::routes::crud::BatchImportResult {
        success,
        failed,
    }))
}

/// Public: list all NPCs for a game slug (no auth).
pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<NpcOutput>>> {
    crud::entity_list_public::<NpcRow, NpcOutput>(
        &state,
        &game_slug,
        "SELECT id, game_id, key, name, kind, relation, resource_id, data, created_at, updated_at FROM npcs WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}

/// Public: list all NPC resources for a game slug (no auth).
pub async fn list_npc_resources_public_by_slug(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<NpcResOutput>>> {
    crud::entity_list_public::<NpcResRow, NpcResOutput>(
        &state,
        &game_slug,
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM npc_resources WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .await
}
