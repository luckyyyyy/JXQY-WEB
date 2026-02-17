use axum::Router;

pub mod auth;
pub mod crud;
pub mod data;
pub mod file;
pub mod game;
pub mod game_config;
pub mod goods;
pub mod level;
pub mod magic;
pub mod middleware;
pub mod npc;
pub mod obj;
pub mod player;
pub mod save;
pub mod scene;
pub mod shop;
pub mod talk;
pub mod talk_portrait;
pub mod user;

use crate::state::AppState;

/// Build the full application router.
pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Health check
        .route(
            "/health",
            axum::routing::get(|| async {
                axum::Json(serde_json::json!({"status": "ok"}))
            }),
        )
        // ---- Public game routes (no auth) ---- //
        // Resources: GET /game/:slug/resources/*path
        .route(
            "/game/{slug}/resources/{*path}",
            axum::routing::get(file::serve_resource),
        )
        // Game data aggregation: GET /game/:slug/api/data
        .route(
            "/game/{slug}/api/data",
            axum::routing::get(data::build_game_data),
        )
        // Game config: GET /game/:slug/api/game-config (also aliased as /config)
        .route(
            "/game/{slug}/api/game-config",
            axum::routing::get(game_config::get_public_by_slug),
        )
        .route(
            "/game/{slug}/api/config",
            axum::routing::get(game_config::get_public_by_slug),
        )
        // Scene public routes
        .route(
            "/game/{slug}/api/scenes/{scene_key}/mmf",
            axum::routing::get(scene::get_mmf_binary),
        )
        .route(
            "/game/{slug}/api/scenes/npc/{scene_key}/{npc_key}",
            axum::routing::get(scene::get_npc_entries),
        )
        .route(
            "/game/{slug}/api/scenes/obj/{scene_key}/{obj_key}",
            axum::routing::get(scene::get_obj_entries),
        )
        // Public list endpoints (for game runtime)
        .route(
            "/game/{slug}/api/magic",
            axum::routing::get(magic::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/goods",
            axum::routing::get(goods::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/level",
            axum::routing::get(level::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/level/{key}",
            axum::routing::get(level::get_public_by_slug_and_key),
        )
        .route(
            "/game/{slug}/api/npc",
            axum::routing::get(npc::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/npc-resource",
            axum::routing::get(npc::list_npc_resources_public_by_slug),
        )
        .route(
            "/game/{slug}/api/obj",
            axum::routing::get(obj::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/obj-resource",
            axum::routing::get(obj::list_obj_resources_public_by_slug),
        )
        .route(
            "/game/{slug}/api/player",
            axum::routing::get(player::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/shop",
            axum::routing::get(shop::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/talk",
            axum::routing::get(talk::list_public_by_slug),
        )
        .route(
            "/game/{slug}/api/talk-portrait",
            axum::routing::get(talk_portrait::list_public_by_slug),
        )
        // Save public shared endpoint
        .route(
            "/game/{slug}/api/save/shared/{share_code}",
            axum::routing::get(save::get_shared),
        )
        // Game logo (GET public, POST/DELETE check auth manually)
        .route(
            "/game/{slug}/api/logo",
            axum::routing::get(game::serve_logo)
                .post(game::upload_logo)
                .delete(game::delete_logo),
        )
        // ---- Authenticated API routes ---- //
        .nest("/api/auth", auth::router())
        .nest("/api/user", user::router())
        .nest("/api/game", game::router())
        .nest("/api/game-config", game_config::router())
        .nest("/api/magic", magic::router())
        .nest("/api/goods", goods::router())
        .nest("/api/level", level::router())
        .nest("/api/npc", npc::router())
        .nest("/api/obj", obj::router())
        .nest("/api/player", player::router())
        .nest("/api/shop", shop::router())
        .nest("/api/save", save::router())
        .nest("/api/scene", scene::router())
        .nest("/api/talk", talk::router())
        .nest("/api/talk-portrait", talk_portrait::router())
        .nest("/api/file", file::router())
        .with_state(state)
}
