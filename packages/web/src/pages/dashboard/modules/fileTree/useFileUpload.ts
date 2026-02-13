/**
 * useFileUpload — 批量上传管理
 *
 * 职责：
 * - 处理 DataTransfer（拖拽文件/文件夹，递归读取 webkitGetAsEntry）
 * - 处理 FileList（文件选择器）
 * - 批量上传流水线：ensureFolderPath → batchPrepare → S3 PUT(8 并发) → batchConfirm
 * - 上传队列 UI 状态（progress / error / completed）
 * - 自动清除已完成条目
 */
import { useState, useCallback } from "react";
import { trpc } from "../../../../lib/trpc";
import { normalizeFileName } from "./types";

// === 类型 ===

export interface UploadItem {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

interface FileWithPath {
  relativePath: string;
  file: File;
}

interface UseFileUploadOptions {
  gameId: string | undefined;
  refreshFolder: (parentId: string | null) => Promise<void>;
  refreshAll: () => Promise<void>;
}

// === 常量 ===
const S3_CONCURRENCY = 8;
const BATCH_SIZE = 100;
const COMPLETED_CLEANUP_DELAY = 2000;

// === 工具函数 ===

/** 并发池 */
async function asyncPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (let i = 0; i < items.length; i++) {
    const p = fn(items[i], i).then(() => {
      executing.delete(p);
    });
    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

/** 递归读取 FileSystemEntry */
async function readEntries(entry: FileSystemEntry, basePath = ""): Promise<FileWithPath[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
    return [{ relativePath: basePath + normalizeFileName(entry.name), file }];
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const entries: FileSystemEntry[] = [];

    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      entries.push(...batch);
    } while (batch.length > 0);

    const results: FileWithPath[] = [];
    const folderPath = `${basePath + normalizeFileName(entry.name)}/`;
    for (const child of entries) {
      const childResults = await readEntries(child, folderPath);
      results.push(...childResults);
    }
    return results;
  }

  return [];
}

/** 从 DataTransfer 提取文件列表（支持文件夹） */
async function processDataTransfer(dataTransfer: DataTransfer): Promise<FileWithPath[]> {
  // 必须同步提取所有 entry/file — DataTransfer.items 是活列表，
  // 事件处理器返回后浏览器会清空它，await 之后再访问就丢失了。
  const entries: FileSystemEntry[] = [];
  const standaloneFiles: File[] = [];

  for (let i = 0; i < dataTransfer.items.length; i++) {
    const item = dataTransfer.items[i];
    if (item.kind !== "file") continue;

    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) standaloneFiles.push(file);
    }
  }

  // FileSystemEntry 对象独立于 DataTransfer 生命周期，可安全异步处理
  const results: FileWithPath[] = [];
  for (const entry of entries) {
    const entryResults = await readEntries(entry);
    results.push(...entryResults);
  }
  for (const file of standaloneFiles) {
    results.push({ relativePath: normalizeFileName(file.name), file });
  }

  return results;
}

// === Hook ===

export function useFileUpload({ gameId, refreshFolder, refreshAll }: UseFileUploadOptions) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);

  const batchPrepareMutation = trpc.file.batchPrepareUpload.useMutation();
  const batchConfirmMutation = trpc.file.batchConfirmUpload.useMutation();
  const ensureFolderPathMutation = trpc.file.ensureFolderPath.useMutation();

  // --- 更新单个 upload item ---
  const updateUploadItem = useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    },
    [],
  );

  // --- S3 上传单个文件 ---
  const uploadToS3 = useCallback(
    async (file: File, uploadUrl: string, itemId: string): Promise<boolean> => {
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              updateUploadItem(itemId, { progress });
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          });
          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.send(file);
        });
        return true;
      } catch (error) {
        updateUploadItem(itemId, { status: "error", error: (error as Error).message });
        return false;
      }
    },
    [updateUploadItem],
  );

  // === 核心：批量上传 ===
  const batchUpload = useCallback(
    async (fileItems: FileWithPath[], rootParentId: string | null) => {
      if (!gameId || fileItems.length === 0) return;

      // 1. 创建 upload items
      const newUploads: UploadItem[] = fileItems.map((f, i) => ({
        id: `upload-${Date.now()}-${i}`,
        fileName: f.relativePath,
        progress: 0,
        status: "pending" as const,
      }));
      setUploads((prev) => [...prev, ...newUploads]);

      // 2. 收集文件夹路径并创建
      const folderPaths = new Set<string>();
      for (const { relativePath } of fileItems) {
        const parts = relativePath.split("/");
        if (parts.length > 1) {
          folderPaths.add(parts.slice(0, -1).join("/"));
        }
      }

      const folderIdCache = new Map<string, string>();
      const sortedPaths = [...folderPaths].sort();

      for (const folderPath of sortedPaths) {
        if (folderIdCache.has(folderPath)) continue;
        const pathParts = folderPath.split("/");

        let bestParentId = rootParentId;
        let startIdx = 0;
        for (let i = pathParts.length - 1; i >= 1; i--) {
          const prefix = pathParts.slice(0, i).join("/");
          const cached = folderIdCache.get(prefix);
          if (cached) {
            bestParentId = cached;
            startIdx = i;
            break;
          }
        }

        const remaining = pathParts.slice(startIdx);
        if (remaining.length === 0) continue;

        try {
          const result = await ensureFolderPathMutation.mutateAsync({
            gameId,
            parentId: bestParentId,
            pathParts: remaining,
          });
          folderIdCache.set(folderPath, result.folderId);
        } catch {
          // 继续上传其他文件，不阻塞
        }
      }

      // 3. 确定每个文件的 parentId
      interface FileMeta {
        file: File;
        fileName: string;
        parentId: string | null;
        uploadItemId: string;
      }
      const filesToUpload: FileMeta[] = fileItems.map((item, i) => {
        const parts = item.relativePath.split("/");
        const fileName = parts[parts.length - 1];
        let parentId = rootParentId;
        if (parts.length > 1) {
          parentId = folderIdCache.get(parts.slice(0, -1).join("/")) ?? rootParentId;
        }
        return { file: item.file, fileName, parentId, uploadItemId: newUploads[i].id };
      });

      // 4. 分批 prepare
      interface PreparedFile {
        meta: FileMeta;
        fileId: string;
        uploadUrl: string;
      }
      const preparedFiles: PreparedFile[] = [];

      for (let start = 0; start < filesToUpload.length; start += BATCH_SIZE) {
        const batch = filesToUpload.slice(start, start + BATCH_SIZE);
        try {
          const { results } = await batchPrepareMutation.mutateAsync({
            gameId,
            files: batch.map((f) => ({
              clientId: f.uploadItemId,
              parentId: f.parentId,
              name: f.fileName,
              size: f.file.size,
              mimeType: f.file.type || "application/octet-stream",
            })),
            skipExisting: true,
          });

          for (const result of results) {
            const meta = batch.find((f) => f.uploadItemId === result.clientId);
            if (!meta) continue;

            if (result.skipped) {
              updateUploadItem(result.clientId, { status: "completed", progress: 100 });
            } else {
              preparedFiles.push({ meta, fileId: result.fileId, uploadUrl: result.uploadUrl });
              updateUploadItem(result.clientId, { status: "uploading" });
            }
          }
        } catch (error) {
          for (const f of batch) {
            updateUploadItem(f.uploadItemId, { status: "error", error: (error as Error).message });
          }
        }
      }

      // 5. 并发 S3 上传，收集成功的 fileId
      const confirmedFileIds: string[] = [];

      await asyncPool(preparedFiles, S3_CONCURRENCY, async (prepared) => {
        const ok = await uploadToS3(prepared.meta.file, prepared.uploadUrl, prepared.meta.uploadItemId);
        if (ok) {
          updateUploadItem(prepared.meta.uploadItemId, { status: "completed", progress: 100 });
          confirmedFileIds.push(prepared.fileId);
        }
      });

      // 6. 上传完毕后分批 confirm（避免并发 splice 竞态）
      for (let start = 0; start < confirmedFileIds.length; start += BATCH_SIZE) {
        const batch = confirmedFileIds.slice(start, start + BATCH_SIZE);
        try {
          await batchConfirmMutation.mutateAsync({ fileIds: batch });
        } catch {
          // 静默，下次刷新会补上
        }
      }

      // 7. 清除已完成条目 + 刷新树
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.status !== "completed"));
      }, COMPLETED_CLEANUP_DELAY);

      await refreshAll();
    },
    [gameId, batchPrepareMutation, batchConfirmMutation, ensureFolderPathMutation, uploadToS3, updateUploadItem, refreshAll],
  );

  // === 拖拽上传入口 ===
  const handleDropUpload = useCallback(
    async (dataTransfer: DataTransfer, targetParentId: string | null) => {
      if (!gameId) return;
      setIsProcessingDrop(true);
      try {
        const files = await processDataTransfer(dataTransfer);
        if (files.length > 0) {
          await batchUpload(files, targetParentId);
        }
      } finally {
        setIsProcessingDrop(false);
      }
    },
    [gameId, batchUpload],
  );

  // === 文件选择器上传入口 ===
  const handleFileInputUpload = useCallback(
    async (fileList: FileList, parentId: string | null) => {
      if (!gameId) return;
      const items: FileWithPath[] = Array.from(fileList).map((file) => ({
        relativePath: normalizeFileName(file.name),
        file,
      }));
      await batchUpload(items, parentId);
    },
    [gameId, batchUpload],
  );

  return {
    uploads,
    isProcessingDrop,
    handleDropUpload,
    handleFileInputUpload,
  };
}
