//! Email sending service using `lettre`.
//!
//! When SMTP is not configured (no SMTP_HOST / SMTP_USER / SMTP_PASS),
//! emails are silently skipped and only logged — matching the NestJS behaviour.

use lettre::message::{header::ContentType, Mailbox};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::config::Config;

// ─── helpers ──────────────────────────────────────────────────

fn is_email_enabled(cfg: &Config) -> bool {
    cfg.smtp_host.is_some() && cfg.smtp_user.is_some() && cfg.smtp_pass.is_some()
}

fn build_transport(cfg: &Config) -> Result<AsyncSmtpTransport<Tokio1Executor>, lettre::transport::smtp::Error> {
    let host = cfg.smtp_host.as_deref().unwrap_or("localhost");
    let creds = Credentials::new(
        cfg.smtp_user.clone().unwrap_or_default(),
        cfg.smtp_pass.clone().unwrap_or_default(),
    );

    let builder = if cfg.smtp_secure {
        AsyncSmtpTransport::<Tokio1Executor>::relay(host)?
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)?
    };

    Ok(builder
        .port(cfg.smtp_port)
        .credentials(creds)
        .build())
}

async fn send_mail(cfg: &Config, to: &str, subject: &str, html_body: &str) {
    if !is_email_enabled(cfg) {
        tracing::warn!(
            "Email disabled (no SMTP config), skipping: \"{subject}\" → {to}"
        );
        return;
    }

    let from: Mailbox = cfg
        .smtp_from
        .parse()
        .unwrap_or_else(|_| "Miu2D Engine <noreply@miu2d.com>".parse().unwrap());

    let to_mailbox: Mailbox = match to.parse() {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Invalid recipient address \"{to}\": {e}");
            return;
        }
    };

    let message = match Message::builder()
        .from(from)
        .to(to_mailbox)
        .subject(subject)
        .header(ContentType::TEXT_HTML)
        .body(html_body.to_owned())
    {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Failed to build email message: {e}");
            return;
        }
    };

    let transport = match build_transport(cfg) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to build SMTP transport: {e}");
            return;
        }
    };

    match transport.send(message).await {
        Ok(_) => tracing::info!("Email sent: \"{subject}\" → {to}"),
        Err(e) => tracing::error!("Failed to send email: \"{subject}\" → {to}: {e}"),
    }
}

// ─── public API ───────────────────────────────────────────────

/// Send email-verification mail (after registration / on request).
pub async fn send_verify_email(cfg: &Config, to: &str, user_name: &str, token: &str) {
    let verify_url = format!("{}/verify-email?token={token}", cfg.app_url);

    let html = format!(
        r#"<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#333;max-width:480px;margin:0 auto;padding:24px">
<h2>邮箱验证</h2>
<p>你好，{user_name}！</p>
<p>请点击下方链接验证你的邮箱：</p>
<p><a href="{verify_url}" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">验证邮箱</a></p>
<p style="font-size:12px;color:#888">如果你没有注册 Miu2D Engine，请忽略此邮件。<br>链接有效期 24 小时。</p>
</body></html>"#
    );

    send_mail(cfg, to, "验证你的邮箱 - Miu2D Engine", &html).await;
}

/// Send email-change confirmation mail (to the **new** address).
pub async fn send_change_email_verification(
    cfg: &Config,
    to: &str,
    user_name: &str,
    new_email: &str,
    token: &str,
) {
    let verify_url = format!("{}/verify-change-email?token={token}", cfg.app_url);

    let html = format!(
        r#"<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#333;max-width:480px;margin:0 auto;padding:24px">
<h2>确认修改邮箱</h2>
<p>你好，{user_name}！</p>
<p>你正在将邮箱更换为 <strong>{new_email}</strong>。</p>
<p>请点击下方链接确认修改：</p>
<p><a href="{verify_url}" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">确认修改</a></p>
<p style="font-size:12px;color:#888">如果你没有发起此操作，请忽略此邮件。<br>链接有效期 24 小时。</p>
</body></html>"#
    );

    send_mail(cfg, to, "确认修改邮箱 - Miu2D Engine", &html).await;
}
