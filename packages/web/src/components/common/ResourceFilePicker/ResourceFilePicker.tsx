/**
 * 资源文件选择器
 *
 * 通用的游戏资源文件选择组件，支持：
 * - ASF 动画预览（内嵌）
 * - 音频播放（WAV/OGG/XNB）
 * - 脚本预览（TXT）
 * - 点击修改弹出文件选择器
 * - 每个字段占一行
 */
import { useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileSelectDialog } from "./FileSelectDialog";
import { MiniAsfPreview } from "./AsfPreviewTooltip";
import { MiniAudioPlayer } from "./MiniAudioPlayer";
import { ScriptPreviewTooltip } from "./ScriptPreviewTooltip";
import { buildResourcePath, buildScriptPreviewPath, buildIniPreviewPath, buildCharacterResourcePaths, getResourceFileType } from "./types";

export interface ResourceFilePickerProps {
  /** 字段标签 */
  label: string;
  /** 当前值 */
  value: string | null | undefined;
  /** 值变化回调 */
  onChange: (value: string | null) => void;
  /** 字段名（用于确定默认路径和类型） */
  fieldName: string;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug（用于预览） */
  gameSlug: string;
  /** 允许的扩展名 */
  extensions?: string[];
  /** 占位文本 */
  placeholder?: string;
  /** 只读模式：禁止编辑但保留预览和试听 */
  readonly?: boolean;
  /** label 显示为输入框内的 tag 徽章（而非外部文本） */
  inlineLabel?: boolean;
}

export function ResourceFilePicker({
  label,
  value,
  onChange,
  fieldName,
  gameId,
  gameSlug,
  extensions,
  placeholder = "未选择",
  readonly: isReadonly = false,
  inlineLabel = false,
}: ResourceFilePickerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showScriptPreview, setShowScriptPreview] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 完整资源路径
  const fullPath = value ? buildResourcePath(fieldName, value) : "";

  // 文件类型
  const fileType = getResourceFileType(fieldName, value || "");

  // 预览路径（脚本和 INI 需要特殊处理）
  const previewPath = (() => {
    if (!value) return "";
    if (fileType === "script") return buildScriptPreviewPath(value);
    if (fileType === "ini") return buildIniPreviewPath(value);
    return fullPath;
  })();

  // ASF 预览路径（支持多路径尝试，用于 character 资源）
  const asfPreviewPaths = value ? buildCharacterResourcePaths(fieldName, value) : [];

  // 文件名（用于在路径未解析时显示）
  const fileName = value?.replace(/\\/g, "/").split("/").pop() || "";

  // 显示路径：
  // - 如果有多个候选路径且未解析，只显示文件名
  // - 如果已解析，显示完整路径
  // - 如果只有单一路径，直接显示
  const displayPath = (() => {
    if (resolvedPath) return `/${resolvedPath}`;
    if (asfPreviewPaths.length > 1) return fileName; // 多候选路径，显示文件名
    if (previewPath) return `/${previewPath}`;
    return "";
  })();

  // 当 value 变化时重置解析路径
  useEffect(() => {
    setResolvedPath(null);
  }, []);

  // 打开选择器
  const handleOpenDialog = useCallback(() => {
    if (isReadonly) return;
    setIsDialogOpen(true);
  }, [isReadonly]);

  // 选择文件
  const handleSelect = useCallback((path: string) => {
    let normalizedPath = path.replace(/\\/g, "/");

    // 根据字段类型决定保存格式
    const selectedFileType = getResourceFileType(fieldName, normalizedPath);
    if (selectedFileType === "script" || selectedFileType === "ini") {
      // 脚本和 INI 只保存文件名（引擎会动态查找完整路径）
      normalizedPath = normalizedPath.split("/").pop() || normalizedPath;
    } else {
      // 资源路径统一以 / 开头
      if (!normalizedPath.startsWith("/")) {
        normalizedPath = `/${normalizedPath}`;
      }
    }

    onChange(normalizedPath);
    setIsDialogOpen(false);
  }, [onChange, fieldName]);

  // 清除
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  }, [onChange]);

  return (
    <div className={`${inlineLabel ? '' : 'flex items-center gap-3'} relative`} ref={containerRef}>
      {/* 外部标签（非 inlineLabel 时） */}
      {!inlineLabel && <label className="text-xs text-[#858585] w-20 flex-shrink-0">{label}</label>}

      {/* 内容区 - 固定高度，可点击 */}
      <div
        className={`${inlineLabel ? '' : 'flex-1'} bg-[#2d2d2d] border border-[#454545] rounded h-9 flex items-center px-2 transition-colors group ${isReadonly ? 'cursor-default opacity-80' : 'cursor-pointer hover:border-[#0098ff]'}`}
        onClick={handleOpenDialog}
        onMouseEnter={() => {
          setIsHovered(true);
          if ((fileType === "script" || fileType === "ini") && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setTooltipPos({ x: rect.left + 80, y: rect.bottom + 4 });
            setShowScriptPreview(true);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowScriptPreview(false);
          setTooltipPos(null);
        }}
      >
        {value ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 行内标签 tag */}
            {inlineLabel && (
              <span className="text-[10px] font-medium text-[#8a8a8a] bg-[#3c3c3c] px-1.5 py-0.5 rounded flex-shrink-0">
                {label}
              </span>
            )}
            {/* 预览图标 */}
            {fileType === "asf" && (
              <MiniAsfPreview
                gameSlug={gameSlug}
                path={asfPreviewPaths.length > 0 ? asfPreviewPaths : previewPath}
                size={24}
                onPathResolved={setResolvedPath}
              />
            )}
            {fileType === "audio" && (
              <MiniAudioPlayer gameSlug={gameSlug} path={previewPath} />
            )}
            {fileType === "script" && (
              <span className="text-sm flex-shrink-0">📄</span>
            )}
            {fileType === "ini" && (
              <span className="text-sm flex-shrink-0">⚙️</span>
            )}

            {/* 文件路径 */}
            <span className="text-xs text-[#cccccc] truncate flex-1" title={previewPath}>
              {displayPath}
            </span>

            {/* 悬停时显示操作按钮（只读模式隐藏） */}
            {!isReadonly && <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}>
              <button
                type="button"
                onClick={handleClear}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
                title="清除"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleOpenDialog(); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
                title="修改"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8.5 1.5l2 2M1 11l.5-2L9 1.5l2 2L3.5 11 1 11z" />
                </svg>
              </button>
            </div>}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {inlineLabel && (
              <span className="text-[10px] font-medium text-[#8a8a8a] bg-[#3c3c3c] px-1.5 py-0.5 rounded flex-shrink-0">
                {label}
              </span>
            )}
            <span className="text-xs text-[#606060]">{placeholder}</span>
          </div>
        )}
      </div>

      {/* 脚本/INI 预览 Tooltip - 使用 Portal 渲染到 body 避免被截断 */}
      {showScriptPreview && value && tooltipPos && (fileType === "script" || fileType === "ini") && createPortal(
        <div
          className="fixed z-[9999]"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <ScriptPreviewTooltip gameSlug={gameSlug} path={previewPath} />
        </div>,
        document.body
      )}

      {/* 文件选择弹窗 */}
      <FileSelectDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelect={handleSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        fieldName={fieldName}
        currentValue={value}
        extensions={extensions}
        title={`选择${label}`}
      />
    </div>
  );
}

// ========== 资源字段组 ==========

interface ResourceFieldConfig {
  key: string;
  label: string;
  extensions?: string[];
}

interface ResourceFieldGroupProps {
  /** 字段配置列表 */
  fields: ResourceFieldConfig[];
  /** 当前数据 */
  data: Record<string, string | null | undefined>;
  /** 更新字段 */
  updateField: (key: string, value: string | null) => void;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug */
  gameSlug: string;
}

export function ResourceFieldGroup({
  fields,
  data,
  updateField,
  gameId,
  gameSlug,
}: ResourceFieldGroupProps) {
  return (
    <div className="space-y-4">
      {fields.map(({ key, label, extensions }) => (
        <ResourceFilePicker
          key={key}
          label={label}
          value={data[key]}
          onChange={(value) => updateField(key, value)}
          fieldName={key}
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={extensions}
        />
      ))}
    </div>
  );
}
