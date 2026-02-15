/**
 * SidePanel - 侧边面板组件
 *
 * 用于从左侧菜单栏展开的面板，包含：
 * - 设置面板
 *
 * 设计：类似 VS Code 侧边栏风格
 */

import { LOG_LEVELS, type LogLevel, logger } from "@miu2d/engine/core/logger";
import { useEffect, useState } from "react";
import type { UITheme } from "../ui";

// ============= LocalStorage 键名 =============
const STORAGE_KEY_MUSIC_VOLUME = "jxqy_music_volume";
const STORAGE_KEY_SOUND_VOLUME = "jxqy_sound_volume";
const STORAGE_KEY_AMBIENT_VOLUME = "jxqy_ambient_volume";
const STORAGE_KEY_VIDEO_VOLUME = "jxqy_video_volume";
const STORAGE_KEY_UI_THEME = "jxqy_ui_theme";

// ============= 音频设置工具函数 =============

export function loadAudioSettings(): {
  musicVolume: number;
  soundVolume: number;
  ambientVolume: number;
  videoVolume: number;
} {
  const musicVolume = localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME);
  const soundVolume = localStorage.getItem(STORAGE_KEY_SOUND_VOLUME);
  const ambientVolume = localStorage.getItem(STORAGE_KEY_AMBIENT_VOLUME);
  const videoVolume = localStorage.getItem(STORAGE_KEY_VIDEO_VOLUME);

  return {
    musicVolume: musicVolume ? parseFloat(musicVolume) : 0.7,
    soundVolume: soundVolume ? parseFloat(soundVolume) : 1.0,
    ambientVolume: ambientVolume ? parseFloat(ambientVolume) : 1.0,
    videoVolume: videoVolume ? parseFloat(videoVolume) : 0, // 默认静音
  };
}

export function saveAudioSettings(settings: {
  musicVolume?: number;
  soundVolume?: number;
  ambientVolume?: number;
  videoVolume?: number;
}): void {
  if (settings.musicVolume !== undefined) {
    localStorage.setItem(STORAGE_KEY_MUSIC_VOLUME, String(settings.musicVolume));
  }
  if (settings.soundVolume !== undefined) {
    localStorage.setItem(STORAGE_KEY_SOUND_VOLUME, String(settings.soundVolume));
  }
  if (settings.ambientVolume !== undefined) {
    localStorage.setItem(STORAGE_KEY_AMBIENT_VOLUME, String(settings.ambientVolume));
  }
  if (settings.videoVolume !== undefined) {
    localStorage.setItem(STORAGE_KEY_VIDEO_VOLUME, String(settings.videoVolume));
  }
}

// ============= UI 主题工具函数 =============

export function loadUITheme(): UITheme {
  const theme = localStorage.getItem(STORAGE_KEY_UI_THEME);
  return theme === "modern" || theme === "classic" ? theme : "classic";
}

export function saveUITheme(theme: UITheme): void {
  localStorage.setItem(STORAGE_KEY_UI_THEME, theme);
}

// ============= 类型定义 =============

export interface SettingsPanelProps {
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
  // UI 主题切换
  currentTheme?: UITheme;
  setTheme?: (theme: UITheme) => void;
  onClose?: () => void;
}

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

// ============= 面板头部组件 =============

function PanelHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
      <h2 className="text-sm font-medium text-gray-200">{title}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ============= 设置面板 =============

export function SettingsPanel({
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
  currentTheme,
  setTheme,
  onClose,
}: SettingsPanelProps) {
  // 本地状态
  const [musicVolume, setMusicVolumeLocal] = useState(0.7);
  const [soundVolume, setSoundVolumeLocal] = useState(1.0);
  const [ambientVolume, setAmbientVolumeLocal] = useState(1.0);
  const [autoplayAllowed, setAutoplayAllowed] = useState(false);
  const [logLevel, setLogLevel] = useState<LogLevel>(logger.getMinLevel());
  const [uiTheme, setUIThemeLocal] = useState<UITheme>(currentTheme ?? loadUITheme());

  // 日志级别切换
  const handleLogLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const level = e.target.value as LogLevel;
    setLogLevel(level);
    logger.setMinLevel(level);
  };

  // 分辨率切换
  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [w, h] = e.target.value.split("x").map(Number);
    if (setResolution) {
      // 0x0 表示自适应模式
      setResolution(w, h);
    }
  };

  // 0x0 表示自适应
  const currentResValue = currentResolution
    ? `${currentResolution.width}x${currentResolution.height}`
    : "0x0";

  // 初始化
  useEffect(() => {
    // 从 localStorage 加载
    const saved = loadAudioSettings();
    setMusicVolumeLocal(saved.musicVolume);
    setSoundVolumeLocal(saved.soundVolume);
    setAmbientVolumeLocal(saved.ambientVolume);

    // 从引擎获取实际值
    if (getMusicVolume) setMusicVolumeLocal(getMusicVolume());
    if (getSoundVolume) setSoundVolumeLocal(getSoundVolume());
    if (getAmbientVolume) setAmbientVolumeLocal(getAmbientVolume());
    if (isAutoplayAllowed) setAutoplayAllowed(isAutoplayAllowed());
  }, [getMusicVolume, getSoundVolume, getAmbientVolume, isAutoplayAllowed]);

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

  // UI 主题切换
  const handleThemeChange = (theme: UITheme) => {
    setUIThemeLocal(theme);
    setTheme?.(theme);
    saveUITheme(theme);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 音频设置 */}
        <div>
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">音频</h3>

          {/* 自动播放权限 */}
          {!autoplayAllowed && (
            <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="text-xs text-yellow-200/80 mb-2">
                由于浏览器安全策略，需要先与页面交互才能播放音频
              </div>
              <button
                onClick={handleRequestAutoplay}
                className="w-full px-2 py-1 text-xs bg-yellow-500/20 text-yellow-200 rounded-lg hover:bg-yellow-500/30 transition-colors border border-yellow-500/20"
              >
                点击启用音频
              </button>
            </div>
          )}

          {/* 音乐音量 */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">🎵 音乐音量</span>
              <span className="text-xs text-white/30">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={handleMusicVolumeChange}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* 音效音量 */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">🔈 音效音量</span>
              <span className="text-xs text-white/30">{Math.round(soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundVolume}
              onChange={handleSoundVolumeChange}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* 环境音音量 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">🌲 环境音音量</span>
              <span className="text-xs text-white/30">{Math.round(ambientVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ambientVolume}
              onChange={handleAmbientVolumeChange}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* 显示设置 */}
        <div>
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">显示</h3>

          {/* UI 主题切换 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">🎨 界面风格</span>
              <span className="text-xs text-white/30">
                {uiTheme === "classic" ? "经典" : "现代"}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleThemeChange("classic")}
                className={`flex-1 px-2 py-2 text-xs rounded-lg border transition-all ${
                  uiTheme === "classic"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                    : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                <div className="text-lg mb-1">🏯</div>
                <div>经典风格</div>
              </button>
              <button
                onClick={() => handleThemeChange("modern")}
                className={`flex-1 px-2 py-2 text-xs rounded-lg border transition-all ${
                  uiTheme === "modern"
                    ? "bg-blue-500/15 border-blue-500/40 text-blue-200"
                    : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                <div className="text-lg mb-1">✨</div>
                <div>现代风格</div>
              </button>
            </div>
            <div className="text-xs text-white/25 mt-1">
              {uiTheme === "classic"
                ? "复古像素风，还原经典游戏体验"
                : "毛玻璃效果，清新简洁的视觉设计"}
            </div>
          </div>

          {/* 分辨率选择 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">🖥️ 分辨率</span>
              <span className="text-xs text-white/30">
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
              className="w-full px-2 py-1.5 text-xs bg-white/5 text-white/80 border border-white/10 rounded-lg cursor-pointer
                hover:border-white/20 focus:border-blue-400/50 focus:outline-none transition-colors [&>option]:text-black [&>option]:bg-white"
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
            <div className="text-xs text-white/25 mt-1">调整游戏画面大小</div>
          </div>
        </div>

        {/* 开发者设置 */}
        <div>
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            开发者
          </h3>

          {/* 日志级别选择 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">📋 日志级别</span>
              <span className="text-xs text-white/30">{logLevel.toUpperCase()}</span>
            </div>
            <select
              value={logLevel}
              onChange={handleLogLevelChange}
              className="w-full px-2 py-1.5 text-xs bg-white/5 text-white/80 border border-white/10 rounded-lg cursor-pointer
                hover:border-white/20 focus:border-blue-400/50 focus:outline-none transition-colors [&>option]:text-black [&>option]:bg-white"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.toUpperCase()} -{" "}
                  {level === "debug"
                    ? "显示所有日志"
                    : level === "info"
                      ? "隐藏调试日志"
                      : level === "warn"
                        ? "仅警告和错误"
                        : "仅错误"}
                </option>
              ))}
            </select>
            <div className="text-xs text-white/25 mt-1">控制控制台日志输出级别</div>
          </div>
        </div>
      </div>
    </div>
  );
}
