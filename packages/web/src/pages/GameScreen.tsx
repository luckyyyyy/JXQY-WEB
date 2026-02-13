/**
 * GameScreen - 游戏页面入口
 *
 * 职责：
 * - 路由参数解析（gameSlug、shareCode、loadSave、embed）
 * - 游戏配置/数据加载与验证
 * - 资源路径设置
 * - 管理 gamePhase 状态（loading → title → playing）
 * - 渲染 loading/error/title/playing 四种状态
 *
 * 不包含任何引擎相关逻辑（引擎完全封装在 GamePlaying 中）。
 * Title 页不依赖引擎，引擎仅在 playing 阶段存在。
 */

import { logger } from "@miu2d/engine/core/logger";
import { setResourcePaths } from "@miu2d/engine/resource";
import { loadGameData, loadGameConfig, getGameConfig } from "@miu2d/engine/resource";
import { setLevelConfigGameSlug, initNpcLevelConfig } from "@miu2d/engine/character/level";
import type { SaveData } from "@miu2d/engine/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  AuthModal,
  GameMenuPanel,
  GameTopBar,
  TitleGui,
  loadUITheme,
} from "../components";
import type { ToolbarButton } from "../components";
import type { MenuTab } from "../components/game/GameMenuPanel";
import type { UITheme } from "../components/game/ui";
import { TouchDragProvider } from "../contexts";
import { useMobile } from "../hooks";
import { trpc } from "../lib/trpc";
import { GamePlaying } from "./GamePlaying";

// 布局常量
const TOP_BAR_HEIGHT = 40;
const RESOLUTION_STORAGE_KEY = "jxqy_resolution";

// 默认分辨率（0x0 表示自适应）
const DEFAULT_RESOLUTION = { width: 0, height: 0 };

// 从 localStorage 读取分辨率
const getStoredResolution = (): { width: number; height: number } => {
  try {
    const stored = localStorage.getItem(RESOLUTION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.width && parsed.height) {
        return { width: parsed.width, height: parsed.height };
      }
    }
  } catch (e) {
    logger.warn("Failed to read resolution from localStorage:", e);
  }
  return DEFAULT_RESOLUTION;
};

// 保存分辨率到 localStorage
const saveResolution = (width: number, height: number) => {
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, JSON.stringify({ width, height }));
  } catch (e) {
    logger.warn("Failed to save resolution to localStorage:", e);
  }
};

// 游戏阶段：loading = 验证中，error = 游戏不存在，title = 标题界面，playing = 游戏中
type GamePhase = "loading" | "error" | "title" | "playing";

// 移动端画面缩放比例
const MOBILE_SCALE = 0.75;

export default function GameScreen() {
  // ===== URL 参数 =====
  const { gameSlug, shareCode } = useParams<{ gameSlug: string; shareCode?: string }>();
  const searchParams = useSearchParams()[0];
  const loadSaveId = searchParams.get("loadSave");
  const isEmbed = searchParams.get("embed") === "1";

  // ===== 全局状态 =====
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const [gameError, setGameError] = useState("");
  const [isDataReady, setIsDataReady] = useState(false);
  const [gameName, setGameName] = useState("");
  const [gameLogoUrl, setGameLogoUrl] = useState("");
  const [titleMusic, setTitleMusic] = useState("");
  const [initialSaveData, setInitialSaveData] = useState<SaveData | undefined>(undefined);

  // UI 主题
  const [uiTheme, setUITheme] = useState<UITheme>(loadUITheme);

  // 分辨率
  const [gameResolution, setGameResolution] = useState(getStoredResolution);

  // 登录弹窗
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 分享存档通知（2秒后自动消失）
  const [shareNotification, setShareNotification] = useState<{
    userName: string;
    saveName: string;
    mapName?: string | null;
    level?: number | null;
  } | null>(null);

  // title 阶段的菜单面板（读档用）
  const [titleMenuVisible, setTitleMenuVisible] = useState(false);
  const [titleMenuTab, setTitleMenuTab] = useState<MenuTab>("save");

  // GamePlaying 推送的 toolbar 按钮
  const [toolbarButtons, setToolbarButtons] = useState<ToolbarButton[]>([]);

  // 移动端检测
  const { isMobile, isLandscape, screenWidth, screenHeight } = useMobile();

  const utils = trpc.useUtils();

  // ===== 全局资源路径设置 =====
  useEffect(() => {
    if (gameSlug) {
      setResourcePaths({ root: `/game/${gameSlug}/resources` });
      setLevelConfigGameSlug(gameSlug);
      logger.info(`[GameScreen] Resource root set to /game/${gameSlug}/resources`);
    }
  }, [gameSlug]);

  // ===== 标题界面背景音乐 =====
  const titleAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (gamePhase === "title" && titleMusic && gameSlug) {
      const audio = new Audio(`/game/${gameSlug}/resources/content/music/${titleMusic}`);
      audio.loop = true;
      audio.volume = 0.7;
      titleAudioRef.current = audio;
      // 用户交互后才能自动播放，静默处理 NotAllowedError
      audio.play().catch(() => {
        // 等待用户首次点击后播放
        const handleInteraction = () => {
          audio.play().catch(() => {});
          document.removeEventListener("click", handleInteraction);
          document.removeEventListener("keydown", handleInteraction);
        };
        document.addEventListener("click", handleInteraction, { once: true });
        document.addEventListener("keydown", handleInteraction, { once: true });
      });
      logger.info(`[GameScreen] Title music: ${titleMusic}`);
      return () => {
        audio.pause();
        audio.src = "";
        titleAudioRef.current = null;
      };
    }
    // 非 title 阶段确保停止
    if (titleAudioRef.current) {
      titleAudioRef.current.pause();
      titleAudioRef.current.src = "";
      titleAudioRef.current = null;
    }
  }, [gamePhase, titleMusic, gameSlug]);

  // ===== 加载游戏配置和数据 =====
  useEffect(() => {
    if (!gameSlug) {
      setGamePhase("error");
      setGameError("缺少游戏标识");
      return;
    }

    let cancelled = false;
    setGamePhase("loading");
    setIsDataReady(false);

    (async () => {
      try {
        // 1. 加载游戏配置（/api/config）—— 404 表示游戏不存在
        await loadGameConfig(gameSlug, true);
        if (cancelled) return;

        // 从 config 更新游戏名和 logo
        const config = getGameConfig();
        if (config?.gameName) {
          setGameName(config.gameName);
          document.title = config.gameName;
        }
        if (config?.logoUrl) {
          setGameLogoUrl(config.logoUrl);
          const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
            || document.createElement("link");
          link.rel = "icon";
          link.href = config.logoUrl;
          if (!link.parentNode) document.head.appendChild(link);
        }
        if (config?.titleMusic) {
          setTitleMusic(config.titleMusic);
        }

        // 2. 并行加载游戏数据 + NPC 等级配置
        await Promise.all([
          loadGameData(gameSlug),
          initNpcLevelConfig().catch((error) => {
            logger.warn(`[GameScreen] Failed to load NPC level config:`, error);
          }),
        ]);
        if (cancelled) return;

        setIsDataReady(true);
        // 有 loadSave/shareCode 参数时跳过 title，保持 loading 等待存档加载
        if (!loadSaveId && !shareCode) {
          setGamePhase("title");
        }
        logger.info(`[GameScreen] Game config and data loaded for ${gameSlug}`);
      } catch (error) {
        if (cancelled) return;
        logger.error(`[GameScreen] Failed to load game:`, error);
        setGamePhase("error");
        setGameError(`游戏 "${gameSlug}" 不存在或未开放`);
      }
    })();

    return () => { cancelled = true; };
  }, [gameSlug, loadSaveId, shareCode]);

  // ===== 通过 URL ?loadSave=<saveId> 自动读档 =====
  const loadSaveTriggeredRef = useRef(false);
  useEffect(() => {
    if (!loadSaveId || !isDataReady || !gameSlug || loadSaveTriggeredRef.current) return;
    loadSaveTriggeredRef.current = true;

    const fetchAndLoad = async () => {
      try {
        logger.info(`[GameScreen] Auto-loading save ${loadSaveId}`);
        const result = await utils.save.adminGet.fetch({ saveId: loadSaveId });
        setInitialSaveData(result.data as unknown as SaveData);
        setGamePhase("playing");
        logger.info(`[GameScreen] Save loaded successfully, starting game`);
      } catch (error) {
        logger.error(`[GameScreen] Auto-load save failed:`, error);
        setGamePhase("title");
      }
    };

    fetchAndLoad();
  }, [loadSaveId, isDataReady, gameSlug, utils.save.adminGet]);

  // ===== 通过 URL shareCode 自动加载分享存档（与 loadSave 逻辑一致） =====
  const shareTriggeredRef = useRef(false);
  useEffect(() => {
    if (!shareCode || !isDataReady || !gameSlug || shareTriggeredRef.current) return;
    shareTriggeredRef.current = true;

    const fetchAndLoad = async () => {
      try {
        logger.info(`[GameScreen] Loading shared save: ${shareCode}`);
        const result = await utils.save.getShared.fetch({ gameSlug, shareCode });
        const data = result.data as unknown as SaveData;
        setInitialSaveData(data);
        setShareNotification({
          userName: result.userName ?? "未知用户",
          saveName: result.name,
          mapName: result.mapName,
          level: result.level,
        });
        setGamePhase("playing");
        logger.info(`[GameScreen] Shared save loaded, starting game`);
      } catch (error) {
        logger.error(`[GameScreen] Failed to load shared save:`, error);
        setShareNotification(null);
        setGamePhase("title");
      }
    };

    fetchAndLoad();
  }, [shareCode, isDataReady, gameSlug, utils.save.getShared]);

  // ===== 窗口尺寸计算 =====
  const calculateWindowSize = useCallback(
    (resolution: { width: number; height: number }) => {
      if (isMobile) {
        const scale = MOBILE_SCALE;
        return {
          width: Math.floor(screenWidth / scale),
          height: Math.floor(screenHeight / scale),
          scale,
        };
      }
      const topBarOffset = isEmbed ? 0 : TOP_BAR_HEIGHT;
      const maxWidth = window.innerWidth;
      const maxHeight = window.innerHeight - topBarOffset;
      if (resolution.width === 0 || resolution.height === 0) {
        return { width: maxWidth, height: maxHeight, scale: 1 };
      }
      return {
        width: Math.min(maxWidth, resolution.width),
        height: Math.min(maxHeight, resolution.height),
        scale: 1,
      };
    },
    [isMobile, isEmbed, screenWidth, screenHeight]
  );

  const [windowSize, setWindowSize] = useState(() => calculateWindowSize(gameResolution));

  useEffect(() => {
    const updateSize = () => setWindowSize(calculateWindowSize(gameResolution));
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, [gameResolution, calculateWindowSize]);

  const handleSetResolution = useCallback(
    (width: number, height: number) => {
      const newResolution = { width, height };
      setGameResolution(newResolution);
      saveResolution(width, height);
      setWindowSize(calculateWindowSize(newResolution));
      if (width === 0 || height === 0) {
        logger.log("[分辨率] 切换至 自适应");
      } else {
        logger.log(`[分辨率] 切换至 ${width}×${height}`);
      }
    },
    [calculateWindowSize]
  );

  // ===== Title 界面回调 =====
  const handleNewGame = useCallback(() => {
    logger.log("[GameScreen] Starting new game...");
    setGamePhase("playing");
  }, []);

  const handleLoadGame = useCallback(() => {
    setTitleMenuTab("save");
    setTitleMenuVisible(true);
  }, []);

  // ===== 从 playing 返回 title =====
  const handleReturnToTitle = useCallback(() => {
    setGamePhase("title");
    setInitialSaveData(undefined);
    setToolbarButtons([]);
    logger.log("[GameScreen] Returned to title");
  }, []);

  // ===== 接收 GamePlaying 推送的 toolbar 按钮 =====
  const handleToolbarButtons = useCallback((buttons: ToolbarButton[]) => {
    setToolbarButtons(buttons);
  }, []);

  const handleLoginRequest = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  // ===== 顶栏显示 =====
  const showTopBar = !isEmbed && (gamePhase === "title" || gamePhase === "playing");

  return (
    <TouchDragProvider>
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* 移动端竖屏提示 */}
        {isMobile && !isLandscape && (
          <div className="mobile-landscape-hint">
            <span>请将设备横屏游玩</span>
          </div>
        )}

        {/* 顶栏 */}
        {showTopBar && (
          <div className={`flex-shrink-0 z-[1100] ${gamePhase === "title" ? "absolute top-0 left-0 right-0" : "relative"}`}>
            <GameTopBar
              gameName={gameName}
              logoUrl={gameLogoUrl}
              toolbarButtons={gamePhase === "playing" ? toolbarButtons : undefined}
              onLoginClick={() => setShowAuthModal(true)}
            />
          </div>
        )}

        {/* ===== Loading ===== */}
        {gamePhase === "loading" && (
          <div className="w-full flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] animate-pulse" />
              <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px] animate-[pulse_3s_ease-in-out_infinite_0.5s]" />
              <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] animate-[pulse_4s_ease-in-out_infinite_1s]" />
            </div>
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/5" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400/60 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-cyan-400/40 animate-[spin_1.5s_linear_infinite_reverse]" />
              <div className="absolute inset-4 rounded-full border border-transparent border-t-purple-400/30 animate-[spin_2s_linear_infinite]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-400/80 shadow-[0_0_12px_rgba(96,165,250,0.6)] animate-pulse" />
              </div>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="text-white/40 text-sm tracking-[0.3em] uppercase animate-[pulse_2s_ease-in-out_infinite]">
                正在连接
              </div>
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-[bounce_1s_ease-in-out_infinite]" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-[bounce_1s_ease-in-out_infinite_0.15s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-[bounce_1s_ease-in-out_infinite_0.3s]" />
              </div>
            </div>
          </div>
        )}

        {/* ===== Error ===== */}
        {gamePhase === "error" && (
          <div className="w-full flex-1 flex flex-col items-center justify-center bg-black gap-4">
            <div className="text-red-400 text-lg font-semibold">游戏不可用</div>
            <div className="text-white/50 text-sm">{gameError}</div>
            <a
              href="/"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm rounded-lg transition-colors"
            >
              返回首页
            </a>
          </div>
        )}

        {/* ===== Title（不依赖引擎） ===== */}
        {gamePhase === "title" && (
          <div className="w-full flex-1 relative">
            <TitleGui
              gameSlug={gameSlug}
              screenWidth={window.innerWidth}
              screenHeight={window.innerHeight}
              onNewGame={handleNewGame}
              onLoadGame={handleLoadGame}
            />

          </div>
        )}

        {/* ===== Playing（引擎在此组件内，卸载即销毁） ===== */}
        {gamePhase === "playing" && (
          <GamePlaying
            gameSlug={gameSlug!}
            isEmbed={isEmbed}
            isDataReady={isDataReady}
            initialSaveData={initialSaveData}
            uiTheme={uiTheme}
            setUITheme={setUITheme}
            gameResolution={gameResolution}
            setResolution={handleSetResolution}
            windowSize={windowSize}
            isMobile={isMobile}
            onReturnToTitle={handleReturnToTitle}
            onLoginRequest={handleLoginRequest}
            onToolbarButtons={handleToolbarButtons}
          />
        )}

        {/* ===== Title 阶段的存档面板（读档进入游戏） ===== */}
        {gamePhase === "title" && gameSlug && (
          <GameMenuPanel
            visible={titleMenuVisible}
            onClose={() => setTitleMenuVisible(false)}
            activeTab={titleMenuTab}
            onTabChange={setTitleMenuTab}
            gameSlug={gameSlug}
            canSave={false}
            onCollectSaveData={() => null}
            onLoadSaveData={async (data) => {
              setTitleMenuVisible(false);
              setInitialSaveData(data as unknown as SaveData);
              setGamePhase("playing");
              return true;
            }}
            settingsProps={{
              getMusicVolume: () => 0.7,
              setMusicVolume: () => {},
              getSoundVolume: () => 1.0,
              setSoundVolume: () => {},
              getAmbientVolume: () => 1.0,
              setAmbientVolume: () => {},
              isAutoplayAllowed: () => false,
              requestAutoplayPermission: async () => false,
              currentResolution: gameResolution,
              setResolution: handleSetResolution,
              currentTheme: uiTheme,
              setTheme: setUITheme,
            }}
          />
        )}

        {/* 分享存档通知（2秒后自动消失） */}
        {shareNotification && (
          <ShareToast
            notification={shareNotification}
            onDone={() => setShareNotification(null)}
          />
        )}

        {/* 登录弹窗 */}
        <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    </TouchDragProvider>
  );
}

/**
 * ShareToast - 分享存档通知，2秒后自动消失
 */
function ShareToast({
  notification,
  onDone,
}: {
  notification: {
    userName: string;
    saveName: string;
    mapName?: string | null;
    level?: number | null;
  };
  onDone: () => void;
}) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
    const doneTimer = setTimeout(onDone, 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone 稳定性由调用方保证，不应触发重新计时
  }, [onDone]);

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[1300] transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="px-6 py-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl text-center min-w-[280px]">
        <div className="text-white/50 text-xs mb-1">来自玩家的分享</div>
        <div className="text-white text-sm font-semibold">
          {notification.userName} · {notification.saveName}
        </div>
        {(notification.mapName || notification.level != null) && (
          <div className="flex items-center justify-center gap-3 text-white/40 text-xs mt-1">
            {notification.mapName && <span>{notification.mapName}</span>}
            {notification.level != null && <span>Lv.{notification.level}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
