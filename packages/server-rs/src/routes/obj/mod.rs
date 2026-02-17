mod handlers;
pub mod resource;

use axum::Router;
use crate::state::AppState;

pub use handlers::{list_public_by_slug, list_obj_resources_public_by_slug};

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/resource", resource::router())
        .route("/", axum::routing::get(handlers::list).post(handlers::create))
        .route("/{id}", axum::routing::get(handlers::get).put(handlers::update).delete(handlers::delete))
        .route("/batch-import", axum::routing::post(handlers::batch_import))
}
