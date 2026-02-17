use aws_credential_types::Credentials;
use aws_sdk_s3::config::{BehaviorVersion, Region};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;

use crate::config::Config;

pub struct S3Storage {
    client: Client,
    bucket: String,
    public_endpoint: String,
    internal_endpoint: String,
}


impl S3Storage {
    pub async fn new(config: &Config) -> Self {
        let creds = Credentials::new(
            &config.minio_access_key,
            &config.minio_secret_key,
            None,
            None,
            "env",
        );

        let s3_config = aws_sdk_s3::Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .endpoint_url(&config.s3_endpoint)
            .region(Region::new(config.s3_region.clone()))
            .credentials_provider(creds)
            .force_path_style(true)
            .build();

        let client = Client::from_conf(s3_config);

        tracing::info!("S3 client initialized, endpoint: {}", config.s3_endpoint);

        Self {
            client,
            bucket: config.minio_bucket.clone(),
            public_endpoint: config.s3_public_endpoint.clone(),
            internal_endpoint: config.s3_endpoint.clone(),
        }
    }

    pub fn generate_storage_key(game_id: &str, file_id: &str) -> String {
        format!("games/{game_id}/{file_id}")
    }

    pub async fn upload_file(
        &self,
        key: &str,
        body: Vec<u8>,
        content_type: Option<&str>,
    ) -> anyhow::Result<()> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(body))
            .content_type(content_type.unwrap_or("application/octet-stream"))
            .send()
            .await?;
        tracing::debug!("Uploaded file: {key}");
        Ok(())
    }

    pub async fn download_file(&self, key: &str) -> anyhow::Result<Vec<u8>> {
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;
        let data = resp.body.collect().await?.into_bytes();
        Ok(data.to_vec())
    }

    pub async fn get_file_stream(
        &self,
        key: &str,
    ) -> anyhow::Result<(ByteStream, Option<String>, Option<i64>)> {
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;
        let content_type = resp.content_type().map(|s| s.to_string());
        let content_length = resp.content_length();
        Ok((resp.body, content_type, content_length))
    }

    pub async fn get_download_url(&self, key: &str, expires_in: u64) -> anyhow::Result<String> {
        let presigning = aws_sdk_s3::presigning::PresigningConfig::builder()
            .expires_in(std::time::Duration::from_secs(expires_in))
            .build()?;

        let url = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(presigning)
            .await?
            .uri()
            .to_string();

        Ok(self.rewrite_presigned_url(&url))
    }

    pub async fn get_upload_url(
        &self,
        key: &str,
        content_type: Option<&str>,
        expires_in: u64,
    ) -> anyhow::Result<String> {
        let presigning = aws_sdk_s3::presigning::PresigningConfig::builder()
            .expires_in(std::time::Duration::from_secs(expires_in))
            .build()?;

        let mut req = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(key);
        if let Some(ct) = content_type {
            req = req.content_type(ct);
        }

        let url = req.presigned(presigning).await?.uri().to_string();
        Ok(self.rewrite_presigned_url(&url))
    }

    pub async fn delete_file(&self, key: &str) -> anyhow::Result<()> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;
        tracing::debug!("Deleted file: {key}");
        Ok(())
    }

    pub async fn delete_files(&self, keys: &[String]) -> anyhow::Result<()> {
        if keys.is_empty() {
            return Ok(());
        }
        for chunk in keys.chunks(1000) {
            let objects: Vec<_> = chunk
                .iter()
                .map(|k| {
                    aws_sdk_s3::types::ObjectIdentifier::builder()
                        .key(k)
                        .build()
                        .unwrap()
                })
                .collect();
            self.client
                .delete_objects()
                .bucket(&self.bucket)
                .delete(
                    aws_sdk_s3::types::Delete::builder()
                        .set_objects(Some(objects))
                        .build()
                        .unwrap(),
                )
                .send()
                .await?;
        }
        tracing::debug!("Deleted {} files", keys.len());
        Ok(())
    }

    pub async fn file_exists(&self, key: &str) -> bool {
        self.client
            .head_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .is_ok()
    }

    pub async fn copy_file(&self, src_key: &str, dest_key: &str) -> anyhow::Result<()> {
        self.client
            .copy_object()
            .bucket(&self.bucket)
            .copy_source(format!("{}/{src_key}", self.bucket))
            .key(dest_key)
            .send()
            .await?;
        tracing::debug!("Copied file: {src_key} -> {dest_key}");
        Ok(())
    }

    pub async fn get_object_text(&self, key: &str) -> anyhow::Result<Option<String>> {
        match self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
        {
            Ok(resp) => {
                let data = resp.body.collect().await?.into_bytes();
                Ok(Some(String::from_utf8_lossy(&data).into_owned()))
            }
            Err(err) => {
                // Use SDK error types instead of fragile string matching
                if err
                    .as_service_error()
                    .map(|e| e.is_no_such_key())
                    .unwrap_or(false)
                {
                    Ok(None)
                } else {
                    Err(err.into())
                }
            }
        }
    }

    pub async fn put_object_text(
        &self,
        key: &str,
        content: &str,
        content_type: &str,
    ) -> anyhow::Result<()> {
        self.upload_file(key, content.as_bytes().to_vec(), Some(content_type))
            .await
    }

    fn rewrite_presigned_url(&self, url: &str) -> String {
        if url.starts_with(&self.internal_endpoint) {
            url.replace(&self.internal_endpoint, &self.public_endpoint)
        } else {
            url.to_string()
        }
    }
}
