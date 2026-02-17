mod admin;
mod handlers;
mod helpers;

use axum::Router;
use crate::state::AppState;

pub use handlers::get_shared;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", axum::routing::get(handlers::list))
        .route("/{id}", axum::routing::get(handlers::get).delete(handlers::delete))
        .route("/upsert", axum::routing::post(handlers::upsert))
        .route("/share", axum::routing::post(handlers::share))
        .route("/admin", axum::routing::get(admin::admin_list))
        .route("/admin/{id}", axum::routing::get(admin::admin_get).put(admin::admin_update).delete(admin::admin_delete))
        .route("/admin/create", axum::routing::post(admin::admin_create))
        .route("/admin/{id}/share", axum::routing::post(admin::admin_share))
}
