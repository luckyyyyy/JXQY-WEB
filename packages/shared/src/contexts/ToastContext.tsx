/**
 * Toast 通知上下文
 * 提供全局 toast 通知功能
 */
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = `toast-${++idCounter.current}`;
      const newToast: ToastItem = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      // 自动移除
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, duration?: number) => toast(message, "success", duration),
    [toast]
  );

  const error = useCallback(
    (message: string, duration?: number) => toast(message, "error", duration ?? 6000),
    [toast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => toast(message, "warning", duration),
    [toast]
  );

  const info = useCallback(
    (message: string, duration?: number) => toast(message, "info", duration),
    [toast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        toast,
        success,
        error,
        warning,
        info,
        dismiss,
        dismissAll,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ============ Toast 容器组件 ============

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItemComponent key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastItemComponent({ item, onDismiss }: ToastItemProps) {
  const typeStyles: Record<ToastType, string> = {
    success: "bg-green-600 text-white border-green-700",
    error: "bg-red-600 text-white border-red-700",
    warning: "bg-yellow-500 text-black border-yellow-600",
    info: "bg-blue-600 text-white border-blue-700",
  };

  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border
        min-w-[280px] max-w-[400px] animate-slide-in-right
        ${typeStyles[item.type]}
      `}
      role="alert"
    >
      <span className="text-lg font-bold flex-shrink-0">{icons[item.type]}</span>
      <p className="flex-1 text-sm leading-relaxed break-words">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
}
