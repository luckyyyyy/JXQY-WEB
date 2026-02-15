/**
 * 通用 INI 文件导入模态框
 * 支持拖放文件/文件夹、批量导入、结果展示
 */
import { type ReactNode, useState } from "react";
import { ModalCancelButton, ModalPrimaryButton, ModalShell } from "./ModalShell";

// ===== 文件读取工具 =====

/** 递归读取目录中所有条目（每次 readEntries 最多返回 100 个） */
async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  const readBatch = async (): Promise<void> => {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length > 0) {
      all.push(...batch);
      await readBatch();
    }
  };
  await readBatch();
  return all;
}

export interface DroppedFile {
  fileName: string;
  content: string;
  fullPath: string;
}

/**
 * 递归读取拖放的文件，返回所有匹配的文件
 * @param dataTransfer - 拖放事件的 dataTransfer
 * @param filter - 文件过滤函数，默认只接受 .ini 文件
 */
export async function readDroppedFiles(
  dataTransfer: DataTransfer,
  filter: (fileName: string, fullPath: string) => boolean = (f) => f.toLowerCase().endsWith(".ini")
): Promise<DroppedFile[]> {
  const results: DroppedFile[] = [];

  const processEntry = async (entry: FileSystemEntry, basePath = "") => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
      if (filter(file.name, fullPath)) {
        results.push({ fileName: file.name, content: await file.text(), fullPath });
      }
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await readAllEntries(reader);
      const dir = basePath ? `${basePath}/${entry.name}` : entry.name;
      for (const sub of entries) {
        await processEntry(sub, dir);
      }
    }
  };

  for (let i = 0; i < dataTransfer.items.length; i++) {
    const entry = dataTransfer.items[i].webkitGetAsEntry();
    if (entry) await processEntry(entry);
  }

  return results;
}

// ===== 导入模态框 =====

export interface ImportResult {
  success: Array<{ fileName: string; id: string; name: string; [key: string]: unknown }>;
  failed: Array<{ fileName: string; error: string }>;
}

export interface ImportIniModalProps<T extends { fileName: string }> {
  /** 模态框标题 */
  title: string;
  /** 拖放区域图标 (emoji) */
  icon: string;
  /** 拖放区域主提示文字 */
  dropHint: string;
  /** 拖放区域副提示文字 */
  dropSubHint?: string;
  /** 实体类型标签 ("物品"、"角色"等) */
  entityLabel: string;
  onClose: () => void;
  onImport: (items: T[]) => void;
  isLoading: boolean;
  batchResult?: ImportResult | null;
  /** 自定义文件处理逻辑，返回待导入项目列表 */
  processFiles: (dataTransfer: DataTransfer) => Promise<T[]>;
  /** 自定义单个待导入项渲染 */
  renderItem?: (item: T, index: number, onRemove: () => void) => ReactNode;
  /** 自定义成功项渲染 */
  renderSuccessItem?: (item: ImportResult["success"][number]) => ReactNode;
  /** 拖放区域前的描述内容 */
  description?: ReactNode;
  /** 额外的导入禁用条件 */
  importDisabled?: boolean;
  width?: string;
}

export function ImportIniModal<T extends { fileName: string }>({
  title,
  icon,
  dropHint,
  dropSubHint,
  entityLabel,
  onClose,
  onImport,
  isLoading,
  batchResult,
  processFiles,
  renderItem,
  renderSuccessItem,
  description,
  importDisabled,
  width = "w-[500px]",
}: ImportIniModalProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const processed = await processFiles(e.dataTransfer);
    if (processed.length > 0) {
      setItems(processed);
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      width={width}
      footer={
        <>
          <ModalCancelButton onClick={onClose} hasResult={!!batchResult} />
          <ModalPrimaryButton
            onClick={() => onImport(items)}
            disabled={items.length === 0 || importDisabled}
            loading={isLoading}
            loadingText="导入中..."
          >
            {`导入 (${items.length})`}
          </ModalPrimaryButton>
        </>
      }
    >
      {description}

      {/* 拖放区域 */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-[#0098ff] bg-[#0098ff]/10"
            : "border-widget-border hover:border-[#666]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-3">{icon}</div>
        <p className="text-[#cccccc] text-sm">{dropHint}</p>
        {dropSubHint && <p className="text-[#858585] text-xs mt-1">{dropSubHint}</p>}
      </div>

      {/* 待导入文件列表 */}
      {items.length > 0 && (
        <div className="max-h-48 overflow-y-auto border border-widget-border rounded">
          {items.map((item, index) =>
            renderItem ? (
              renderItem(item, index, () => removeItem(index))
            ) : (
              <BatchItemRow
                key={item.fileName}
                fileName={item.fileName}
                onRemove={() => removeItem(index)}
              />
            )
          )}
        </div>
      )}

      {/* 导入结果 */}
      {batchResult && (
        <ImportResultDisplay
          result={batchResult}
          entityLabel={entityLabel}
          renderSuccessItem={renderSuccessItem}
        />
      )}
    </ModalShell>
  );
}

// ===== 子组件 =====

/** 默认的待导入项行 */
export function BatchItemRow({
  fileName,
  onRemove,
  badge,
  extra,
}: {
  fileName: string;
  onRemove: () => void;
  badge?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-widget-border last:border-b-0 hover:bg-[#2a2d2e]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {badge}
        <span className="text-sm text-white truncate">{fileName}</span>
        {extra}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-[#858585] hover:text-red-400 text-sm shrink-0 ml-2"
      >
        ✕
      </button>
    </div>
  );
}

/** 导入结果展示 */
function ImportResultDisplay({
  result,
  entityLabel,
  renderSuccessItem,
}: {
  result: ImportResult;
  entityLabel: string;
  renderSuccessItem?: (item: ImportResult["success"][number]) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      {result.success.length > 0 && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
          <p className="text-green-400 text-sm font-medium mb-1">
            ✓ 成功导入 {result.success.length} 个{entityLabel}
          </p>
          <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
            {result.success.map((s) => (
              <div key={s.id}>{renderSuccessItem ? renderSuccessItem(s) : s.name}</div>
            ))}
          </div>
        </div>
      )}
      {result.failed.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-red-400 text-sm font-medium mb-1">✗ 失败 {result.failed.length} 个</p>
          <div className="text-xs text-red-400/80 max-h-24 overflow-y-auto">
            {result.failed.map((f) => (
              <div key={f.fileName}>
                {f.fileName}: {f.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
