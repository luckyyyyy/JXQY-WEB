/**
 * GamePlaying - 游戏运行界面
 *
 * 仅在游戏阶段（playing）挂载，完全拥有引擎生命周期。
 * 包含：Game 引擎组件、调试面板、存档/设置菜单、音频控制、截图、移动端控制等。
 *
 * 与 GameScreen 的分工：
 * - GameScreen：路由入口、加载验证、title 界面（不依赖引擎）
 * - GamePlaying：引擎相关的一切（挂载时引擎初始化，卸载时引擎销毁）
 */

import { logger } from "@miu2d/engine/core/logger";
import { reloadGameData } from "@miu2d/engine/resource";
import { resourceLoader } from "@miu2d/engine/resource/resource-loader";
import type { SaveData } from "@miu2d/engine/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameHandle } from "../components";
import {
  DebugPanel,
  DockedPanel,
  Game,
  GameCursor,
  GameMenuPanel,
  MobileControls,
  TouchDragIndicator,
} from "../components";
import { VideoPlayer } from "../components/game/ui/classic";
import type { ToolbarButton } from "../components";
import type { MenuTab } from "../components/game/GameMenuPanel";
import type { UITheme } from "../components/game/ui";
import { useAuth } from "../contexts";

// 当前展开的面板类型（不含调试面板，调试面板独立管理）
type ActivePanel = "none" | "menu";

export interface GamePlayingProps {
  gameSlug: string;
  isEmbed: boolean;
  isDataReady: boolean;
  initialSaveData?: SaveData;
  uiTheme: UITheme;
  setUITheme: (theme: UITheme) => void;
  gameResolution: { width: number; height: number };
  setResolution: (width: number, height: number) => void;
  windowSize: { width: number; height: number; scale: number };
  isMobile: boolean;
  onReturnToTitle: () => void;
  /** 通知 GameScreen 打开登录弹窗 */
  onLoginRequest: () => void;
  /** 提供 toolbar 按钮给 GameTopBar */
  onToolbarButtons: (buttons: ToolbarButton[]) => void;
}

export function GamePlaying({
  gameSlug,
  isEmbed,
  isDataReady,
  initialSaveData,
  uiTheme,
  setUITheme,
  gameResolution,
  setResolution,
  windowSize,
  isMobile,
  onReturnToTitle,
  onLoginRequest,
  onToolbarButtons,
}: GamePlayingProps) {
  const gameRef = useRef<GameHandle>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [showDebug, setShowDebug] = useState(false);
  const [menuTab, setMenuTab] = useState<MenuTab>("save");
  const [, forceUpdate] = useState({});
  const { isAuthenticated } = useAuth();

  // 获取 DebugManager / Engine（稳定引用，通过 ref 访问）
  const getDebugManager = useCallback(() => gameRef.current?.getDebugManager(), []);
  const getEngine = useCallback(() => gameRef.current?.getEngine(), []);

  // 定期更新调试面板数据
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 500);
    return () => clearInterval(interval);
  }, []);

  // ESC 键全局处理（capture 阶段，优先于引擎和面板自身的 ESC 监听）
  // - 面板打开时：关闭面板，阻止事件传播
  // - 面板关闭时：检查引擎是否有阻塞性 UI（对话框、选择、商店）
  //   - 有 → 转发给引擎处理
  //   - 无 → 直接打开存档菜单，阻止事件传播
  useEffect(() => {
    const handleEscCapture = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (activePanel !== "none") {
        // 关闭已打开的面板
        e.stopPropagation();
        e.preventDefault();
        setActivePanel("none");
        // 恢复游戏容器焦点
        setTimeout(() => {
          gameAreaRef.current?.querySelector<HTMLDivElement>('[role="application"]')?.focus();
        }, 0);
        return;
      }

      // 没有 Web 面板打开 → 检查引擎状态
      const engine = getEngine();
      if (!engine) return;

      const gui = engine.getGameManager()?.getGuiManager();
      if (!gui) return;

      const guiState = gui.getState();
      // 如果引擎有阻塞性 UI（对话框、选择、商店等），让事件自然流向引擎处理
      const hasBlockingUI =
        guiState.dialog.isVisible ||
        guiState.selection.isVisible ||
        guiState.multiSelection.isVisible ||
        guiState.panels.buy ||
        guiState.panels.littleMap;

      if (hasBlockingUI) {
        // 让事件正常传播到引擎
        // 但如果游戏容器没有焦点，手动转发给引擎
        const gameContainer = gameAreaRef.current?.querySelector<HTMLDivElement>('[role="application"]');
        if (document.activeElement !== gameContainer) {
          e.stopPropagation();
          e.preventDefault();
          engine.handleKeyDown("Escape", false);
        }
        return;
      }

      // 有普通面板打开（F1状态/F2装备等）→ 只关闭面板，不打开菜单
      if (gui.isAnyPanelOpen()) {
        e.stopPropagation();
        e.preventDefault();
        gui.closeAllPanels();
        return;
      }

      // 脚本运行期间禁止打开菜单
      if (gui.isScriptRunning()) {
        return;
      }

      // 没有任何面板/对话 → 打开存档菜单
      e.stopPropagation();
      e.preventDefault();
      setMenuTab("save");
      setActivePanel("menu");
    };
    window.addEventListener("keydown", handleEscCapture, true);
    return () => window.removeEventListener("keydown", handleEscCapture, true);
  }, [activePanel, getEngine]);

  // 返回标题界面
  const handleReturnToTitle = useCallback(() => {
    logger.log("[GamePlaying] Returning to title...");
    // 销毁引擎
    gameRef.current?.getEngine()?.dispose();
    // 重置面板
    setActivePanel("none");
    setShowDebug(false);
    // 通知父组件切换到 title
    onReturnToTitle();
    logger.log("[GamePlaying] Returned to title");
  }, [onReturnToTitle]);

  // 引擎系统菜单/存档面板 → 打开 Web 透明模态窗
  const handleOpenMenu = useCallback((tab: "save" | "settings") => {
    setMenuTab(tab);
    setActivePanel("menu");
  }, []);

  // 切换调试面板
  const toggleDebug = useCallback(() => {
    setShowDebug((prev) => !prev);
  }, []);

  // ===== 存档 =====
  const collectSaveData = useCallback(() => {
    const engine = getEngine();
    if (!engine) return null;
    try {
      const saveData = engine.collectSaveData();
      const canvas = engine.getCanvas();
      let screenshot: string | undefined;
      if (canvas) {
        try { screenshot = canvas.toDataURL("image/jpeg", 0.6); } catch { /* ignore */ }
      }
      return {
        data: saveData as unknown as Record<string, unknown>,
        screenshot,
        mapName: saveData.state?.map ?? "",
        level: saveData.player?.level ?? 1,
        playerName: saveData.player?.name ?? "",
      };
    } catch (error) {
      logger.error("[GamePlaying] Failed to collect save data:", error);
      return null;
    }
  }, [getEngine]);

  const loadSaveData = useCallback(async (data: Record<string, unknown>): Promise<boolean> => {
    const engine = getEngine();
    if (!engine) return false;
    try {
      await engine.loadGameFromJSON(data as unknown as SaveData);
      return true;
    } catch (error) {
      logger.error("[GamePlaying] Failed to load save data:", error);
      return false;
    }
  }, [getEngine]);

  // ===== 截图 =====
  const takeScreenshot = useCallback(() => {
    const engine = getEngine();
    if (!engine) return;
    const canvas = engine.getCanvas();
    if (!canvas) { logger.warn("No canvas available for screenshot"); return; }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `jxqy_screenshot_${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      logger.log("[GamePlaying] Screenshot saved");
    } catch (error) {
      logger.error("[GamePlaying] Screenshot failed:", error);
    }
  }, [getEngine]);

  // ===== 音频控制 =====
  const getMusicVolume = useCallback(() => getEngine()?.getAudioManager()?.getMusicVolume() ?? 0.7, [getEngine]);
  const setMusicVolume = useCallback((v: number) => getEngine()?.getAudioManager()?.setMusicVolume(v), [getEngine]);
  const getSoundVolume = useCallback(() => getEngine()?.getAudioManager()?.getSoundVolume() ?? 1.0, [getEngine]);
  const setSoundVolume = useCallback((v: number) => getEngine()?.getAudioManager()?.setSoundVolume(v), [getEngine]);
  const getAmbientVolume = useCallback(() => getEngine()?.getAudioManager()?.getAmbientVolume() ?? 1.0, [getEngine]);
  const setAmbientVolume = useCallback((v: number) => getEngine()?.getAudioManager()?.setAmbientVolume(v), [getEngine]);
  const isAutoplayAllowed = useCallback(() => getEngine()?.getAudioManager()?.isAutoplayAllowed() ?? false, [getEngine]);
  const requestAutoplayPermission = useCallback(async () => {
    const audioManager = getEngine()?.getAudioManager();
    if (audioManager) return await audioManager.requestAutoplayPermission();
    return false;
  }, [getEngine]);

  // ===== 调试数据 =====
  const debugManager = getDebugManager();

  // ===== 存档按钮 =====
  const handleSaveClick = useCallback(() => {
    if (!isAuthenticated) {
      onLoginRequest();
    } else {
      setMenuTab("save");
      setActivePanel("menu");
    }
  }, [isAuthenticated, onLoginRequest]);

  // ===== 顶栏工具按钮 → 推送给 GameScreen =====
  const toolbarButtons: ToolbarButton[] = useMemo(() => [
    {
      id: "debug",
      icon: <span className="text-base">🔧</span>,
      tooltip: "调试",
      onClick: toggleDebug,
      active: showDebug,
    },
    {
      id: "saveload",
      icon: <span className="text-base">💾</span>,
      tooltip: "存档",
      onClick: handleSaveClick,
      active: activePanel === "menu" && menuTab === "save",
    },
    {
      id: "settings",
      icon: <span className="text-base">⚙️</span>,
      tooltip: "设置",
      onClick: () => {
        setMenuTab("settings");
        setActivePanel(activePanel === "menu" && menuTab === "settings" ? "none" : "menu");
      },
      active: activePanel === "menu" && menuTab === "settings",
    },
    {
      id: "screenshot",
      icon: <span className="text-base">📷</span>,
      tooltip: "截图",
      onClick: takeScreenshot,
    },
    {
      id: "github",
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      ),
      tooltip: "GitHub",
      onClick: () => window.open("https://github.com/luckyyyyy/miu2d", "_blank"),
    },
  ], [activePanel, showDebug, menuTab, handleSaveClick, takeScreenshot, toggleDebug]);

  // 推送 toolbar 按钮给父组件
  useEffect(() => {
    onToolbarButtons(toolbarButtons);
  }, [toolbarButtons, onToolbarButtons]);

  // 卸载时清空 toolbar
  useEffect(() => {
    return () => onToolbarButtons([]);
  }, [onToolbarButtons]);

  return (
    <>
      {/* Game Area + Docked Debug Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* 调试面板 - 左侧固定 */}
        <DockedPanel
          panelId="debug"
          visible={showDebug}
          onClose={() => setShowDebug(false)}
          title="调试面板"
          defaultWidth={420}
        >
          <DebugPanel
            isGodMode={debugManager?.isGodMode() ?? false}
            playerStats={debugManager?.getPlayerStats() ?? undefined}
            playerPosition={debugManager?.getPlayerPosition() ?? undefined}
            loadedResources={debugManager?.getLoadedResources() ?? undefined}
            resourceStats={resourceLoader.getStats()}
            performanceStats={getEngine()?.getPerformanceStats()}
            gameVariables={debugManager?.getGameVariables()}
            xiuLianMagic={debugManager?.getXiuLianMagic() ?? undefined}
            triggeredTrapIds={debugManager?.getTriggeredTrapIds()}
            currentScriptInfo={debugManager?.getCurrentScriptInfo() ?? undefined}
            scriptHistory={debugManager?.getScriptHistory()}
            onSetGameVariable={(name, value) => debugManager?.setGameVariable(name, value)}
            onFullAll={() => debugManager?.fullAll()}
            onSetLevel={(level) => debugManager?.setLevel(level)}
            onAddMoney={(amount) => debugManager?.addMoney(amount)}
            onToggleGodMode={() => debugManager?.toggleGodMode()}
            onReduceLife={() => debugManager?.reduceLife()}
            onKillAllEnemies={() => debugManager?.killAllEnemies()}
            onExecuteScript={async (script) => {
              const dm = getDebugManager();
              if (!dm) return "DebugManager not initialized";
              return await dm.executeScript(script);
            }}
            onAddItem={async (itemFile) => { await getDebugManager()?.addItem(itemFile); }}
            onAddMagic={async (magicFile) => { await getDebugManager()?.addMagic(magicFile); }}
            onAddAllMagics={async () => { await getDebugManager()?.addAllMagics(); }}
            onXiuLianLevelUp={() => getDebugManager()?.xiuLianLevelUp()}
            onXiuLianLevelDown={() => getDebugManager()?.xiuLianLevelDown()}
            onReloadMagicConfig={async () => { if (gameSlug) await reloadGameData(gameSlug); }}
          />
        </DockedPanel>

        {/* 游戏区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={gameAreaRef}
            className={`flex-1 flex items-center justify-center relative bg-black ${isMobile ? "overflow-hidden" : ""}`}
          >
            {/* 游戏光标 */}
            {!isMobile && <GameCursor enabled={true} containerRef={gameAreaRef} />}

            {/* 移动端缩放 */}
            <div
              style={
                isMobile
                  ? {
                      transform: `scale(${windowSize.scale})`,
                      transformOrigin: "center center",
                      width: windowSize.width,
                      height: windowSize.height,
                    }
                  : undefined
              }
            >
              {isDataReady ? (
                <Game
                  ref={gameRef}
                  width={windowSize.width}
                  height={windowSize.height}
                  initialSaveData={initialSaveData}
                  onReturnToTitle={handleReturnToTitle}
                  uiTheme={uiTheme}
                  onOpenMenu={handleOpenMenu}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-400">
                  加载游戏数据...
                </div>
              )}
            </div>

            {/* 移动端控制层 */}
            {isMobile && (
              <MobileControls
                engine={getEngine() ?? null}
                canvasSize={{ width: windowSize.width, height: windowSize.height }}
                scale={windowSize.scale}
                onOpenMenu={() => handleReturnToTitle()}
              />
            )}

            {/* 触摸拖拽指示器 */}
            {isMobile && <TouchDragIndicator />}

            {/* 视频播放器 - 放在 game area 层级，自适应可见区域 */}
            {getEngine() && <VideoPlayer engine={getEngine()!} />}
          </div>
        </div>
      </div>

      {/* 游戏菜单面板（存档 + 设置） */}
      <GameMenuPanel
        visible={activePanel === "menu"}
        onClose={() => setActivePanel("none")}
        activeTab={menuTab}
        onTabChange={setMenuTab}
        gameSlug={gameSlug}
        canSave={true}
        onCollectSaveData={collectSaveData}
        onLoadSaveData={loadSaveData}
        settingsProps={{
          getMusicVolume,
          setMusicVolume,
          getSoundVolume,
          setSoundVolume,
          getAmbientVolume,
          setAmbientVolume,
          isAutoplayAllowed,
          requestAutoplayPermission,
          currentResolution: gameResolution,
          setResolution,
          currentTheme: uiTheme,
          setTheme: setUITheme,
        }}
      />
    </>
  );
}
