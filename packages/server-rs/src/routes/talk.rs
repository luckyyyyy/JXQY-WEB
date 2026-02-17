use axum::extract::{Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, resolve_game_id_by_slug, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

/// Talk is a singleton per game: one row in talks table where data = JSON array of TalkEntry.

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(get).put(update_all))
        .route("/search", axum::routing::get(search))
        .route("/entry", axum::routing::post(add_entry))
        .route("/entry/{entry_id}", axum::routing::put(update_entry).delete(delete_entry))
        .route("/import", axum::routing::post(import_from_txt))
}

async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT data FROM talks WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some((data,)) => Ok(Json(data)),
        None => Ok(Json(serde_json::json!([]))),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchQuery {
    game_id: String,
    portrait_index: Option<i64>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}

async fn search(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<SearchQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let row: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT data FROM talks WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let entries = match row {
        Some((data,)) => data
            .as_array()
            .cloned()
            .unwrap_or_default(),
        None => Vec::new(),
    };

    // In-memory filter
    let filtered: Vec<&serde_json::Value> = entries
        .iter()
        .filter(|entry| {
            // Optional portrait_index filter
            if let Some(pi) = q.portrait_index {
                let entry_pi = entry.get("portraitIndex").and_then(|v| v.as_i64()).unwrap_or(-1);
                if entry_pi != pi {
                    return false;
                }
            }
            // Optional query substring filter (search in talk lines)
            if let Some(ref query_str) = q.query {
                if !query_str.is_empty() {
                    let query_lower = query_str.to_lowercase();
                    let matched = entry
                        .get("lines")
                        .and_then(|l| l.as_array())
                        .map(|lines| {
                            lines.iter().any(|line| {
                                let text = line.get("text").and_then(|t| t.as_str()).unwrap_or("");
                                text.to_lowercase().contains(&query_lower)
                            })
                        })
                        .unwrap_or(false);
                    if !matched {
                        // Also try searching in the whole entry as JSON string
                        let entry_str = serde_json::to_string(entry).unwrap_or_default().to_lowercase();
                        if !entry_str.contains(&query_lower) {
                            return false;
                        }
                    }
                }
            }
            true
        })
        .collect();

    let total = filtered.len();
    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(50).clamp(1, 200);
    let start = ((page - 1) * page_size) as usize;
    let items: Vec<&serde_json::Value> = filtered
        .into_iter()
        .skip(start)
        .take(page_size as usize)
        .collect();

    Ok(Json(serde_json::json!({
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateAllInput {
    game_id: String,
    entries: Vec<serde_json::Value>,
}

async fn update_all(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<UpdateAllInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let mut entries = input.entries;
    // Sort by id
    entries.sort_by(|a, b| {
        let a_id = a.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let b_id = b.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        a_id.cmp(&b_id)
    });
    let data = serde_json::Value::Array(entries);

    sqlx::query(
        "INSERT INTO talks (game_id, data) VALUES ($1, $2) \
         ON CONFLICT (game_id) DO UPDATE SET data = $2, updated_at = NOW()",
    )
    .bind(game_id)
    .bind(&data)
    .execute(&state.db.pool)
    .await?;

    Ok(Json(data))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddEntryInput {
    game_id: String,
    entry: serde_json::Value,
}

async fn add_entry(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<AddEntryInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let new_id = input.entry.get("id").and_then(|v| v.as_i64());

    let row: Option<(Uuid, serde_json::Value)> = sqlx::query_as(
        "SELECT id, data FROM talks WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let mut entries: Vec<serde_json::Value> = match &row {
        Some((_, data)) => data.as_array().cloned().unwrap_or_default(),
        None => Vec::new(),
    };

    // Check ID conflict
    if let Some(new_id) = new_id {
        let conflict = entries.iter().any(|e| {
            e.get("id").and_then(|v| v.as_i64()) == Some(new_id)
        });
        if conflict {
            return Err(ApiError::bad_request(format!("对话 ID {} 已存在", new_id)));
        }
    }

    entries.push(input.entry);
    entries.sort_by(|a, b| {
        let a_id = a.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let b_id = b.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let data = serde_json::Value::Array(entries);
    sqlx::query(
        "INSERT INTO talks (game_id, data) VALUES ($1, $2) \
         ON CONFLICT (game_id) DO UPDATE SET data = $2, updated_at = NOW()",
    )
    .bind(game_id)
    .bind(&data)
    .execute(&state.db.pool)
    .await?;

    Ok(Json(data))
}

async fn update_entry(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(entry_id): axum::extract::Path<i64>,
    Json(input): Json<AddEntryInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;

    let row: Option<(Uuid, serde_json::Value)> = sqlx::query_as(
        "SELECT id, data FROM talks WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let (_, data) = row.ok_or_else(|| ApiError::not_found("对话数据不存在"))?;
    let mut entries: Vec<serde_json::Value> = data.as_array().cloned().unwrap_or_default();

    let idx = entries.iter().position(|e| {
        e.get("id").and_then(|v| v.as_i64()) == Some(entry_id)
    });

    match idx {
        Some(i) => entries[i] = input.entry,
        None => return Err(ApiError::not_found(format!("对话条目 {} 不存在", entry_id))),
    }

    entries.sort_by(|a, b| {
        let a_id = a.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let b_id = b.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let new_data = serde_json::Value::Array(entries);
    sqlx::query("UPDATE talks SET data = $1, updated_at = NOW() WHERE game_id = $2")
        .bind(&new_data)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(new_data))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteEntryQuery {
    game_id: String,
}

async fn delete_entry(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(entry_id): axum::extract::Path<i64>,
    Query(q): Query<DeleteEntryQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    let row: Option<(Uuid, serde_json::Value)> = sqlx::query_as(
        "SELECT id, data FROM talks WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let (_, data) = row.ok_or_else(|| ApiError::not_found("对话数据不存在"))?;
    let entries: Vec<serde_json::Value> = data.as_array().cloned().unwrap_or_default();

    let new_entries: Vec<serde_json::Value> = entries
        .into_iter()
        .filter(|e| e.get("id").and_then(|v| v.as_i64()) != Some(entry_id))
        .collect();

    let new_data = serde_json::Value::Array(new_entries);
    sqlx::query("UPDATE talks SET data = $1, updated_at = NOW() WHERE game_id = $2")
        .bind(&new_data)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;

    Ok(Json(serde_json::json!({"id": entry_id})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportFromTxtInput {
    game_id: String,
    entries: Vec<serde_json::Value>,
}

async fn import_from_txt(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<ImportFromTxtInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let mut entries = input.entries;
    entries.sort_by(|a, b| {
        let a_id = a.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let b_id = b.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        a_id.cmp(&b_id)
    });
    let data = serde_json::Value::Array(entries);

    sqlx::query(
        "INSERT INTO talks (game_id, data) VALUES ($1, $2) \
         ON CONFLICT (game_id) DO UPDATE SET data = $2, updated_at = NOW()",
    )
    .bind(game_id)
    .bind(&data)
    .execute(&state.db.pool)
    .await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// ===== Public routes =====

pub async fn list_public_by_slug(
    State(state): State<AppState>,
    axum::extract::Path(game_slug): axum::extract::Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;
    let row: Option<(serde_json::Value,)> = sqlx::query_as(
        "SELECT data FROM talks WHERE game_id = $1 LIMIT 1",
    )
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some((data,)) => Ok(Json(data)),
        None => Ok(Json(serde_json::json!([]))),
    }
}
