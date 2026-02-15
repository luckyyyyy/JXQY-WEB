/**
 * 上传进度条组件
 */

interface UploadProgressProps {
  fileName: string;
  progress: number; // 0-100
  total: number;
  current: number;
}

export function UploadProgress({ fileName, progress, total, current }: UploadProgressProps) {
  return (
    <div className="bg-[#1e1e1e] border-t border-widget-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-[#cccccc] truncate flex-1">{fileName}</span>
        <span className="text-[12px] text-[#858585] ml-2">
          {current}/{total}
        </span>
      </div>
      <div className="h-1 bg-[#3c3c3c] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#0e639c] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface UploadQueueProps {
  uploads: Array<{
    id: string;
    fileName: string;
    progress: number;
    status: "pending" | "uploading" | "completed" | "error";
    error?: string;
  }>;
}

export function UploadQueue({ uploads }: UploadQueueProps) {
  const activeUploads = uploads.filter((u) => u.status !== "completed");
  const currentUpload = uploads.find((u) => u.status === "uploading");
  const completedCount = uploads.filter((u) => u.status === "completed").length;
  const errorCount = uploads.filter((u) => u.status === "error").length;
  const totalCount = uploads.length;

  if (activeUploads.length === 0) return null;

  // 计算总体进度
  const overallProgress =
    totalCount > 0
      ? Math.round(
          (completedCount / totalCount) * 100 + (currentUpload?.progress ?? 0) / totalCount
        )
      : 0;

  return (
    <div className="bg-[#1e1e1e] border-t border-widget-border p-3">
      {/* 总体进度 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-[#858585]">
          上传进度: {completedCount}/{totalCount}
          {errorCount > 0 && <span className="text-red-400 ml-2">({errorCount} 失败)</span>}
        </span>
        <span className="text-[12px] text-[#0e639c]">{overallProgress}%</span>
      </div>

      {/* 总体进度条 */}
      <div className="h-1 bg-[#3c3c3c] rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-[#0e639c] transition-all duration-300"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* 当前文件 */}
      {currentUpload && (
        <div className="text-[13px] text-[#cccccc] truncate">{currentUpload.fileName}</div>
      )}
    </div>
  );
}
