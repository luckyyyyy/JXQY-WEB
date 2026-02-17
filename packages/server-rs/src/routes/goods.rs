use axum::extract::{Path, Query, State};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::routes::crud::{verify_game_access, GameQuery};
use crate::routes::middleware::AuthUser;
use crate::state::AppState;

/// Row type for goods table (no `name` column, has `kind` instead).
#[derive(sqlx::FromRow)]

struct GoodsRow {
    pub id: Uuid,
    pub game_id: Uuid,
    pub key: String,
    pub kind: String,
    pub data: serde_json::Value,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(list).post(create))
        .route("/{id}", axum::routing::get(get).put(update).delete(delete))
        .route("/batch-import", axum::routing::post(batch_import))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListGoodsQuery {
    pub game_id: String,
    pub kind: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListGoodsQuery>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;

    let rows = if let Some(ref kind) = q.kind {
        sqlx::query_as::<_, GoodsRow>(
            "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE game_id = $1 AND kind = $2 ORDER BY updated_at DESC",
        )
        .bind(game_id)
        .bind(kind)
        .fetch_all(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, GoodsRow>(
            "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE game_id = $1 ORDER BY updated_at DESC",
        )
        .bind(game_id)
        .fetch_all(&state.db.pool)
        .await?
    };

    let items: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            let name = r.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let get_str = |k: &str| r.data.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
            let get_num = |k: &str| r.data.get(k).and_then(|v| v.as_i64()).unwrap_or(0);
            serde_json::json!({
                "id": r.id,
                "key": r.key,
                "name": name,
                "kind": r.kind,
                "part": get_str("part"),
                "icon": get_str("icon"),
                "cost": get_num("cost"),
                "life": get_num("life"),
                "thew": get_num("thew"),
                "mana": get_num("mana"),
                "lifeMax": get_num("lifeMax"),
                "thewMax": get_num("thewMax"),
                "manaMax": get_num("manaMax"),
                "attack": get_num("attack"),
                "defend": get_num("defend"),
                "evade": get_num("evade"),
                "effectType": get_str("effectType"),
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

    let row = sqlx::query_as::<_, GoodsRow>(
        "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE id = $1 AND game_id = $2 LIMIT 1",
    )
    .bind(id)
    .bind(game_id)
    .fetch_optional(&state.db.pool)
    .await?;

    match row {
        Some(r) => Ok(Json(to_goods(&r))),
        None => Err(ApiError::not_found("物品不存在")),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGoodsInput {
    pub game_id: String,
    pub key: String,
    pub kind: Option<String>,
    pub data: serde_json::Value,
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateGoodsInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let key = input.key.to_lowercase();
    let kind = input.kind.as_deref().unwrap_or("Drug");

    let row = sqlx::query_as::<_, GoodsRow>(
        "INSERT INTO goods (game_id, key, kind, data) VALUES ($1, $2, $3, $4) \
         RETURNING id, game_id, key, kind, data, created_at, updated_at",
    )
    .bind(game_id)
    .bind(&key)
    .bind(kind)
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

    Ok(Json(to_goods(&row)))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<crate::routes::crud::UpdateEntityInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &input.game_id, auth.0).await?;
    let kind = input.data.get("kind").and_then(|v| v.as_str()).unwrap_or("Drug").to_string();
    let key = input.data.get("key").and_then(|v| v.as_str()).map(|s| s.to_lowercase());

    let row = if let Some(ref k) = key {
        sqlx::query_as::<_, GoodsRow>(
            "UPDATE goods SET key = $1, kind = $2, data = $3, updated_at = NOW() \
             WHERE id = $4 AND game_id = $5 \
             RETURNING id, game_id, key, kind, data, created_at, updated_at",
        )
        .bind(k)
        .bind(&kind)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    } else {
        sqlx::query_as::<_, GoodsRow>(
            "UPDATE goods SET kind = $1, data = $2, updated_at = NOW() \
             WHERE id = $3 AND game_id = $4 \
             RETURNING id, game_id, key, kind, data, created_at, updated_at",
        )
        .bind(&kind)
        .bind(&input.data)
        .bind(id)
        .bind(game_id)
        .fetch_optional(&state.db.pool)
        .await?
    };

    let row = row.ok_or_else(|| ApiError::not_found("物品不存在"))?;
    Ok(Json(to_goods(&row)))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let game_id = verify_game_access(&state, &q.game_id, auth.0).await?;
    let result = sqlx::query("DELETE FROM goods WHERE id = $1 AND game_id = $2")
        .bind(id)
        .bind(game_id)
        .execute(&state.db.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("物品不存在"));
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
        let key = item
            .get("key")
            .and_then(|v| v.as_str())
            .unwrap_or(file_name)
            .to_lowercase();
        let kind = item.get("kind").and_then(|v| v.as_str()).unwrap_or("Drug");
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(&key).to_string();
        let data = item.get("data").cloned().unwrap_or(serde_json::json!({"name": name, "kind": kind}));

        match sqlx::query_as::<_, GoodsRow>(
            "INSERT INTO goods (game_id, key, kind, data) VALUES ($1, $2, $3, $4) \
             ON CONFLICT (game_id, key) DO UPDATE SET kind = $3, data = $4, updated_at = NOW() \
             RETURNING id, game_id, key, kind, data, created_at, updated_at",
        )
        .bind(game_id)
        .bind(&key)
        .bind(kind)
        .bind(&data)
        .fetch_one(&state.db.pool)
        .await
        {
            Ok(row) => {
                let name = row.data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                success.push(serde_json::json!({"fileName": file_name, "id": row.id, "name": name, "kind": row.kind}));
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
    Path(game_slug): Path<String>,
) -> ApiResult<Json<Vec<serde_json::Value>>> {
    let game_id = crate::routes::crud::resolve_game_id_by_slug(&state, &game_slug).await?;
    let rows = sqlx::query_as::<_, GoodsRow>(
        "SELECT id, game_id, key, kind, data, created_at, updated_at FROM goods WHERE game_id = $1 ORDER BY updated_at DESC",
    )
    .bind(game_id)
    .fetch_all(&state.db.pool)
    .await?;
    Ok(Json(rows.iter().map(to_goods).collect()))
}

fn to_goods(r: &GoodsRow) -> serde_json::Value {
    let mut v = r.data.clone();
    if let Some(obj) = v.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(r.id));
        obj.insert("gameId".into(), serde_json::json!(r.game_id));
        obj.insert("key".into(), serde_json::json!(r.key));
        obj.insert("kind".into(), serde_json::json!(r.kind));
        obj.insert("createdAt".into(), serde_json::json!(r.created_at.map(|d| d.to_rfc3339())));
        obj.insert("updatedAt".into(), serde_json::json!(r.updated_at.map(|d| d.to_rfc3339())));
    }
    v
}
