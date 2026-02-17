use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::error::ApiResult;
use crate::routes::crud::resolve_game_id_by_slug;
use crate::state::AppState;

/// Allowed table names for dynamic queries (prevent SQL injection via table names).
const ALLOWED_TABLES: &[&str] = &[
    "magics",
    "goods",
    "shops",
    "npcs",
    "npc_resources",
    "objs",
    "obj_resources",
    "players",
    "talk_portraits",
    "talks",
    "level_configs",
    "game_configs",
    "scenes",
];

fn validate_table_name(table: &str) -> Result<&str, sqlx::Error> {
    if ALLOWED_TABLES.contains(&table) {
        Ok(table)
    } else {
        Err(sqlx::Error::Protocol(format!(
            "Invalid table name: {table}"
        )))
    }
}

/// Aggregation endpoint — builds full game data for the engine runtime.
/// GET /game/:gameSlug/api/data
pub async fn build_game_data(
    State(state): State<AppState>,
    Path(game_slug): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let pool = &state.db.pool;

    // Parallel fetches
    let (magics_res, goods_res, shops_res, npcs_res, npc_res_res, objs_res, obj_res_res, players_res, portraits_res, talks_res) = tokio::join!(
        fetch_all_with_extra(pool, "magics", game_id, &["name", "user_type"]),
        fetch_all_with_extra(pool, "goods", game_id, &["kind"]),
        fetch_all_with_extra(pool, "shops", game_id, &["name"]),
        fetch_all_with_extra(pool, "npcs", game_id, &["name", "kind", "relation", "resource_id"]),
        fetch_all_resources(pool, "npc_resources", game_id),
        fetch_all_with_extra(pool, "objs", game_id, &["name", "kind", "resource_id"]),
        fetch_all_resources(pool, "obj_resources", game_id),
        fetch_all_with_extra(pool, "players", game_id, &["name", "index"]),
        fetch_singleton(pool, "talk_portraits", game_id),
        fetch_singleton(pool, "talks", game_id),
    );

    let magics = magics_res.unwrap_or_default();
    let goods = goods_res.unwrap_or_default();
    let shops = shops_res.unwrap_or_default();
    let npcs = npcs_res.unwrap_or_default();
    let npc_resources = npc_res_res.unwrap_or_default();
    let objs = objs_res.unwrap_or_default();
    let obj_resources = obj_res_res.unwrap_or_default();
    let players = players_res.unwrap_or_default();
    let portraits = portraits_res.unwrap_or(serde_json::json!([]));
    let talks = talks_res.unwrap_or(serde_json::json!([]));

    // Split magics by userType (extracted from data or default "Player")
    let mut player_magics = Vec::new();
    let mut npc_magics = Vec::new();
    for m in &magics {
        let user_type = m.get("userType")
            .and_then(|v| v.as_str())
            .or_else(|| m.get("data").and_then(|d| d.get("userType")).and_then(|v| v.as_str()))
            .unwrap_or("Player");
        match user_type {
            "Npc" => npc_magics.push(m.clone()),
            _ => player_magics.push(m.clone()),
        }
    }

    // Build NPC resources map for merging
    let npc_res_map = build_resource_map(&npc_resources, "resources.stand.image");
    let obj_res_map = build_resource_map(&obj_resources, "resources.common.image");

    // Merge resource info into npcs
    let npcs_with_res: Vec<serde_json::Value> = npcs.iter().map(|npc| {
        let mut n = npc.clone();
        if let Some(rid) = npc.get("resourceId").and_then(|v| v.as_str()) {
            if let Some(res_info) = npc_res_map.get(rid) {
                n.as_object_mut().map(|obj| {
                    obj.insert("resourceKey".to_string(), serde_json::Value::String(res_info.0.clone()));
                    obj.insert("resourceIcon".to_string(), serde_json::Value::String(res_info.1.clone()));
                });
            }
        }
        n
    }).collect();

    let objs_with_res: Vec<serde_json::Value> = objs.iter().map(|obj_val| {
        let mut o = obj_val.clone();
        if let Some(rid) = obj_val.get("resourceId").and_then(|v| v.as_str()) {
            if let Some(res_info) = obj_res_map.get(rid) {
                o.as_object_mut().map(|obj| {
                    obj.insert("resourceKey".to_string(), serde_json::Value::String(res_info.0.clone()));
                    obj.insert("resourceIcon".to_string(), serde_json::Value::String(res_info.1.clone()));
                });
            }
        }
        o
    }).collect();

    // Build portraits array: [{ index, asfFile }, ...]
    let portrait_arr: serde_json::Value = if let Some(arr) = portraits.as_array() {
        serde_json::Value::Array(
            arr.iter()
                .filter_map(|p| {
                    let idx = p.get("idx").and_then(|v| v.as_i64())?;
                    let file = p.get("file").and_then(|v| v.as_str())?;
                    Some(serde_json::json!({ "index": idx, "asfFile": file }))
                })
                .collect(),
        )
    } else {
        serde_json::json!([])
    };

    Ok(Json(serde_json::json!({
        "magics": {
            "player": player_magics,
            "npc": npc_magics,
        },
        "goods": goods,
        "shops": shops,
        "npcs": {
            "npcs": npcs_with_res,
            "resources": npc_resources,
        },
        "objs": {
            "objs": objs_with_res,
            "resources": obj_resources,
        },
        "players": players,
        "portraits": portrait_arr,
        "talks": talks,
    })))
}

// Helper: fetch all rows with extra indexed columns
async fn fetch_all_with_extra(
    pool: &sqlx::PgPool,
    table: &str,
    game_id: Uuid,
    extra_cols: &[&str],
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let table = validate_table_name(table)?;
    let extra_select = extra_cols.join(", ");
    let query = format!(
        "SELECT id, game_id, key, data, {}, created_at, updated_at FROM {} WHERE game_id = $1 ORDER BY updated_at DESC",
        extra_select, table
    );

    // Use raw query and process rows manually
    let rows = sqlx::query(&query)
        .bind(game_id)
        .fetch_all(pool)
        .await?;

    use sqlx::Row;
    Ok(rows.iter().map(|row| {
        let id: Uuid = row.get("id");
        let gid: Uuid = row.get("game_id");
        let key: String = row.get("key");
        let data: serde_json::Value = row.get("data");
        let created_at: Option<chrono::DateTime<chrono::Utc>> = row.get("created_at");
        let updated_at: Option<chrono::DateTime<chrono::Utc>> = row.get("updated_at");

        let mut val = data;
        if let Some(obj) = val.as_object_mut() {
            obj.insert("id".to_string(), serde_json::Value::String(id.to_string()));
            obj.insert("gameId".to_string(), serde_json::Value::String(gid.to_string()));
            obj.insert("key".to_string(), serde_json::Value::String(key));
            if let Some(c) = created_at {
                obj.insert("createdAt".to_string(), serde_json::Value::String(c.to_rfc3339()));
            }
            if let Some(u) = updated_at {
                obj.insert("updatedAt".to_string(), serde_json::Value::String(u.to_rfc3339()));
            }

            // Add extra columns with camelCase conversion
            for col in extra_cols {
                let camel = snake_to_camel(col);
                // Try to get the column value as various types
                if let Ok(v) = row.try_get::<Option<String>, _>(*col) {
                    if let Some(v) = v {
                        obj.insert(camel, serde_json::Value::String(v));
                    }
                } else if let Ok(v) = row.try_get::<Option<i32>, _>(*col) {
                    if let Some(v) = v {
                        obj.insert(camel, serde_json::json!(v));
                    }
                } else if let Ok(v) = row.try_get::<Option<Uuid>, _>(*col) {
                    if let Some(v) = v {
                        obj.insert(camel, serde_json::Value::String(v.to_string()));
                    }
                }
            }
        }
        val
    }).collect())
}

// Helper: fetch all resource rows (npc_resources / obj_resources)
// Returns {id, gameId, key, name, resources, createdAt, updatedAt}
async fn fetch_all_resources(
    pool: &sqlx::PgPool,
    table: &str,
    game_id: Uuid,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let table = validate_table_name(table)?;
    let query = format!(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM {} WHERE game_id = $1 ORDER BY updated_at DESC",
        table
    );
    let rows = sqlx::query(&query)
        .bind(game_id)
        .fetch_all(pool)
        .await?;

    use sqlx::Row;
    Ok(rows.iter().map(|row| {
        let id: Uuid = row.get("id");
        let gid: Uuid = row.get("game_id");
        let key: String = row.get("key");
        let name: String = row.get("name");
        let data: serde_json::Value = row.get("data");
        let created_at: Option<chrono::DateTime<chrono::Utc>> = row.get("created_at");
        let updated_at: Option<chrono::DateTime<chrono::Utc>> = row.get("updated_at");

        let resources = data.get("resources").cloned().unwrap_or(serde_json::json!({}));

        let mut obj = serde_json::Map::new();
        obj.insert("id".to_string(), serde_json::Value::String(id.to_string()));
        obj.insert("gameId".to_string(), serde_json::Value::String(gid.to_string()));
        obj.insert("key".to_string(), serde_json::Value::String(key));
        obj.insert("name".to_string(), serde_json::Value::String(name));
        obj.insert("resources".to_string(), resources);
        if let Some(c) = created_at {
            obj.insert("createdAt".to_string(), serde_json::Value::String(c.to_rfc3339()));
        }
        if let Some(u) = updated_at {
            obj.insert("updatedAt".to_string(), serde_json::Value::String(u.to_rfc3339()));
        }
        serde_json::Value::Object(obj)
    }).collect())
}

// Helper: fetch singleton data (talks, talk_portraits)
async fn fetch_singleton(
    pool: &sqlx::PgPool,
    table: &str,
    game_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    let table = validate_table_name(table)?;
    let query = format!("SELECT data FROM {} WHERE game_id = $1 LIMIT 1", table);
    let row: Option<(serde_json::Value,)> = sqlx::query_as(&query)
        .bind(game_id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|(d,)| d).unwrap_or(serde_json::json!([])))
}

// Build a resource map: resource_id -> (key, icon)
fn build_resource_map(
    resources: &[serde_json::Value],
    icon_path: &str,
) -> std::collections::HashMap<String, (String, String)> {
    let mut map = std::collections::HashMap::new();
    for res in resources {
        let id = res.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let key = res.get("key").and_then(|v| v.as_str()).unwrap_or("");
        // Navigate the icon path (e.g., "resources.stand.image")
        let icon = {
            let parts: Vec<&str> = icon_path.split('.').collect();
            let mut current = res.get("data").or(Some(res));
            for part in &parts {
                current = current.and_then(|v| v.get(*part));
            }
            current
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        };
        if !id.is_empty() {
            map.insert(id.to_string(), (key.to_string(), icon));
        }
    }
    map
}

fn snake_to_camel(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;
    for (i, c) in s.chars().enumerate() {
        if c == '_' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_uppercase().next().unwrap_or(c));
            capitalize_next = false;
        } else if i == 0 {
            result.push(c);
        } else {
            result.push(c);
        }
    }
    result
}
