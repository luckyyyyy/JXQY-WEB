/**
 * TitleSettingsModal - 标题界面设置弹窗
 *
 * 带分类的配置界面，左边菜单右边配置
 * 用于 TitleScreen (/) 的设置弹窗
 */

import { useEffect, useState } from "react";
import {
  AVAILABLE_GAMES,
  type GameId,
  getSelectedGameId,
  switchGame,
} from "@/config/resourcePaths";
import { loadAudioSettings, saveAudioSettings } from "./SidePanel";

// ============= 类型定义 =============

export interface TitleSettingsModalProps {
  open: boolean;
  onClose: () => void;
  // 音频
  getMusicVolume?: () => number;
  setMusicVolume?: (volume: number) => void;
  getSoundVolume?: () => number;
  setSoundVolume?: (volume: number) => void;
  getAmbientVolume?: () => number;
  setAmbientVolume?: (volume: number) => void;
  isAutoplayAllowed?: () => boolean;
  requestAutoplayPermission?: () => Promise<boolean>;
  // 分辨率设置
  currentResolution?: { width: number; height: number };
  setResolution?: (width: number, height: number) => void;
}

// ============= 分类菜单配置 =============

type SettingsCategory = "game" | "audio" | "display";

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: string;
}

const SETTINGS_CATEGORIES: CategoryItem[] = [
  { id: "game", label: "游戏", icon: "🎮" },
  { id: "audio", label: "音频", icon: "🔊" },
  { id: "display", label: "显示", icon: "🖥️" },
];

// 预设分辨率选项（0x0 表示自适应）
const RESOLUTION_PRESETS = [
  { width: 0, height: 0, label: "自适应" },
  { width: 800, height: 600, label: "800×600 (原版)" },
  { width: 1024, height: 768, label: "1024×768" },
  { width: 1280, height: 720, label: "1280×720 (720p)" },
  { width: 1280, height: 960, label: "1280×960" },
  { width: 1366, height: 768, label: "1366×768" },
  { width: 1600, height: 900, label: "1600×900" },
  { width: 1920, height: 1080, label: "1920×1080 (1080p)" },
];

// ============= 组件 =============

export function TitleSettingsModal({
  open,
  onClose,
  getMusicVolume,
  setMusicVolume,
  getSoundVolume,
  setSoundVolume,
  getAmbientVolume,
  setAmbientVolume,
  isAutoplayAllowed,
  requestAutoplayPermission,
  currentResolution,
  setResolution,
}: TitleSettingsModalProps) {
  // 当前选中的分类
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("game");

  // 音频状态
  const [musicVolume, setMusicVolumeLocal] = useState(0.7);
  const [soundVolume, setSoundVolumeLocal] = useState(1.0);
  const [ambientVolume, setAmbientVolumeLocal] = useState(1.0);
  const [autoplayAllowed, setAutoplayAllowed] = useState(false);

  // 游戏选择
  const [selectedGameId, setSelectedGameIdLocal] = useState<string>(getSelectedGameId());

  // 初始化
  useEffect(() => {
    if (!open) return;

    // 从 localStorage 加载音频设置
    const saved = loadAudioSettings();
    setMusicVolumeLocal(saved.musicVolume);
    setSoundVolumeLocal(saved.soundVolume);
    setAmbientVolumeLocal(saved.ambientVolume);

    // 从引擎获取实际值
    if (getMusicVolume) setMusicVolumeLocal(getMusicVolume());
    if (getSoundVolume) setSoundVolumeLocal(getSoundVolume());
    if (getAmbientVolume) setAmbientVolumeLocal(getAmbientVolume());
    if (isAutoplayAllowed) setAutoplayAllowed(isAutoplayAllowed());

    // 获取当前选择的游戏
    setSelectedGameIdLocal(getSelectedGameId());
  }, [open, getMusicVolume, getSoundVolume, getAmbientVolume, isAutoplayAllowed]);

  if (!open) return null;

  // 分辨率切换
  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [w, h] = e.target.value.split("x").map(Number);
    if (setResolution) {
      setResolution(w, h);
    }
  };

  const currentResValue = currentResolution
    ? `${currentResolution.width}x${currentResolution.height}`
    : "0x0";

  // 音乐音量
  const handleMusicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setMusicVolumeLocal(value);
    setMusicVolume?.(value);
    saveAudioSettings({ musicVolume: value });
  };

  // 音效音量
  const handleSoundVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSoundVolumeLocal(value);
    setSoundVolume?.(value);
    saveAudioSettings({ soundVolume: value });
  };

  // 环境音音量
  const handleAmbientVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setAmbientVolumeLocal(value);
    setAmbientVolume?.(value);
    saveAudioSettings({ ambientVolume: value });
  };

  // 请求自动播放权限
  const handleRequestAutoplay = async () => {
    if (requestAutoplayPermission) {
      const allowed = await requestAutoplayPermission();
      setAutoplayAllowed(allowed);
    }
  };

  // 切换游戏
  const handleGameChange = (gameId: string) => {
    if (gameId !== selectedGameId) {
      setSelectedGameIdLocal(gameId);
      if (switchGame(gameId as GameId)) {
        // 需要刷新页面来应用新的游戏资源
        window.location.reload();
      }
    }
  };

  // 渲染游戏设置
  const renderGameSettings = () => (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        选择游戏
      </h3>
      <div className="space-y-2">
        {AVAILABLE_GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => handleGameChange(game.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
              ${
                selectedGameId === game.id
                  ? "bg-blue-900/40 border-blue-500/50 text-white"
                  : "bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-600/70"
              }`}
          >
            <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center overflow-hidden">
              <img
                src={game.icon}
                alt={game.name}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{game.name}</div>
              <div className="text-xs text-gray-500">{game.resourceRoot}</div>
            </div>
            {selectedGameId === game.id && <span className="text-blue-400 text-lg">✓</span>}
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-600 mt-2">切换游戏后页面将自动刷新</div>
    </div>
  );

  // 渲染音频设置
  const renderAudioSettings = () => (
    <div className="space-y-4">
      {/* 自动播放权限 */}
      {!autoplayAllowed && (
        <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded">
          <div className="text-xs text-yellow-200 mb-2">
            由于浏览器安全策略，需要先与页面交互才能播放音频
          </div>
          <button
            onClick={handleRequestAutoplay}
            className="w-full px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-500 transition-colors cursor-pointer"
          >
            点击启用音频
          </button>
        </div>
      )}

      {/* 音乐音量 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">🎵 音乐音量</span>
          <span className="text-xs text-gray-500">{Math.round(musicVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={musicVolume}
          onChange={handleMusicVolumeChange}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* 音效音量 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">🔈 音效音量</span>
          <span className="text-xs text-gray-500">{Math.round(soundVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={soundVolume}
          onChange={handleSoundVolumeChange}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* 环境音音量 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">🌲 环境音音量</span>
          <span className="text-xs text-gray-500">{Math.round(ambientVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={ambientVolume}
          onChange={handleAmbientVolumeChange}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );

  // 渲染显示设置
  const renderDisplaySettings = () => (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">分辨率</span>
          <span className="text-xs text-gray-500">
            {currentResolution
              ? currentResolution.width === 0
                ? "自适应"
                : `${currentResolution.width}×${currentResolution.height}`
              : "自适应"}
          </span>
        </div>
        <select
          value={currentResValue}
          onChange={handleResolutionChange}
          className="w-full px-2 py-1.5 text-xs bg-gray-800 text-gray-200 border border-gray-700 rounded cursor-pointer
            hover:border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
        >
          {RESOLUTION_PRESETS.map((preset) => (
            <option
              key={`${preset.width}x${preset.height}`}
              value={`${preset.width}x${preset.height}`}
            >
              {preset.label}
            </option>
          ))}
        </select>
        <div className="text-xs text-gray-600 mt-1">调整游戏画面大小</div>
      </div>
    </div>
  );

  // 根据分类渲染内容
  const renderContent = () => {
    switch (activeCategory) {
      case "game":
        return renderGameSettings();
      case "audio":
        return renderAudioSettings();
      case "display":
        return renderDisplaySettings();
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/70 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0d1a] rounded-lg shadow-xl border border-gray-700 w-[480px] h-[400px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
          <h2 className="text-sm font-medium text-gray-200">设置</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 内容区：左右分栏 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧菜单 */}
          <div className="w-24 bg-gray-900/50 border-r border-gray-700/50 flex flex-col">
            {SETTINGS_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex flex-col items-center justify-center py-4 px-2 transition-all cursor-pointer
                  ${
                    activeCategory === category.id
                      ? "bg-blue-900/40 text-blue-300 border-l-2 border-blue-500"
                      : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border-l-2 border-transparent"
                  }`}
              >
                <span className="text-xl mb-1">{category.icon}</span>
                <span className="text-xs">{category.label}</span>
              </button>
            ))}
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
