//! Data service: aggregation logic for building full game data.
//! No axum/HTTP dependencies — pure DB + data operations.

use uuid::Uuid;

use crate::error::{ApiError, ApiResult};

// ── Static SQL query definitions ─────────────────────────

/// Entity table queries — each variant carries its own static SQL
/// and the list of extra columns to extract from the result row.
enum EntityQuery {
    Magics,
    Goods,
    Shops,
    Npcs,
    Objs,
    Players,
}

impl EntityQuery {
    const fn sql(&self) -> &'static str {
        match self {
            Self::Magics => {
                "SELECT id, game_id, key, data, name, user_type, created_at, updated_at \
                 FROM magics WHERE game_id = $1 ORDER BY updated_at DESC"
            }
            Self::Goods => {
                "SELECT id, game_id, key, data, kind, created_at, updated_at \
                 FROM goods WHERE game_id = $1 ORDER BY updated_at DESC"
            }
            Self::Shops => {
                "SELECT id, game_id, key, data, name, created_at, updated_at \
                 FROM shops WHERE game_id = $1 ORDER BY updated_at DESC"
            }
            Self::Npcs => {
                "SELECT id, game_id, key, data, name, kind, relation, resource_id, created_at, updated_at \
                 FROM npcs WHERE game_id = $1 ORDER BY updated_at DESC"
            }
            Self::Objs => {
                "SELECT id, game_id, key, data, name, kind, resource_id, created_at, updated_at \
                 FROM objs WHERE game_id = $1 ORDER BY updated_at DESC"
            }
            Self::Players => {
                "SELECT id, game_id, key, data, name, \"index\", created_at, updated_at \
                 FROM players WHERE game_id = $1 ORDER BY updated_at DESC"
            }
        }
    }

    const fn extra_cols(&self) -> &'static [&'static str] {
        match self {
            Self::Magics => &["name", "user_type"],
            Self::Goods => &["kind"],
            Self::Shops => &["name"],
            Self::Npcs => &["name", "kind", "relation", "resource_id"],
            Self::Objs => &["name", "kind", "resource_id"],
            Self::Players => &["name", "index"],
        }
    }
}

enum ResourceQuery {
    NpcResources,
    ObjResources,
}

impl ResourceQuery {
    const fn sql(&self) -> &'static str {
        match self {
            Self::NpcResources => {
                "SELECT id, game_id, key, name, data, created_at, updated_at \
                 FROM npc_resources WHERE game_id = $1 ORDER BY updated_at DESC"
            }
            Self::ObjResources => {
                "SELECT id, game_id, key, name, data, created_at, updated_at \
                 FROM obj_resources WHERE game_id = $1 ORDER BY updated_at DESC"
            }
        }
    }
}

enum SingletonQuery {
    TalkPortraits,
    Talks,
}

impl SingletonQuery {
    const fn sql(&self) -> &'static str {
        match self {
            Self::TalkPortraits => "SELECT data FROM talk_portraits WHERE game_id = $1 LIMIT 1",
            Self::Talks => "SELECT data FROM talks WHERE game_id = $1 LIMIT 1",
        }
    }
}

/// Build the full aggregated game data for the engine runtime.
pub async fn build_game_data(pool: &sqlx::PgPool, game_id: Uuid) -> ApiResult<serde_json::Value> {
    // Parallel fetches — all SQL is static, no format!()
    let (
        magics_res,
        goods_res,
        shops_res,
        npcs_res,
        npc_res_res,
        objs_res,
        obj_res_res,
        players_res,
        portraits_res,
        talks_res,
    ) = tokio::join!(
        fetch_entity_rows(pool, EntityQuery::Magics, game_id),
        fetch_entity_rows(pool, EntityQuery::Goods, game_id),
        fetch_entity_rows(pool, EntityQuery::Shops, game_id),
        fetch_entity_rows(pool, EntityQuery::Npcs, game_id),
        fetch_resource_rows(pool, ResourceQuery::NpcResources, game_id),
        fetch_entity_rows(pool, EntityQuery::Objs, game_id),
        fetch_resource_rows(pool, ResourceQuery::ObjResources, game_id),
        fetch_entity_rows(pool, EntityQuery::Players, game_id),
        fetch_singleton_data(pool, SingletonQuery::TalkPortraits, game_id),
        fetch_singleton_data(pool, SingletonQuery::Talks, game_id),
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

    // Split magics by userType
    let mut player_magics = Vec::new();
    let mut npc_magics = Vec::new();
    for m in &magics {
        let user_type = m
            .get("userType")
            .and_then(|v| v.as_str())
            .or_else(|| {
                m.get("data")
                    .and_then(|d| d.get("userType"))
                    .and_then(|v| v.as_str())
            })
            .unwrap_or("Player");
        match user_type {
            "Npc" => npc_magics.push(m.clone()),
            _ => player_magics.push(m.clone()),
        }
    }

    // Build resource maps for merging
    let npc_res_map = build_resource_map(&npc_resources, "resources.stand.image");
    let obj_res_map = build_resource_map(&obj_resources, "resources.common.image");

    // Merge resource info into npcs
    let npcs_with_res: Vec<serde_json::Value> = npcs
        .iter()
        .map(|npc| {
            let mut n = npc.clone();
            if let Some(rid) = npc.get("resourceId").and_then(|v| v.as_str()) {
                if let Some(res_info) = npc_res_map.get(rid) {
                    n.as_object_mut().map(|obj| {
                        obj.insert(
                            "resourceKey".to_string(),
                            serde_json::Value::String(res_info.0.clone()),
                        );
                        obj.insert(
                            "resourceIcon".to_string(),
                            serde_json::Value::String(res_info.1.clone()),
                        );
                    });
                }
            }
            n
        })
        .collect();

    let objs_with_res: Vec<serde_json::Value> = objs
        .iter()
        .map(|obj_val| {
            let mut o = obj_val.clone();
            if let Some(rid) = obj_val.get("resourceId").and_then(|v| v.as_str()) {
                if let Some(res_info) = obj_res_map.get(rid) {
                    o.as_object_mut().map(|obj| {
                        obj.insert(
                            "resourceKey".to_string(),
                            serde_json::Value::String(res_info.0.clone()),
                        );
                        obj.insert(
                            "resourceIcon".to_string(),
                            serde_json::Value::String(res_info.1.clone()),
                        );
                    });
                }
            }
            o
        })
        .collect();

    // Build portraits array
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

    Ok(serde_json::json!({
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
    }))
}

// ── Query execution helpers (no format! SQL) ─────────────

async fn fetch_entity_rows(
    pool: &sqlx::PgPool,
    query: EntityQuery,
    game_id: Uuid,
) -> Result<Vec<serde_json::Value>, ApiError> {
    let rows = sqlx::query(query.sql())
        .bind(game_id)
        .fetch_all(pool)
        .await?;

    let extra_cols = query.extra_cols();

    use sqlx::Row;
    Ok(rows
        .iter()
        .map(|row| {
            let id: Uuid = row.get("id");
            let gid: Uuid = row.get("game_id");
            let key: String = row.get("key");
            let data: serde_json::Value = row.get("data");
            let created_at: Option<chrono::DateTime<chrono::Utc>> = row.get("created_at");
            let updated_at: Option<chrono::DateTime<chrono::Utc>> = row.get("updated_at");

            let mut val = data;
            if let Some(obj) = val.as_object_mut() {
                obj.insert("id".to_string(), serde_json::Value::String(id.to_string()));
                obj.insert(
                    "gameId".to_string(),
                    serde_json::Value::String(gid.to_string()),
                );
                obj.insert("key".to_string(), serde_json::Value::String(key));
                obj.insert(
                    "createdAt".to_string(),
                    serde_json::Value::String(crate::utils::fmt_ts(created_at)),
                );
                obj.insert(
                    "updatedAt".to_string(),
                    serde_json::Value::String(crate::utils::fmt_ts(updated_at)),
                );

                for col in extra_cols {
                    let camel = snake_to_camel(col);
                    if let Ok(Some(v)) = row.try_get::<Option<String>, _>(*col) {
                        obj.insert(camel, serde_json::Value::String(v));
                    } else if let Ok(Some(v)) = row.try_get::<Option<i32>, _>(*col) {
                        obj.insert(camel, serde_json::json!(v));
                    } else if let Ok(Some(v)) = row.try_get::<Option<Uuid>, _>(*col) {
                        obj.insert(camel, serde_json::Value::String(v.to_string()));
                    }
                }
            }
            val
        })
        .collect())
}

async fn fetch_resource_rows(
    pool: &sqlx::PgPool,
    query: ResourceQuery,
    game_id: Uuid,
) -> Result<Vec<serde_json::Value>, ApiError> {
    let rows = sqlx::query(query.sql())
        .bind(game_id)
        .fetch_all(pool)
        .await?;

    use sqlx::Row;
    Ok(rows
        .iter()
        .map(|row| {
            let id: Uuid = row.get("id");
            let gid: Uuid = row.get("game_id");
            let key: String = row.get("key");
            let name: String = row.get("name");
            let data: serde_json::Value = row.get("data");
            let created_at: Option<chrono::DateTime<chrono::Utc>> = row.get("created_at");
            let updated_at: Option<chrono::DateTime<chrono::Utc>> = row.get("updated_at");

            let resources = data
                .get("resources")
                .cloned()
                .unwrap_or(serde_json::json!({}));

            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), serde_json::Value::String(id.to_string()));
            obj.insert(
                "gameId".to_string(),
                serde_json::Value::String(gid.to_string()),
            );
            obj.insert("key".to_string(), serde_json::Value::String(key));
            obj.insert("name".to_string(), serde_json::Value::String(name));
            obj.insert("resources".to_string(), resources);
            obj.insert(
                "createdAt".to_string(),
                serde_json::Value::String(crate::utils::fmt_ts(created_at)),
            );
            obj.insert(
                "updatedAt".to_string(),
                serde_json::Value::String(crate::utils::fmt_ts(updated_at)),
            );
            serde_json::Value::Object(obj)
        })
        .collect())
}

async fn fetch_singleton_data(
    pool: &sqlx::PgPool,
    query: SingletonQuery,
    game_id: Uuid,
) -> Result<serde_json::Value, ApiError> {
    let data: Option<serde_json::Value> = sqlx::query_scalar(query.sql())
        .bind(game_id)
        .fetch_optional(pool)
        .await?;
    Ok(data.unwrap_or(serde_json::json!([])))
}

fn build_resource_map(
    resources: &[serde_json::Value],
    icon_path: &str,
) -> std::collections::HashMap<String, (String, String)> {
    let mut map = std::collections::HashMap::new();
    for res in resources {
        let id = res.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let key = res.get("key").and_then(|v| v.as_str()).unwrap_or("");
        let icon = {
            let parts: Vec<&str> = icon_path.split('.').collect();
            let mut current = res.get("data").or(Some(res));
            for part in &parts {
                current = current.and_then(|v| v.get(*part));
            }
            current.and_then(|v| v.as_str()).unwrap_or("").to_string()
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
