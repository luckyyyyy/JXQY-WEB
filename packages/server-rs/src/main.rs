use std::sync::Arc;

use axum::extract::DefaultBodyLimit;
use axum::http::{HeaderValue, Method};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use miu2d_server::config::Config;
use miu2d_server::db::Database;
use miu2d_server::routes;
use miu2d_server::s3::S3Storage;
use miu2d_server::state::AppState;

#[tokio::main]
async fn main() {
    // Load .env
    dotenvy::dotenv().ok();

    // Init tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "miu2d_server=debug,tower_http=debug".into()),
        )
        .init();

    let config = Config::from_env();
    let port = config.port;

    // Init database
    let db = Database::new(&config.database_url).await;
    db.run_migrations().await;

    // Seed demo data in dev mode
    if config.is_dev() {
        db.seed_demo_data().await;
    }

    // Clean up expired sessions/tokens on startup
    db.cleanup_expired().await;

    // Init S3 storage
    let storage = S3Storage::new(&config).await;

    let state = AppState {
        db: Arc::new(db),
        storage: Arc::new(storage),
        config: Arc::new(config),
    };

    // Spawn periodic session/token cleanup (every hour)
    {
        let db = Arc::clone(&state.db);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
            interval.tick().await; // skip first immediate tick
            loop {
                interval.tick().await;
                db.cleanup_expired().await;
            }
        });
    }

    // CORS — credentials mode requires explicit origin, methods, headers
    let origin = state.config.app_url.parse::<HeaderValue>().expect("Invalid APP_URL");
    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::COOKIE,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(true);

    let app = routes::create_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)); // 50MB

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("Failed to bind port");

    tracing::info!("Server running on http://0.0.0.0:{port}");

    // Graceful shutdown on SIGTERM/SIGINT
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Server failed");

    tracing::info!("Server shut down gracefully");
}

async fn shutdown_signal() {
    use tokio::signal;
    let ctrl_c = async { signal::ctrl_c().await.expect("Failed to listen for Ctrl+C") };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to listen for SIGTERM")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        () = ctrl_c => tracing::info!("Received Ctrl+C, shutting down..."),
        () = terminate => tracing::info!("Received SIGTERM, shutting down..."),
    }
}
