/// Format an optional timestamp as an ISO 8601 string, falling back to current time.
/// Matches NestJS behavior: `?.toISOString() ?? new Date().toISOString()`
pub fn fmt_ts(ts: Option<chrono::DateTime<chrono::Utc>>) -> String {
    ts.unwrap_or_else(chrono::Utc::now).to_rfc3339()
}

/// Extract save metadata from a JSONB `data` column.
///
/// Used by both user save handlers and admin save handlers to avoid repeated
/// `.get("mapFileName")...` chains in 3+ places.
pub struct SaveMetadata {
    pub map_name: Option<String>,
    pub player_name: Option<String>,
    pub level: Option<i32>,
}

impl SaveMetadata {
    pub fn extract(data: &serde_json::Value) -> Self {
        let map_name = data
            .get("mapFileName")
            .and_then(|v| v.as_str())
            .map(String::from);
        let player_name = data
            .get("player")
            .and_then(|p| p.get("name"))
            .and_then(|v| v.as_str())
            .map(String::from);
        let level = data
            .get("player")
            .and_then(|p| p.get("level"))
            .and_then(|v| v.as_i64())
            .map(|l| l as i32);
        Self {
            map_name,
            player_name,
            level,
        }
    }
}

/// Merge metadata fields into a cloned `data` JSON object.
///
/// Many entity endpoints return the JSONB `data` field with additional
/// DB-column metadata (id, gameId, key, etc.) merged at the top level.
/// This helper handles the clone + insert pattern in one place.
pub fn merge_into_data(
    data: &serde_json::Value,
    fields: &[(&str, serde_json::Value)],
) -> serde_json::Value {
    let mut v = data.clone();
    if let Some(obj) = v.as_object_mut() {
        for (key, value) in fields {
            obj.insert((*key).to_string(), value.clone());
        }
    }
    v
}

/// Extract a JSON object map from a `Value`, stripping keys that overlap with
/// typed struct fields. Used with `#[serde(flatten)]` to avoid duplicate keys.
pub fn extract_data_map(
    data: serde_json::Value,
    exclude: &[&str],
) -> serde_json::Map<String, serde_json::Value> {
    let mut map = match data {
        serde_json::Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    for key in exclude {
        map.remove(*key);
    }
    map
}

// ── Input validation helpers ──────────────────────

use crate::error::{ApiError, ApiResult};

/// Maximum number of items allowed in a batch import.
pub const MAX_BATCH_ITEMS: usize = 5000;

/// Validate a required string field: non-empty after trimming, within max length.
/// Returns the trimmed string on success.
pub fn validate_str(value: &str, field_name: &str, max_len: usize) -> ApiResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request(format!("{field_name}不能为空")));
    }
    if trimmed.len() > max_len {
        return Err(ApiError::bad_request(format!(
            "{field_name}长度不能超过{max_len}个字符"
        )));
    }
    Ok(trimmed.to_string())
}

/// Validate an entity key: non-empty, max 128 chars, ASCII alphanumeric + `_.-` only.
pub fn validate_key(key: &str) -> ApiResult<String> {
    let k = key.trim();
    if k.is_empty() {
        return Err(ApiError::bad_request("Key 不能为空"));
    }
    if k.len() > 128 {
        return Err(ApiError::bad_request("Key 长度不能超过128个字符"));
    }
    if !k
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err(ApiError::bad_request(
            "Key 只能包含字母、数字、下划线、连字符和点",
        ));
    }
    Ok(k.to_string())
}

/// Validate an email address: basic format check, max 320 chars.
pub fn validate_email(email: &str) -> ApiResult<String> {
    let e = email.trim().to_lowercase();
    if e.len() > 320 {
        return Err(ApiError::bad_request("邮箱长度不能超过320个字符"));
    }
    // Basic but sufficient: local@domain.tld
    let parts: Vec<&str> = e.splitn(2, '@').collect();
    if parts.len() != 2 || parts[0].is_empty() || !parts[1].contains('.') || parts[1].ends_with('.')
    {
        return Err(ApiError::bad_request("邮箱格式不正确"));
    }
    Ok(e)
}

/// Validate a batch import items array (max count check).
pub fn validate_batch_items(items: &[serde_json::Value]) -> ApiResult<()> {
    if items.is_empty() {
        return Err(ApiError::bad_request("导入列表不能为空"));
    }
    if items.len() > MAX_BATCH_ITEMS {
        return Err(ApiError::bad_request(format!(
            "单次导入不能超过{MAX_BATCH_ITEMS}条"
        )));
    }
    Ok(())
}

/// Validate a password: min 6 chars, max 128 chars.
pub fn validate_password(password: &str) -> ApiResult<()> {
    if password.len() < 6 || password.len() > 128 {
        return Err(ApiError::bad_request("密码长度应在6-128个字符之间"));
    }
    Ok(())
}
