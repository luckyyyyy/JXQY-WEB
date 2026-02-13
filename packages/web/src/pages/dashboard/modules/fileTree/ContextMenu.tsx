/**
 * 右键菜单组件（支持子菜单）
 */
import { useEffect, useRef, useState } from "react";

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  /** 子菜单项 */
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuIndex, setSubmenuIndex] = useState<number | null>(null);

  // 调整位置防止超出屏幕
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8;
    }
    if (y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8;
    }

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [x, y]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[#252526] border border-widget-border rounded shadow-xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) =>
        item.divider ? (
          <div key={index} className="my-1 border-t border-widget-border" />
        ) : (
          <div
            key={index}
            className="relative"
            onMouseEnter={() => item.children && setSubmenuIndex(index)}
            onMouseLeave={() => item.children && setSubmenuIndex(null)}
          >
            <button
              onClick={() => {
                if (item.children) return; // 有子菜单的不直接触发
                item.onClick();
                onClose();
              }}
              disabled={item.disabled}
              className={`
                w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2
                ${item.disabled ? "text-[#666] cursor-not-allowed" : ""}
                ${item.danger && !item.disabled ? "text-red-400 hover:bg-[#3c3c3c]" : ""}
                ${!item.danger && !item.disabled ? "text-[#cccccc] hover:bg-[#094771]" : ""}
                transition-colors
              `}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.children && <span className="text-[#666] text-[10px] ml-2">▶</span>}
            </button>
            {/* 子菜单 */}
            {item.children && submenuIndex === index && (
              <SubMenu items={item.children} onClose={onClose} />
            )}
          </div>
        )
      )}
    </div>
  );
}

/** 子菜单浮层 */
function SubMenu({ items, onClose }: { items: ContextMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // 调整位置防止超出屏幕
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 水平方向：默认向右展开，空间不够则向左
    if (rect.right > vw) {
      el.style.left = "auto";
      el.style.right = "100%";
    }
    // 垂直方向：超出底部则上移
    if (rect.bottom > vh) {
      el.style.top = `${vh - rect.bottom - 4}px`;
    }
  }, []);

  return (
    <div
      ref={ref}
      className="absolute left-full top-0 bg-[#252526] border border-widget-border rounded shadow-xl py-1 min-w-[140px] z-50"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1 border-t border-widget-border" />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
            className={`
              w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2
              ${item.disabled ? "text-[#666] cursor-not-allowed" : ""}
              ${item.danger && !item.disabled ? "text-red-400 hover:bg-[#3c3c3c]" : ""}
              ${!item.danger && !item.disabled ? "text-[#cccccc] hover:bg-[#094771]" : ""}
              transition-colors
            `}
          >
            {item.icon && <span className="w-4 h-4">{item.icon}</span>}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
