/**
 * Title Screen Page - based on JxqyHD Engine/Gui/TitleGui.cs
 * Main menu with original game graphics from resources
 *
 * Uses TitleGui component for original game UI rendering
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TitleGui, SystemMenuModal, loadAudioSettings, GameCursorContainer } from "../components/ui";
import { StorageManager } from "../engine/game/storage";
import { AudioManager } from "../engine/audio/audioManager";

export default function TitleScreen() {
  const navigate = useNavigate();
  const [showSystemMenu, setShowSystemMenu] = useState(false);

  // 标题界面的音频管理器（用于设置面板）
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
    // 打开系统菜单（仅读档模式）
    setShowSystemMenu(true);
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
    console.log("退出游戏 - Web 版无法退出");
    // 可以选择关闭窗口或显示确认对话框
    if (window.confirm("确定要退出游戏吗？")) {
      window.close();
    }
  };

  // 音频设置回调（使用 useCallback 避免重复渲染）
  const getMusicVolume = useCallback(() => audioManager.getMusicVolume(), [audioManager]);
  const setMusicVolume = useCallback((v: number) => audioManager.setMusicVolume(v), [audioManager]);
  const getSoundVolume = useCallback(() => audioManager.getSoundVolume(), [audioManager]);
  const setSoundVolume = useCallback((v: number) => audioManager.setSoundVolume(v), [audioManager]);
  const getAmbientVolume = useCallback(() => audioManager.getAmbientVolume(), [audioManager]);
  const setAmbientVolume = useCallback((v: number) => audioManager.setAmbientVolume(v), [audioManager]);
  const isAutoplayAllowed = useCallback(() => audioManager.isAutoplayAllowed(), [audioManager]);
  const requestAutoplayPermission = useCallback(() => audioManager.requestAutoplayPermission(), [audioManager]);

  return (
    <GameCursorContainer className="w-full h-full relative bg-black">
      <TitleGui
        onNewGame={handleBegin}
        onLoadGame={handleLoad}
        onTeam={handleTeam}
        onExit={handleExit}
      />

      {/* 系统菜单（仅读档模式） */}
      <SystemMenuModal
        open={showSystemMenu}
        loadOnly={true}
        onClose={() => setShowSystemMenu(false)}
        onLoad={handleLoadGame}
        getMusicVolume={getMusicVolume}
        setMusicVolume={setMusicVolume}
        getSoundVolume={getSoundVolume}
        setSoundVolume={setSoundVolume}
        getAmbientVolume={getAmbientVolume}
        setAmbientVolume={setAmbientVolume}
        isAutoplayAllowed={isAutoplayAllowed}
        requestAutoplayPermission={requestAutoplayPermission}
      />
    </GameCursorContainer>
  );
}
