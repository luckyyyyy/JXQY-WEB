//! Auth routes: thin HTTP handlers delegating to services::auth.

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::{Json, Router};

use crate::error::ApiResult;
use crate::models::{LoginInput, LogoutOutput, RegisterInput};
use super::service as auth_svc;
use crate::state::AppState;

use crate::modules::middleware::{SESSION_COOKIE_NAME, get_cookie_value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", axum::routing::post(login))
        .route("/register", axum::routing::post(register))
        .route("/logout", axum::routing::post(logout))
}

async fn login(
    State(state): State<AppState>,
    _headers: HeaderMap,
    Json(input): Json<LoginInput>,
) -> ApiResult<impl IntoResponse> {
    let result = auth_svc::login(&state, &input.email, &input.password).await?;

    let mut response = Json(result.output).into_response();
    set_session_cookie(&state, &mut response, &result.session_id.to_string());
    Ok(response)
}

async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterInput>,
) -> ApiResult<impl IntoResponse> {
    let result =
        auth_svc::register(&state, &input.name, &input.email, &input.password).await?;

    let mut response = Json(result.output).into_response();
    set_session_cookie(&state, &mut response, &result.session_id.to_string());
    Ok(response)
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<impl IntoResponse> {
    if let Some(session_id) = get_cookie_value(&headers, SESSION_COOKIE_NAME) {
        auth_svc::logout(&state.db.pool, &session_id).await?;
    }

    let mut response = Json(LogoutOutput { success: true }).into_response();
    clear_session_cookie(&state, &mut response);
    Ok(response)
}

// ── Cookie helpers (HTTP-only, stay in route layer) ────

fn set_session_cookie(
    state: &AppState,
    response: &mut axum::response::Response,
    session_id: &str,
) {
    let secure = if state.config.session_cookie_secure {
        "; Secure"
    } else {
        ""
    };
    let max_age = state.config.session_cookie_max_age_secs;
    let cookie = format!(
        "{SESSION_COOKIE_NAME}={session_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}{secure}"
    );
    response
        .headers_mut()
        .append("set-cookie", cookie.parse().expect("valid cookie header"));
}

fn clear_session_cookie(state: &AppState, response: &mut axum::response::Response) {
    let secure = if state.config.session_cookie_secure {
        "; Secure"
    } else {
        ""
    };
    let cookie =
        format!("{SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure}");
    response
        .headers_mut()
        .append("set-cookie", cookie.parse().expect("valid cookie header"));
}
