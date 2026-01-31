/**
 * Title Screen Page - based on JxqyHD Engine/Gui/TitleGui.cs
 * Main menu with original game graphics from resources
 *
 * Uses TitleGui component for original game UI rendering
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GameCursorContainer,
  LoadGameModal,
  loadAudioSettings,
  TitleGui,
  TitleSettingsModal,
} from "../components";
import { AudioManager } from "../engine/audio/audioManager";
import { logger } from "../engine/core/logger";
import { StorageManager } from "../engine/game/storage";

export default function TitleScreen() {
  const navigate = useNavigate();
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 分辨率设置（0x0 表示自适应）
  const RESOLUTION_STORAGE_KEY = "jxqy_resolution";
  const DEFAULT_RESOLUTION = { width: 0, height: 0 };

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

  const [resolution, setResolutionState] = useState(getStoredResolution);

  const handleSetResolution = (width: number, height: number) => {
    setResolutionState({ width, height });
    try {
      localStorage.setItem(RESOLUTION_STORAGE_KEY, JSON.stringify({ width, height }));
    } catch (e) {
      logger.warn("Failed to save resolution to localStorage:", e);
    }
    if (width === 0 || height === 0) {
      logger.log("[分辨率] 切换至 自适应");
    } else {
      logger.log(`[分辨率] 切换至 ${width}×${height}`);
    }
  };

  // 标题界面的音频管理器（用于播放标题音乐）
  const audioManager = useMemo(() => new AudioManager(), []);

  // 初始化音频设置并播放标题音乐
  // 对应 C# 的 title.txt 脚本: PlayMusic("mc000.mp3")
  useEffect(() => {
    const settings = loadAudioSettings();
    audioManager.setMusicVolume(settings.musicVolume);
    audioManager.setSoundVolume(settings.soundVolume);

    // 播放标题音乐 - "爱的废墟" (mc000.mp3)
    audioManager.playMusic("Mc000.mp3");

    // 组件卸载时停止音乐
    return () => {
      audioManager.stopMusic();
    };
  }, [audioManager]);

  // 处理菜单点击事件
  const handleBegin = () => {
    navigate("/game");
  };

  const handleLoad = () => {
    // 打开读档弹窗
    setShowLoadModal(true);
  };

  const handleLoadGame = async (index: number): Promise<boolean> => {
    // 检查存档是否存在
    if (!StorageManager.canLoad(index)) {
      return false;
    }

    // 导航到游戏页面，带上存档索引
    navigate(`/game?load=${index}`);
    return true;
  };

  const handleTeam = () => {
    // 跳转到地图查看器作为开发工具
    navigate("/viewer");
  };

  const handleExit = () => {
    // Web 版无法真正退出，显示提示或返回
    logger.log("退出游戏 - Web 版无法退出");
    // 可以选择关闭窗口或显示确认对话框
    if (window.confirm("确定要退出游戏吗？")) {
      window.close();
    }
  };

  return (
    <GameCursorContainer className="w-full h-full relative bg-black">
      <TitleGui
        onNewGame={handleBegin}
        onLoadGame={handleLoad}
        onTeam={handleTeam}
        onExit={handleExit}
      />

      {/* 设置齿轮按钮 - 右下角 */}
      <button
        onClick={() => setShowSettings(true)}
        className="fixed bottom-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-all z-50 border border-white/20 hover:border-white/40"
        title="设置"
      >
        ⚙️
      </button>

      {/* 读档弹窗 */}
      <LoadGameModal
        open={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={handleLoadGame}
      />

      {/* 设置弹窗 */}
      <TitleSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        getMusicVolume={() => audioManager.getMusicVolume()}
        setMusicVolume={(v) => audioManager.setMusicVolume(v)}
        getSoundVolume={() => audioManager.getSoundVolume()}
        setSoundVolume={(v) => audioManager.setSoundVolume(v)}
        getAmbientVolume={() => audioManager.getAmbientVolume()}
        setAmbientVolume={(v) => audioManager.setAmbientVolume(v)}
        isAutoplayAllowed={() => audioManager.isAutoplayAllowed()}
        requestAutoplayPermission={() => audioManager.requestAutoplayPermission()}
        currentResolution={resolution}
        setResolution={handleSetResolution}
      />
    </GameCursorContainer>
  );
}
