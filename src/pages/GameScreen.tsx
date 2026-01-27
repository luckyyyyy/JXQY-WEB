/**
 * GameScreen - 游戏页面
 *
 * 特点:
 * - 游戏逻辑在单例引擎中运行
 * - React只负责画布和UI
 * - 窗口调整时只更新尺寸
 * - 所有调试功能通过 DebugManager 访问
 * - 支持从 URL 参数加载存档 (?load=N)
 * - 左侧图标菜单栏 + 面板展开（类似 VS Code 侧边栏）
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Game, DebugPanel, SaveLoadPanel, SettingsPanel } from "../components";
import type { GameHandle } from "../components";

// 侧边栏宽度常量
const SIDEBAR_WIDTH = 48;
const PANEL_MIN_WIDTH = 200;
const PANEL_MAX_WIDTH = 600;
const PANEL_DEFAULT_WIDTH = 280;
const PANEL_WIDTH_STORAGE_KEY = "jxqy_panel_width";

// 从 localStorage 读取面板宽度
const getStoredPanelWidth = (): number => {
  try {
    const stored = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (stored) {
      const width = parseInt(stored, 10);
      if (width >= PANEL_MIN_WIDTH && width <= PANEL_MAX_WIDTH) {
        return width;
      }
    }
  } catch (e) {
    console.warn("Failed to read panel width from localStorage:", e);
  }
  return PANEL_DEFAULT_WIDTH;
};

// 保存面板宽度到 localStorage
const savePanelWidth = (width: number) => {
  try {
    localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch (e) {
    console.warn("Failed to save panel width to localStorage:", e);
  }
};

// 当前展开的面板类型
type ActivePanel = "none" | "debug" | "saveload" | "settings";

export default function GameScreen() {
  const gameRef = useRef<GameHandle>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("debug");
  const [panelWidth, setPanelWidth] = useState(getStoredPanelWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [, forceUpdate] = useState({});

  // 获取 URL 参数
  const [searchParams] = useSearchParams();
  const loadSlot = useMemo(() => {
    const loadParam = searchParams.get("load");
    if (loadParam) {
      const slot = parseInt(loadParam, 10);
      if (slot >= 1 && slot <= 7) {
        return slot;
      }
    }
    return undefined;
  }, [searchParams]);

  // 获取 DebugManager
  const getDebugManager = () => gameRef.current?.getDebugManager();
  const getEngine = () => gameRef.current?.getEngine();

  // 计算当前面板占用宽度
  const currentPanelWidth = activePanel !== "none" ? panelWidth : 0;

  // 窗口尺寸
  const [windowSize, setWindowSize] = useState(() => ({
    width: Math.min(window.innerWidth - SIDEBAR_WIDTH - currentPanelWidth, 1280),
    height: Math.min(window.innerHeight - 20, 720),
  }));

  // 监听窗口大小变化
  useEffect(() => {
    const updateSize = () => {
      const activePanelWidth = activePanel !== "none" ? panelWidth : 0;
      setWindowSize({
        width: Math.min(window.innerWidth - SIDEBAR_WIDTH - activePanelWidth, 1280),
        height: Math.min(window.innerHeight - 20, 720),
      });
    };
    window.addEventListener("resize", updateSize);
    updateSize(); // 初始化时也更新
    return () => window.removeEventListener("resize", updateSize);
  }, [activePanel, panelWidth]);

  // 拖拽调整面板宽度
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - SIDEBAR_WIDTH;
      const clampedWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      savePanelWidth(panelWidth);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, panelWidth]);

  // 定期更新调试面板
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // 切换面板
  const togglePanel = (panel: ActivePanel) => {
    if (activePanel === panel) {
      setActivePanel("none");
    } else {
      setActivePanel(panel);
    }
  };

  // 存档操作
  const handleSave = async (index: number): Promise<boolean> => {
    const engine = getEngine();
    if (!engine) return false;
    return await engine.saveGameToSlot(index);
  };

  // 读档操作
  const handleLoad = async (index: number): Promise<boolean> => {
    const engine = getEngine();
    if (!engine) return false;
    try {
      await engine.loadGameFromSlot(index);
      setActivePanel("none"); // 读档成功后关闭面板
      return true;
    } catch (error) {
      console.error("Load game error:", error);
      return false;
    }
  };

  // 截图功能
  const takeScreenshot = () => {
    const engine = getEngine();
    if (!engine) return;

    const canvas = engine.getCanvas();
    if (!canvas) {
      console.warn("No canvas available for screenshot");
      return;
    }

    try {
      // 将 canvas 转为 PNG 数据
      const dataUrl = canvas.toDataURL("image/png");

      // 创建下载链接
      const link = document.createElement("a");
      link.download = `jxqy_screenshot_${Date.now()}.png`;
      link.href = dataUrl;

      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("[GameScreen] Screenshot saved");
    } catch (error) {
      console.error("[GameScreen] Screenshot failed:", error);
    }
  };

  // 音频控制函数 - 使用 useCallback 稳定引用，避免因 forceUpdate 导致子组件重复渲染
  const getMusicVolume = useCallback(
    () => getEngine()?.getAudioManager()?.getMusicVolume() ?? 0.7,
    []
  );
  const setMusicVolume = useCallback(
    (volume: number) => getEngine()?.getAudioManager()?.setMusicVolume(volume),
    []
  );
  const getSoundVolume = useCallback(
    () => getEngine()?.getAudioManager()?.getSoundVolume() ?? 1.0,
    []
  );
  const setSoundVolume = useCallback(
    (volume: number) => getEngine()?.getAudioManager()?.setSoundVolume(volume),
    []
  );

  // 音乐启用状态
  const isMusicEnabled = useCallback(
    () => getEngine()?.getAudioManager()?.isMusicEnabled() ?? true,
    []
  );
  const setMusicEnabled = useCallback((enabled: boolean) => {
    const audioManager = getEngine()?.getAudioManager();
    if (audioManager) {
      audioManager.setMusicEnabled(enabled);
    }
  }, []);

  // 自动播放权限
  const isAutoplayAllowed = useCallback(
    () => getEngine()?.getAudioManager()?.isAutoplayAllowed() ?? false,
    []
  );
  const requestAutoplayPermission = useCallback(async () => {
    const audioManager = getEngine()?.getAudioManager();
    if (audioManager) {
      return await audioManager.requestAutoplayPermission();
    }
    return false;
  }, []);

  // 获取调试数据（从 DebugManager）
  const debugManager = getDebugManager();

  // 侧边栏按钮配置
  const sidebarButtons = [
    {
      id: "debug" as const,
      icon: "🔧",
      tooltip: "调试",
    },
    {
      id: "saveload" as const,
      icon: "💾",
      tooltip: "存档",
    },
    {
      id: "settings" as const,
      icon: "⚙️",
      tooltip: "设置",
    },
    {
      id: "screenshot" as const,
      icon: "📷",
      tooltip: "截图",
      action: takeScreenshot, // 截图不展开面板，直接执行
    },
  ];

  return (
    <div className="w-full h-full flex">
      {/* 左侧图标菜单栏 */}
      <div className="w-12 bg-[#1a1a2e] flex flex-col items-center py-2 gap-1 border-r border-gray-700/50 z-10">
        {sidebarButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => {
              if ('action' in btn && btn.action) {
                btn.action();
              } else {
                togglePanel(btn.id as ActivePanel);
              }
            }}
            className={`
              w-10 h-10 flex items-center justify-center rounded-lg text-xl
              transition-all duration-200 relative group
              ${activePanel === btn.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "bg-transparent text-gray-400 hover:bg-gray-700/50 hover:text-white"
              }
            `}
            title={btn.tooltip}
          >
            {btn.icon}
            {/* Tooltip */}
            <span className="
              absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs
              rounded whitespace-nowrap opacity-0 pointer-events-none
              group-hover:opacity-100 transition-opacity z-50
            ">
              {btn.tooltip}
            </span>
          </button>
        ))}
      </div>

      {/* 展开的面板区域 */}
      {activePanel !== "none" && (
        <div
          className="border-r border-gray-700/50 flex-shrink-0 relative"
          style={{ width: panelWidth, height: "100%", "--panel-width": `${panelWidth}px` } as React.CSSProperties}
        >
          {/* 调试面板 */}
          {activePanel === "debug" && (
            <div className="h-full bg-[#0d0d1a] overflow-y-auto">
              <DebugPanel
                onClose={() => setActivePanel("none")}
                isGodMode={debugManager?.isGodMode() ?? false}
                playerStats={debugManager?.getPlayerStats() ?? undefined}
                playerPosition={debugManager?.getPlayerPosition() ?? undefined}
                loadedResources={debugManager?.getLoadedResources() ?? undefined}
                gameVariables={debugManager?.getGameVariables()}
                xiuLianMagic={debugManager?.getXiuLianMagic() ?? undefined}
                triggeredTrapIds={debugManager?.getTriggeredTrapIds()}
                currentScriptInfo={debugManager?.getCurrentScriptInfo() ?? undefined}
                scriptHistory={debugManager?.getScriptHistory()}
                onFullAll={() => debugManager?.fullAll()}
                onSetLevel={(level) => debugManager?.setLevel(level)}
                onAddMoney={(amount) => debugManager?.addMoney(amount)}
                onToggleGodMode={() => debugManager?.toggleGodMode()}
                onReduceLife={() => debugManager?.reduceLife()}
                onKillAllEnemies={() => debugManager?.killAllEnemies()}
                onExecuteScript={async (script) => {
                  const result = await debugManager?.executeScript(script);
                  return result ?? "DebugManager not initialized";
                }}
                onAddItem={async (itemFile) => { await debugManager?.addItem(itemFile); }}
                onAddMagic={async (magicFile) => { await debugManager?.addMagic(magicFile); }}
                onAddAllMagics={async () => { await debugManager?.addAllMagics(); }}
                onXiuLianLevelUp={() => debugManager?.xiuLianLevelUp()}
                onXiuLianLevelDown={() => debugManager?.xiuLianLevelDown()}
              />
            </div>
          )}

          {/* 存档/读档面板 */}
          {activePanel === "saveload" && (
            <SaveLoadPanel
              onSave={handleSave}
              onLoad={handleLoad}
              onClose={() => setActivePanel("none")}
            />
          )}

          {/* 设置面板 */}
          {activePanel === "settings" && (
            <SettingsPanel
              getMusicVolume={getMusicVolume}
              setMusicVolume={setMusicVolume}
              getSoundVolume={getSoundVolume}
              setSoundVolume={setSoundVolume}
              isMusicEnabled={isMusicEnabled}
              setMusicEnabled={setMusicEnabled}
              isAutoplayAllowed={isAutoplayAllowed}
              requestAutoplayPermission={requestAutoplayPermission}
              onClose={() => setActivePanel("none")}
            />
          )}

          {/* 拖拽调整宽度手柄 */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500/70 z-20"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          />
        </div>
      )}

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center relative bg-black">
        <Game
          ref={gameRef}
          width={windowSize.width}
          height={windowSize.height}
          loadSlot={loadSlot}
        />
      </div>
    </div>
  );
}
