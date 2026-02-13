/**
 * GameMenuPanel - 游戏菜单面板（存档 + 设置 合一）
 *
 * 以 Tab 标签页切换。GlassModal 风格居中弹窗。
 */

import { useEffect } from "react";
import { useAnimatedVisibility } from "@/hooks";
import { WebSaveLoadPanel } from "./WebSaveLoadPanel";
import { SettingsPanel, type SettingsPanelProps } from "../common/SidePanel";

export type MenuTab = "save" | "settings";

export interface GameMenuPanelProps {
  visible: boolean;
  onClose: () => void;
  activeTab: MenuTab;
  onTabChange: (tab: MenuTab) => void;

  // ---- save props ----
  gameSlug: string;
  canSave: boolean;
  onCollectSaveData: () => {
    data: Record<string, unknown>;
    screenshot?: string;
    mapName?: string;
    level?: number;
    playerName?: string;
  } | null;
  onLoadSaveData: (data: Record<string, unknown>) => Promise<boolean>;

  // ---- settings props ----
  settingsProps: SettingsPanelProps;
}

const TABS: { key: MenuTab; label: string }[] = [
  { key: "save", label: "存档" },
  { key: "settings", label: "设置" },
];

export function GameMenuPanel({
  visible,
  onClose,
  activeTab,
  onTabChange,
  gameSlug,
  canSave,
  onCollectSaveData,
  onLoadSaveData,
  settingsProps,
}: GameMenuPanelProps) {
  const { shouldRender, transitionStyle } = useAnimatedVisibility(visible);

  // ESC 关闭
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ opacity: transitionStyle.opacity, transition: transitionStyle.transition }}
      />

      <div
        className="relative w-[520px] h-[520px] flex flex-col rounded-2xl overflow-hidden
          bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl"
        style={transitionStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab 头部 */}
        <div className="flex items-center border-b border-white/10 flex-shrink-0">
          <div className="flex flex-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key
                    ? "text-white/90"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400/80 rounded-full" />
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors mr-3"
          >
            ✕
          </button>
        </div>

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "save" && (
            <WebSaveLoadPanel
              embedded
              gameSlug={gameSlug}
              visible={visible}
              canSave={canSave}
              onCollectSaveData={onCollectSaveData}
              onLoadSaveData={onLoadSaveData}
              onClose={onClose}
            />
          )}
          {activeTab === "settings" && <SettingsPanel {...settingsProps} />}
        </div>
      </div>
    </div>
  );
}
