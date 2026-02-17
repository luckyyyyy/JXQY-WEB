/// Server configuration loaded from environment variables.
#[derive(Debug, Clone)]

pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub node_env: String,

    // S3 / MinIO
    pub s3_endpoint: String,
    pub s3_region: String,
    pub s3_public_endpoint: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket: String,

    // Session
    pub session_cookie_secure: bool,
    pub session_cookie_max_age_secs: i64,

    // Dev
    pub dev_auto_login: bool,

    // SMTP
    pub smtp_host: Option<String>,
    pub smtp_port: u16,
    pub smtp_secure: bool,
    pub smtp_user: Option<String>,
    pub smtp_pass: Option<String>,
    pub smtp_from: String,

    // App
    pub app_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        let node_env = std::env::var("NODE_ENV").unwrap_or_else(|_| "development".into());
        let is_prod = node_env == "production";

        Self {
            port: std::env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(4000),
            database_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            node_env,
            s3_endpoint: std::env::var("S3_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:9000".into()),
            s3_region: std::env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".into()),
            s3_public_endpoint: std::env::var("S3_PUBLIC_ENDPOINT")
                .unwrap_or_else(|_| "/s3".into()),
            minio_access_key: std::env::var("MINIO_ACCESS_KEY")
                .or_else(|_| std::env::var("MINIO_ROOT_USER"))
                .unwrap_or_else(|_| "minio".into()),
            minio_secret_key: std::env::var("MINIO_SECRET_KEY")
                .or_else(|_| std::env::var("MINIO_ROOT_PASSWORD"))
                .unwrap_or_else(|_| "minio123".into()),
            minio_bucket: std::env::var("MINIO_BUCKET").unwrap_or_else(|_| "miu2d".into()),
            session_cookie_secure: std::env::var("SESSION_COOKIE_SECURE")
                .map(|v| v == "true")
                .unwrap_or(is_prod),
            session_cookie_max_age_secs: 60 * 60 * 24 * 7, // 7 days
            dev_auto_login: if is_prod {
                false
            } else {
                std::env::var("DEV_AUTO_LOGIN")
                    .map(|v| v != "false" && v != "0")
                    .unwrap_or(true)
            },
            smtp_host: std::env::var("SMTP_HOST").ok(),
            smtp_port: std::env::var("SMTP_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(587),
            smtp_secure: std::env::var("SMTP_SECURE")
                .map(|v| v == "true")
                .unwrap_or(false),
            smtp_user: std::env::var("SMTP_USER").ok(),
            smtp_pass: std::env::var("SMTP_PASS").ok(),
            smtp_from: std::env::var("SMTP_FROM")
                .unwrap_or_else(|_| "Miu2D Engine <noreply@miu2d.com>".into()),
            app_url: std::env::var("APP_URL").unwrap_or_else(|_| "http://localhost:5173".into()),
        }
    }

    pub fn is_dev(&self) -> bool {
        self.node_env != "production"
    }
}
