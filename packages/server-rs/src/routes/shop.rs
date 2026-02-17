use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, EntityRow, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/batch-import", axum::routing::post(batch_import))
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let rows = sqlx::query_as::<_, EntityRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM shops WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let item_count = r
                .data
                .get("items")
                .and_then(|v| v.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            serde_json::json!({
                "id": r.id,
                "key": r.key,
                "name": r.name,
                "itemCount": item_count,
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
    let row = sqlx::query_as::<_, EntityRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM shops WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;
    match row {
        Some(r) => Ok(Json(to_shop(&r))),
        None => Err(ApiError::not_found("商店不存在")),
    }
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<crate::routes::crud::CreateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = input.key.to_lowercase();
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();

    let row = sqlx::query_as::<_, EntityRow>(
        "INSERT INTO shops (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
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

    Ok(Json(to_shop(&row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let name = input.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let row = sqlx::query_as::<_, EntityRow>(
        "UPDATE shops SET name = $1, data = $2, updated_at = NOW() WHERE id = $3 AND game_id = $4 \
         RETURNING id, game_id, key, name, data, created_at, updated_at",
    )
    .bind(&name)
    .bind(&input.data)
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found("商店不存在"))?;
    Ok(Json(to_shop(&row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM shops WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("商店不存在"));
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
        let key = item.get("key").and_then(|v| v.as_str()).unwrap_or(file_name).to_lowercase();
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
        let data = item.get("data").cloned().unwrap_or(serde_json::json!({"name": name, "items": []}));

        match sqlx::query_as::<_, EntityRow>(
            "INSERT INTO shops (game_id, key, name, data) VALUES ($1, $2, $3, $4) \
             ON CONFLICT (game_id, key) DO UPDATE SET name = $3, data = $4, updated_at = NOW() \
             RETURNING id, game_id, key, name, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(&name)
        .bind(&data)
        .fetch_one(&state.db.pool)
        .await
        {
            Ok(row) => {
                let item_count = row.data.get("items").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
                success.push(serde_json::json!({"fileName": file_name, "id": row.id, "name": row.name, "itemCount": item_count}));
            }
            Err(e) => {
                failed.push(serde_json::json!({"fileName": file_name, "error": e.to_string()}));
            }
        }
    }

    Ok(Json(serde_json::json!({"success": success, "failed": failed})))
}

pub async fn list_public_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = crate::routes::crud::resolve_game_id_by_slug(&state, &slug).await?;
    let rows = sqlx::query_as::<_, EntityRow>(
        "SELECT id, game_id, key, name, data, created_at, updated_at FROM shops WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(to_shop).collect()))
}

fn to_shop(r: &EntityRow) -> serde_json::Value {
    let mut v = serde_json::json!({
        "id": r.id,
        "gameId": r.game_id,
        "key": r.key,
        "name": r.name,
        "createdAt": r.created_at.map(|d| d.to_rfc3339()),
        "updatedAt": r.updated_at.map(|d| d.to_rfc3339()),
    });
    // Merge data fields
    let number_valid = r.data.get("numberValid").and_then(|v| v.as_bool()).unwrap_or(false);
    let buy_percent = r.data.get("buyPercent").and_then(|v| v.as_i64()).unwrap_or(100);
    let recycle_percent = r.data.get("recyclePercent").and_then(|v| v.as_i64()).unwrap_or(100);
    let items = r.data.get("items").cloned().unwrap_or(serde_json::json!([]));

    if let Some(obj) = v.as_object_mut() {
        obj.insert("numberValid".into(), serde_json::json!(number_valid));
        obj.insert("buyPercent".into(), serde_json::json!(buy_percent));
        obj.insert("recyclePercent".into(), serde_json::json!(recycle_percent));
        obj.insert("items".into(), items);
    }
    v
}
