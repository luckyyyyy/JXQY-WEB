mod handler;
mod resource;
pub mod service;

use crate::state::AppState;
use axum::Router;

pub use resource::serve_resource;

/// Authenticated file management routes
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(handler::list))
        .route(
            "/{id}",
            axum::routing::get(handler::get).delete(handler::delete),
        )
        .route("/{id}/path", axum::routing::get(handler::get_path))
        .route("/folder", axum::routing::post(handler::create_folder))
        .route(
            "/prepare-upload",
            axum::routing::post(handler::prepare_upload),
        )
        .route(
            "/confirm-upload",
            axum::routing::post(handler::confirm_upload),
        )
        .route(
            "/download-url/{id}",
            axum::routing::get(handler::get_download_url),
        )
        .route("/upload-url", axum::routing::post(handler::get_upload_url))
        .route("/rename/{id}", axum::routing::put(handler::rename))
        .route("/move/{id}", axum::routing::put(handler::move_file))
        .route(
            "/batch-prepare-upload",
            axum::routing::post(handler::batch_prepare_upload),
        )
        .route(
            "/batch-confirm-upload",
            axum::routing::post(handler::batch_confirm_upload),
        )
        .route(
            "/ensure-folder-path",
            axum::routing::post(handler::ensure_folder_path),
        )
}
