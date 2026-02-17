use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{StatusCode, header};
use axum::response::Response;
use tokio_util::io::ReaderStream;
use uuid::Uuid;

use crate::error::ApiError;
use crate::modules::crud::resolve_game_id_by_slug;
use super::service::guess_mime_type;
use crate::state::AppState;

/// Public resource route: GET /game/:slug/resources/*
pub async fn serve_resource(
    State(state): State<AppState>,
    Path((game_slug, resource_path)): Path<(String, String)>,
) -> Result<Response, ApiError> {
    let game_id = resolve_game_id_by_slug(&state, &game_slug).await?;

    let parts: Vec<&str> = resource_path.split('/').filter(|s| !s.is_empty()).collect();

    if parts.is_empty() {
        return Err(ApiError::not_found("空路径"));
    }

    // Path traversal protection
    if parts.iter().any(|p| *p == ".." || *p == ".") {
        return Err(ApiError::bad_request("非法路径"));
    }

    let segments: Vec<String> = parts.iter().map(|s| s.to_string()).collect();

    #[derive(sqlx::FromRow)]
    struct ResolvedFile {
        #[allow(dead_code)]
        id: Uuid,
        #[allow(dead_code)]
        name: String,
        file_type: String,
        storage_key: Option<String>,
        mime_type: Option<String>,
    }

    let row: Option<ResolvedFile> = sqlx::query_as(
        r#"
        WITH RECURSIVE
          segments AS (
            SELECT seg, idx::bigint AS idx, count(*) OVER() AS total
            FROM unnest($2::text[]) WITH ORDINALITY AS t(seg, idx)
          ),
          path_walk AS (
            SELECT f.id, f.name, f.type AS file_type, f.storage_key, f.mime_type, s.idx AS depth, s.total
            FROM files f
            JOIN segments s ON s.idx = 1 AND LOWER(f.name) = LOWER(s.seg)
            WHERE f.game_id = $1 AND f.parent_id IS NULL AND f.deleted_at IS NULL

            UNION ALL

            SELECT f.id, f.name, f.type, f.storage_key, f.mime_type, s.idx, pw.total
            FROM files f
            JOIN path_walk pw ON f.parent_id = pw.id
            JOIN segments s ON s.idx = pw.depth + 1 AND LOWER(f.name) = LOWER(s.seg)
            WHERE f.game_id = $1 AND f.deleted_at IS NULL
          )
        SELECT id, name, file_type, storage_key, mime_type
        FROM path_walk
        WHERE depth = total
        LIMIT 1
        "#,
    )
    .bind(game_id)
    .bind(&segments)
    .fetch_optional(&state.db.pool)
    .await?;

    let resolved = row.ok_or_else(|| ApiError::not_found(format!("未找到: {}", resource_path)))?;

    if resolved.file_type == "folder" {
        return Err(ApiError::bad_request("不能直接访问文件夹"));
    }

    let storage_key = resolved
        .storage_key
        .ok_or_else(|| ApiError::not_found("文件没有存储信息"))?;

    // Stream from S3
    let (byte_stream, s3_content_type, content_length) = state
        .storage
        .get_file_stream(&storage_key)
        .await
        .map_err(|e| ApiError::internal(format!("S3 get failed: {}", e)))?;

    let content_type = resolved
        .mime_type
        .or(s3_content_type)
        .unwrap_or_else(|| guess_mime_type(&resource_path));

    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400");

    if let Some(len) = content_length {
        builder = builder.header(header::CONTENT_LENGTH, len);
    }

    let reader = byte_stream.into_async_read();
    let stream = ReaderStream::new(reader);

    builder
        .body(Body::from_stream(stream))
        .map_err(|e| ApiError::internal(format!("Failed to build response: {e}")))
}
