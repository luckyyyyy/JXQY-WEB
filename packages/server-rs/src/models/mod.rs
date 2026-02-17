pub mod auth;
pub mod game;
pub mod user;

// Re-export commonly used types at module level
pub use auth::{AuthOutput, LoginInput, LogoutOutput, RegisterInput};
pub use game::{CreateGameInput, DeleteGameInput, Game, GameMember, GameOutput, UpdateGameInput};
pub use user::{EmailToken, Session, User, UserOutput};
