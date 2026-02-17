use miu2d_server::config::Config;
use miu2d_server::db::Database;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let config = Config::from_env();
    let database = Database::new(&config.database_url).await;
    database.run_migrations().await;
    println!("Migrations complete.");
}
