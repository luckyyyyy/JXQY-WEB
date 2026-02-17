use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

pub struct Database {
    pub pool: PgPool,
}

/// Demo user ID (deterministic, for dev mode).
pub const DEMO_DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000000";
pub const DEMO_SLUG: &str = "demo";

impl Database {
    pub async fn new(database_url: &str) -> Self {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .idle_timeout(std::time::Duration::from_secs(600))
            .connect(database_url)
            .await
            .expect("Failed to connect to database");
        Self { pool }
    }

    pub async fn run_migrations(&self) {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await
            .expect("Failed to run migrations");
        tracing::info!("Database migrations completed");
    }

    /// Clean up expired sessions and email tokens.
    pub async fn cleanup_expired(&self) {
        let sessions_deleted = sqlx::query("DELETE FROM sessions WHERE expires_at < NOW()")
            .execute(&self.pool)
            .await
            .map(|r| r.rows_affected())
            .unwrap_or(0);
        let tokens_deleted = sqlx::query("DELETE FROM email_tokens WHERE expires_at < NOW()")
            .execute(&self.pool)
            .await
            .map(|r| r.rows_affected())
            .unwrap_or(0);
        if sessions_deleted > 0 || tokens_deleted > 0 {
            tracing::info!(
                "Cleaned up {} expired sessions, {} expired tokens",
                sessions_deleted,
                tokens_deleted
            );
        }
    }

    /// Seed demo data for development.
    pub async fn seed_demo_data(&self) {
        use argon2::password_hash::rand_core::OsRng;
        use argon2::password_hash::SaltString;
        use argon2::{Argon2, PasswordHasher};

        let demo_id: Uuid = DEMO_DEV_USER_ID.parse().unwrap();

        // Hash a real password for the demo user
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(b"demo", &salt)
            .expect("Failed to hash demo password")
            .to_string();

        // Upsert demo user (upgrade plain-text hash on conflict)
        sqlx::query(
            r#"
            INSERT INTO users (id, name, email, password_hash, email_verified, role)
            VALUES ($1, 'Demo Developer', 'demo@dev.local', $2, true, 'user')
            ON CONFLICT (id) DO UPDATE SET password_hash = $2
            "#,
        )
        .bind(demo_id)
        .bind(&password_hash)
        .execute(&self.pool)
        .await
        .expect("Failed to seed demo user");

        // Upsert demo game
        let game_id: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM games WHERE slug = $1 LIMIT 1",
        )
        .bind(DEMO_SLUG)
        .fetch_optional(&self.pool)
        .await
        .expect("Failed to query demo game");

        let game_id = if let Some(id) = game_id {
            id
        } else {
            let id: Uuid = sqlx::query_scalar(
                r#"
                INSERT INTO games (slug, name, description, owner_id)
                VALUES ($1, 'Demo Game', 'Local development demo workspace', $2)
                RETURNING id
                "#,
            )
            .bind(DEMO_SLUG)
            .bind(demo_id)
            .fetch_one(&self.pool)
            .await
            .expect("Failed to create demo game");
            tracing::info!("[Demo] Created demo game");
            id
        };

        // Upsert membership
        sqlx::query(
            r#"
            INSERT INTO game_members (game_id, user_id, role)
            VALUES ($1, $2, 'owner')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(game_id)
        .bind(demo_id)
        .execute(&self.pool)
        .await
        .ok();

        tracing::info!("[Demo] Dev mode ready — slug 'demo' accessible without login");
    }
}
