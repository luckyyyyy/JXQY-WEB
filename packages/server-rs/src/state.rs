use std::sync::Arc;

use crate::config::Config;
use crate::db::Database;
use crate::s3::S3Storage;

/// Shared application state passed to all handlers.
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub storage: Arc<S3Storage>,
    pub config: Arc<Config>,
}
