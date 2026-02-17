mod handlers;
pub(crate) mod helpers;
mod resource;

use crate::state::AppState;
use axum::Router;

pub use resource::serve_resource;

/// Authenticated file management routes
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(handlers::list))
        .route(
            "/{id}",
            axum::routing::get(handlers::get).delete(handlers::delete),
        )
        .route("/{id}/path", axum::routing::get(handlers::get_path))
        .route("/folder", axum::routing::post(handlers::create_folder))
        .route(
            "/prepare-upload",
            axum::routing::post(handlers::prepare_upload),
        )
        .route(
            "/confirm-upload",
            axum::routing::post(handlers::confirm_upload),
        )
        .route(
            "/download-url/{id}",
            axum::routing::get(handlers::get_download_url),
        )
        .route("/upload-url", axum::routing::post(handlers::get_upload_url))
        .route("/rename/{id}", axum::routing::put(handlers::rename))
        .route("/move/{id}", axum::routing::put(handlers::move_file))
        .route(
            "/batch-prepare-upload",
            axum::routing::post(handlers::batch_prepare_upload),
        )
        .route(
            "/batch-confirm-upload",
            axum::routing::post(handlers::batch_confirm_upload),
        )
        .route(
            "/ensure-folder-path",
            axum::routing::post(handlers::ensure_folder_path),
        )
}
