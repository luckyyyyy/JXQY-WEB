mod admin;
mod handler;
mod helpers;

use axum::Router;
use crate::state::AppState;

pub use handler::get_shared;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(handler::list))
        .route("/{id}", axum::routing::get(handler::get).delete(handler::delete))
        .route("/upsert", axum::routing::post(handler::upsert))
        .route("/share", axum::routing::post(handler::share))
        .route("/admin", axum::routing::get(admin::admin_list))
        .route("/admin/{id}", axum::routing::get(admin::admin_get).put(admin::admin_update).delete(admin::admin_delete))
        .route("/admin/create", axum::routing::post(admin::admin_create))
        .route("/admin/{id}/share", axum::routing::post(admin::admin_share))
}
