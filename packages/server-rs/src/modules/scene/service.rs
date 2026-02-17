//! Scene service: business logic for scene CRUD, MMF parsing, and public queries.
//! No axum/HTTP dependencies — pure DB + data operations.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::utils::{fmt_ts, validate_batch_items, validate_key};

// ── Row / Output types ────────────────────────────

#[derive(sqlx::FromRow)]
pub struct SceneRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub map_file_name: Option<String>,
    pub data: serde_json::Value,
    pub mmf_data: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneOutput {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub name: String,
    pub map_file_name: Option<String>,
    pub data: serde_json::Value,
    pub map_parsed: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&SceneRow> for SceneOutput {
    fn from(r: &SceneRow) -> Self {
        let map_parsed = r
            .mmf_data
            .as_deref()
            .and_then(|b64| parse_mmf_to_dto(b64).ok());
        Self {
            id: r.id,
            game_id: r.game_id,
            key: r.key.clone(),
            name: r.name.clone(),
            map_file_name: r.map_file_name.clone(),
            data: r.data.clone(),
            map_parsed,
            created_at: fmt_ts(r.created_at),
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneListItem {
    pub id: Uuid,
    pub key: String,
    pub name: String,
    pub map_file_name: Option<String>,
    pub script_count: usize,
    pub trap_count: usize,
    pub npc_count: usize,
    pub obj_count: usize,
    pub script_keys: Vec<String>,
    pub trap_keys: Vec<String>,
    pub npc_keys: Vec<String>,
    pub obj_keys: Vec<String>,
    pub updated_at: String,
}

impl From<&SceneRow> for SceneListItem {
    fn from(r: &SceneRow) -> Self {
        let (script_keys, trap_keys, npc_keys, obj_keys) = get_scene_data_counts(&r.data);
        Self {
            id: r.id,
            key: r.key.clone(),
            name: r.name.clone(),
            map_file_name: r.map_file_name.clone(),
            script_count: script_keys.len(),
            trap_count: trap_keys.len(),
            npc_count: npc_keys.len(),
            obj_count: obj_keys.len(),
            script_keys,
            trap_keys,
            npc_keys,
            obj_keys,
            updated_at: fmt_ts(r.updated_at),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearAllResult {
    pub deleted_count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResultEntry {
    pub ok: bool,
    pub scene_name: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ── Input types ───────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSceneInput {
    pub game_id: String,
    pub key: String,
    pub name: Option<String>,
    pub map_file_name: Option<String>,
    pub data: serde_json::Value,
    pub mmf_data: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSceneBatchInput {
    pub game_id: String,
    pub scenes: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearAllInput {
    pub game_id: String,
}

// ── Service functions ─────────────────────────────

pub async fn list(pool: &sqlx::PgPool, game_id: Uuid) -> ApiResult<Vec<SceneListItem>> {
    let rows = sqlx::query_as::<_, SceneRow>(
        "SELECT id, game_id, key, name, map_file_name, data, mmf_data, created_at, updated_at \
         FROM scenes WHERE game_id = $1 ORDER BY key ASC",
    )
    .bind(game_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.iter().map(SceneListItem::from).collect())
}

pub async fn get(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<SceneOutput> {
    let row = sqlx::query_as::<_, SceneRow>(
        "SELECT id, game_id, key, name, map_file_name, data, mmf_data, created_at, updated_at \
         FROM scenes WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;
    let r = row.ok_or_else(|| ApiError::not_found("场景不存在"))?;
    Ok(SceneOutput::from(&r))
}

pub async fn create(pool: &sqlx::PgPool, game_id: Uuid, input: &CreateSceneInput) -> ApiResult<SceneOutput> {
    let key = validate_key(&input.key)?;
    let name = input.name.as_deref().unwrap_or(&key);

    let row = sqlx::query_as::<_, SceneRow>(
        "INSERT INTO scenes (game_id, key, name, map_file_name, data, mmf_data) VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, game_id, key, name, map_file_name, data, mmf_data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(name)
    .bind(&input.map_file_name)
    .bind(&input.data)
    .bind(&input.mmf_data)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return ApiError::bad_request(format!("Key '{}' 已存在", input.key));
            }
        }
        ApiError::Database(e)
    })?;

    Ok(SceneOutput::from(&row))
}

pub async fn update(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    id: Uuid,
    input: &CreateSceneInput,
) -> ApiResult<SceneOutput> {
    let name = input.name.as_deref().unwrap_or(&input.key);

    let row = sqlx::query_as::<_, SceneRow>(
        "UPDATE scenes SET name = $1, map_file_name = $2, data = $3, mmf_data = COALESCE($4, mmf_data), updated_at = NOW() \
         WHERE id = $5 AND game_id = $6 \
         RETURNING id, game_id, key, name, map_file_name, data, mmf_data, created_at, updated_at",
    )
    .bind(name)
    .bind(&input.map_file_name)
    .bind(&input.data)
    .bind(&input.mmf_data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("场景不存在"))?;
    Ok(SceneOutput::from(&row))
}

pub async fn delete(pool: &sqlx::PgPool, game_id: Uuid, id: Uuid) -> ApiResult<Uuid> {
    let result = sqlx::query("DELETE FROM scenes WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("场景不存在"));
    }
    Ok(id)
}

pub async fn import(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    scenes: &[serde_json::Value],
) -> ApiResult<Vec<ImportResultEntry>> {
    validate_batch_items(scenes)?;
    let mut results = Vec::new();
    let mut tx = pool.begin().await?;

    for scene in scenes {
        let key = scene
            .get("key")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let name = scene.get("name").and_then(|v| v.as_str()).unwrap_or(key);
        let map_file_name = scene.get("mapFileName").and_then(|v| v.as_str());
        let data = scene.get("data").cloned().unwrap_or(serde_json::json!({}));
        let mmf_data = scene.get("mmfData").and_then(|v| v.as_str());

        match sqlx::query_as::<_, SceneRow>(
            "INSERT INTO scenes (game_id, key, name, map_file_name, data, mmf_data) VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (game_id, key) DO UPDATE SET name = $3, map_file_name = $4, data = $5, mmf_data = COALESCE($6, scenes.mmf_data), updated_at = NOW() \
             RETURNING id, game_id, key, name, map_file_name, data, mmf_data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(key)
        .bind(name)
        .bind(map_file_name)
        .bind(&data)
        .bind(mmf_data)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(_row) => {
                results.push(ImportResultEntry {
                    ok: true,
                    scene_name: name.to_string(),
                    action: "upserted".to_string(),
                    error: None,
                });
            }
            Err(e) => {
                results.push(ImportResultEntry {
                    ok: false,
                    scene_name: name.to_string(),
                    action: "error".to_string(),
                    error: Some(e.to_string()),
                });
            }
        }
    }

    tx.commit().await?;
    Ok(results)
}

pub async fn clear_all(pool: &sqlx::PgPool, game_id: Uuid) -> ApiResult<ClearAllResult> {
    let result = sqlx::query("DELETE FROM scenes WHERE game_id = $1")
        .bind(game_id)
        .execute(pool)
        .await?;
    Ok(ClearAllResult {
        deleted_count: result.rows_affected(),
    })
}

// ── Public queries (no auth) ──────────────────────

/// Get raw MMF binary (base64 → bytes).
pub async fn get_mmf_bytes(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    scene_key: &str,
) -> ApiResult<Vec<u8>> {
    let mmf_data: Option<Option<String>> =
        sqlx::query_scalar("SELECT mmf_data FROM scenes WHERE game_id = $1 AND key = $2 LIMIT 1")
            .bind(game_id)
            .bind(scene_key)
            .fetch_optional(pool)
            .await?;

    let mmf_base64 = mmf_data
        .flatten()
        .ok_or_else(|| ApiError::not_found("MMF data not found"))?;

    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(&mmf_base64)
        .map_err(|_| ApiError::internal("Failed to decode MMF data"))
}

/// Get scene item entries (npc/obj) by section and key.
pub async fn get_item_entries(
    pool: &sqlx::PgPool,
    game_id: Uuid,
    scene_key: &str,
    section: &str,
    item_key: &str,
) -> ApiResult<serde_json::Value> {
    let data: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT data FROM scenes WHERE game_id = $1 AND key = $2 LIMIT 1")
            .bind(game_id)
            .bind(scene_key)
            .fetch_optional(pool)
            .await?;

    let data = data.ok_or_else(|| ApiError::not_found("Scene not found"))?;
    Ok(data
        .get(section)
        .and_then(|n| n.get(item_key))
        .and_then(|n| n.get("entries"))
        .cloned()
        .unwrap_or(serde_json::Value::Null))
}

// ── Helpers ───────────────────────────────────────

fn get_scene_data_counts(
    data: &serde_json::Value,
) -> (Vec<String>, Vec<String>, Vec<String>, Vec<String>) {
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

/// Parse MMF binary (base64-encoded) into a JSON-safe MiuMapDataDto.
fn parse_mmf_to_dto(mmf_base64: &str) -> Result<serde_json::Value, String> {
    use base64::Engine;

    let data = base64::engine::general_purpose::STANDARD
        .decode(mmf_base64)
        .map_err(|e| format!("base64 decode failed: {e}"))?;

    if data.len() < 20 {
        return Err("MMF data too short".into());
    }

    if &data[0..4] != b"MMF1" {
        return Err("Invalid MMF magic".into());
    }

    let version = u16::from_le_bytes([data[4], data[5]]);
    let flags = u16::from_le_bytes([data[6], data[7]]);
    if version != 1 {
        return Err(format!("Unsupported MMF version: {version}"));
    }

    let mut offset = 8usize;

    let columns = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
    offset += 2;
    let rows = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
    offset += 2;
    let msf_count = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
    offset += 2;
    let trap_count = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
    offset += 2;
    offset += 4; // reserved

    let map_pixel_width = (columns.saturating_sub(1)) * 64;
    let map_pixel_height = (((rows.saturating_sub(3)) / 2) + 1) * 32;

    // MSF entries
    let mut msf_entries = Vec::with_capacity(msf_count);
    for _ in 0..msf_count {
        if offset >= data.len() {
            break;
        }
        let name_len = data[offset] as usize;
        offset += 1;
        if offset + name_len > data.len() {
            break;
        }
        let name = String::from_utf8_lossy(&data[offset..offset + name_len]).into_owned();
        offset += name_len;
        if offset >= data.len() {
            break;
        }
        let entry_flags = data[offset];
        offset += 1;
        msf_entries.push(serde_json::json!({
            "name": name,
            "looping": (entry_flags & 1) != 0,
        }));
    }

    // Trap table
    let mut trap_table = Vec::with_capacity(trap_count);
    if flags & 0x02 != 0 {
        for _ in 0..trap_count {
            if offset >= data.len() {
                break;
            }
            let trap_index = data[offset] as u32;
            offset += 1;
            if offset + 2 > data.len() {
                break;
            }
            let path_len = u16::from_le_bytes([data[offset], data[offset + 1]]) as usize;
            offset += 2;
            if offset + path_len > data.len() {
                break;
            }
            let script_path =
                String::from_utf8_lossy(&data[offset..offset + path_len]).into_owned();
            offset += path_len;
            trap_table.push(serde_json::json!({
                "trapIndex": trap_index,
                "scriptPath": script_path,
            }));
        }
    }

    // Skip extension chunks until END sentinel
    while offset + 8 <= data.len() {
        let chunk_id = &data[offset..offset + 4];
        let chunk_len = u32::from_le_bytes([
            data[offset + 4],
            data[offset + 5],
            data[offset + 6],
            data[offset + 7],
        ]) as usize;
        offset += 8;
        if chunk_id == b"END\0" {
            break;
        }
        offset += chunk_len;
    }

    // Decompress tile blob
    let compressed = &data[offset..];
    let blob: Vec<u8> = if flags & 0x01 != 0 {
        zstd::decode_all(compressed).map_err(|e| format!("zstd decompress failed: {e}"))?
    } else {
        compressed.to_vec()
    };

    let total_tiles = columns * rows;
    let expected_blob_size = total_tiles * 8;
    if blob.len() < expected_blob_size {
        return Err(format!(
            "Tile blob too small: {} < {expected_blob_size}",
            blob.len()
        ));
    }

    let encoder = base64::engine::general_purpose::STANDARD;
    let mut bo = 0usize;
    let layer1 = encoder.encode(&blob[bo..bo + total_tiles * 2]);
    bo += total_tiles * 2;
    let layer2 = encoder.encode(&blob[bo..bo + total_tiles * 2]);
    bo += total_tiles * 2;
    let layer3 = encoder.encode(&blob[bo..bo + total_tiles * 2]);
    bo += total_tiles * 2;
    let barriers = encoder.encode(&blob[bo..bo + total_tiles]);
    bo += total_tiles;
    let traps = encoder.encode(&blob[bo..bo + total_tiles]);

    Ok(serde_json::json!({
        "mapColumnCounts": columns,
        "mapRowCounts": rows,
        "mapPixelWidth": map_pixel_width,
        "mapPixelHeight": map_pixel_height,
        "msfEntries": msf_entries,
        "trapTable": trap_table,
        "layer1": layer1,
        "layer2": layer2,
        "layer3": layer3,
        "barriers": barriers,
        "traps": traps,
    }))
}
