mod handler;
pub mod resource;
pub mod service;

use axum::Router;
use crate::state::AppState;

pub use handler::{list_public_by_slug, list_obj_resources_public_by_slug};

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/resource", resource::router())
        .route("/", axum::routing::get(handler::list).post(handler::create))
        .route("/{id}", axum::routing::get(handler::get).put(handler::update).delete(handler::delete))
        .route("/batch-import", axum::routing::post(handler::batch_import))
}
