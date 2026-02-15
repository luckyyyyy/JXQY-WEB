/**
 * 通用模态框壳组件
 * ModalShell + ModalCancelButton + ModalPrimaryButton + CreateEntityModal
 */
import type { ReactNode } from "react";

// ===== 基础模态框壳 =====

export interface ModalShellProps {
  title: string;
  onClose: () => void;
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function ModalShell({ title, onClose, width = "w-96", children, footer }: ModalShellProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={`bg-[#252526] rounded-lg border border-widget-border shadow-xl ${width} max-h-[85vh] overflow-auto`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h3 className="text-base font-medium text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-widget-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 模态框按钮 =====

const cancelBtnClass = "px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded";
const primaryBtnClass =
  "px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white";

export function ModalCancelButton({
  onClick,
  hasResult,
}: {
  onClick: () => void;
  hasResult?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={cancelBtnClass}>
      {hasResult ? "关闭" : "取消"}
    </button>
  );
}

export interface ModalPrimaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
  className?: string;
}

export function ModalPrimaryButton({
  onClick,
  disabled,
  loading,
  loadingText = "处理中...",
  children,
  className,
}: ModalPrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={className || primaryBtnClass}
    >
      {loading ? loadingText : children}
    </button>
  );
}

// ===== 实体创建模态框 =====

export interface CreateEntityModalProps {
  title: string;
  onClose: () => void;
  onCreate: () => void;
  createDisabled?: boolean;
  isPending: boolean;
  error?: { message: string } | null;
  width?: string;
  createLabel?: string;
  createButtonClass?: string;
  children: ReactNode;
}

/**
 * 通用实体创建模态框
 * 封装: ModalShell + 表单内容 + 错误显示 + 取消/创建按钮
 */
export function CreateEntityModal({
  title,
  onClose,
  onCreate,
  createDisabled,
  isPending,
  error,
  width,
  createLabel = "创建",
  createButtonClass,
  children,
}: CreateEntityModalProps) {
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      width={width}
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={onCreate}
            disabled={createDisabled}
            loading={isPending}
            loadingText="创建中..."
            className={createButtonClass}
          >
            {createLabel}
          </ModalPrimaryButton>
        </>
      }
    >
      {children}
      {error && <p className="text-xs text-red-400">创建失败: {error.message}</p>}
    </ModalShell>
  );
}
