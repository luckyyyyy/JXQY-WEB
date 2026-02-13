/**
 * S3/MinIO 存储服务
 *
 * 用于存储文件内容，元数据存储在 PostgreSQL
 * S3 key 格式: {gameId}/{fileId}
 */
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	HeadObjectCommand,
	CopyObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Logger } from "../utils/logger.js";

const logger = new Logger("S3Storage");

/**
 * S3 配置
 */
const s3Config = {
	endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
	region: process.env.S3_REGION || "us-east-1",
	credentials: {
		accessKeyId: process.env.MINIO_ROOT_USER || "minio",
		secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minio123"
	},
	forcePathStyle: true // MinIO 需要
};

const bucket = process.env.MINIO_BUCKET || "miu2d";

/**
 * 公开访问的 S3 endpoint
 * 开发环境下使用 /s3 前缀，由 Vite 代理转发到 MinIO
 * 生产环境可设置为 CDN 或公网 MinIO 地址
 */
const s3PublicEndpoint = process.env.S3_PUBLIC_ENDPOINT || "/s3";

/**
 * 将 presigned URL 的内部 endpoint 替换为公开 endpoint
 * 这样前端通过代理访问 MinIO，避免直连 localhost:9000
 */
function rewritePresignedUrl(url: string): string {
	const internalEndpoint = s3Config.endpoint;
	if (s3PublicEndpoint && url.startsWith(internalEndpoint)) {
		return url.replace(internalEndpoint, s3PublicEndpoint);
	}
	return url;
}

/**
 * S3 客户端单例
 */
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!s3Client) {
		s3Client = new S3Client(s3Config);
		logger.log(`S3 client initialized, endpoint: ${s3Config.endpoint}`);
	}
	return s3Client;
}

/**
 * 生成 S3 存储键
 */
export function generateStorageKey(gameId: string, fileId: string): string {
	return `games/${gameId}/${fileId}`;
}

/**
 * 上传文件到 S3
 */
export async function uploadFile(
	storageKey: string,
	content: Buffer | Uint8Array,
	mimeType?: string
): Promise<void> {
	const client = getS3Client();

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: storageKey,
			Body: content,
			ContentType: mimeType || "application/octet-stream"
		})
	);

	logger.debug(`Uploaded file: ${storageKey}`);
}

/**
 * 从 S3 下载文件
 */
export async function downloadFile(storageKey: string): Promise<Buffer> {
	const client = getS3Client();

	const response = await client.send(
		new GetObjectCommand({
			Bucket: bucket,
			Key: storageKey
		})
	);

	if (!response.Body) {
		throw new Error(`Empty response body for key: ${storageKey}`);
	}

	// 将 stream 转换为 Buffer
	const chunks: Uint8Array[] = [];
	for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

/**
 * 流式下载文件（不加载到内存）
 * 返回可读流和元数据，用于直接管道传输到 HTTP 响应
 */
export async function getFileStream(storageKey: string): Promise<{
	stream: AsyncIterable<Uint8Array>;
	contentType: string | undefined;
	contentLength: number | undefined;
}> {
	const client = getS3Client();

	const response = await client.send(
		new GetObjectCommand({
			Bucket: bucket,
			Key: storageKey
		})
	);

	if (!response.Body) {
		throw new Error(`Empty response body for key: ${storageKey}`);
	}

	return {
		stream: response.Body as AsyncIterable<Uint8Array>,
		contentType: response.ContentType,
		contentLength: response.ContentLength
	};
}

/**
 * 获取文件的预签名下载 URL
 */
export async function getDownloadUrl(
	storageKey: string,
	expiresIn = 3600
): Promise<string> {
	const client = getS3Client();

	const url = await getSignedUrl(
		client,
		new GetObjectCommand({
			Bucket: bucket,
			Key: storageKey
		}),
		{ expiresIn }
	);

	return rewritePresignedUrl(url);
}

/**
 * 获取文件的预签名上传 URL
 */
export async function getUploadUrl(
	storageKey: string,
	mimeType?: string,
	expiresIn = 3600
): Promise<string> {
	const client = getS3Client();

	const url = await getSignedUrl(
		client,
		new PutObjectCommand({
			Bucket: bucket,
			Key: storageKey,
			ContentType: mimeType || "application/octet-stream"
		}),
		{ expiresIn }
	);

	return rewritePresignedUrl(url);
}

/**
 * 删除单个文件
 */
export async function deleteFile(storageKey: string): Promise<void> {
	const client = getS3Client();

	await client.send(
		new DeleteObjectCommand({
			Bucket: bucket,
			Key: storageKey
		})
	);

	logger.debug(`Deleted file: ${storageKey}`);
}

/**
 * 批量删除文件
 */
export async function deleteFiles(storageKeys: string[]): Promise<void> {
	if (storageKeys.length === 0) return;

	const client = getS3Client();

	// S3 每次最多删除 1000 个对象
	const batchSize = 1000;
	for (let i = 0; i < storageKeys.length; i += batchSize) {
		const batch = storageKeys.slice(i, i + batchSize);

		await client.send(
			new DeleteObjectsCommand({
				Bucket: bucket,
				Delete: {
					Objects: batch.map((key) => ({ Key: key }))
				}
			})
		);
	}

	logger.debug(`Deleted ${storageKeys.length} files`);
}

/**
 * 检查文件是否存在
 */
export async function fileExists(storageKey: string): Promise<boolean> {
	const client = getS3Client();

	try {
		await client.send(
			new HeadObjectCommand({
				Bucket: bucket,
				Key: storageKey
			})
		);
		return true;
	} catch (error: unknown) {
		if ((error as { name?: string }).name === "NotFound") {
			return false;
		}
		throw error;
	}
}

/**
 * 复制文件（用于某些特殊场景，正常重命名/移动不需要）
 */
export async function copyFile(
	sourceKey: string,
	destKey: string
): Promise<void> {
	const client = getS3Client();

	await client.send(
		new CopyObjectCommand({
			Bucket: bucket,
			CopySource: `${bucket}/${sourceKey}`,
			Key: destKey
		})
	);

	logger.debug(`Copied file: ${sourceKey} -> ${destKey}`);
}

/**
 * 获取文件内容为字符串
 * 用于读取 JSON 等文本文件
 */
export async function getObject(storageKey: string): Promise<string | null> {
	try {
		const buffer = await downloadFile(storageKey);
		return buffer.toString("utf-8");
	} catch (error: unknown) {
		if ((error as { name?: string }).name === "NoSuchKey") {
			return null;
		}
		throw error;
	}
}

/**
 * 保存字符串内容到文件
 * 用于保存 JSON 等文本文件
 */
export async function putObject(
	storageKey: string,
	content: string,
	mimeType = "application/json"
): Promise<void> {
	await uploadFile(storageKey, Buffer.from(content, "utf-8"), mimeType);
}

/**
 * 删除单个对象（别名）
 */
export async function deleteObject(storageKey: string): Promise<void> {
	await deleteFile(storageKey);
}
