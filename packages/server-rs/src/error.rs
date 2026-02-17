use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

/// API error type matching tRPC error codes for frontend compatibility.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{message}")]
    BadRequest { message: String },

    #[error("{message}")]
    Unauthorized { message: String },

    #[error("{message}")]
    Forbidden { message: String },

    #[error("{message}")]
    NotFound { message: String },

    #[error("Internal server error")]
    Internal(#[from] anyhow::Error),

    #[error("Database error")]
    Database(#[from] sqlx::Error),
}

#[derive(Serialize)]
struct ErrorBody {
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    code: &'static str,
    message: String,
}

impl ApiError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest { message: msg.into() }
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized { message: msg.into() }
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::Forbidden { message: msg.into() }
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound { message: msg.into() }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(anyhow::anyhow!("{}", msg.into()))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            ApiError::BadRequest { message } => {
                (StatusCode::BAD_REQUEST, "BAD_REQUEST", message.clone())
            }
            ApiError::Unauthorized { message } => {
                (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", message.clone())
            }
            ApiError::Forbidden { message } => {
                (StatusCode::FORBIDDEN, "FORBIDDEN", message.clone())
            }
            ApiError::NotFound { message } => {
                (StatusCode::NOT_FOUND, "NOT_FOUND", message.clone())
            }
            ApiError::Internal(e) => {
                tracing::error!("Internal error: {e:?}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_SERVER_ERROR",
                    "Internal server error".into(),
                )
            }
            ApiError::Database(e) => {
                tracing::error!("Database error: {e:?}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_SERVER_ERROR",
                    "Database error".into(),
                )
            }
        };

        let body = ErrorBody {
            error: ErrorDetail { code, message },
        };

        (status, axum::Json(body)).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
