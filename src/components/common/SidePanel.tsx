/**
 * SidePanel - 侧边面板组件
 *
 * 用于从左侧菜单栏展开的面板，包含：
 * - 存档/读档面板
 * - 设置面板
 *
 * 设计：类似 VS Code 侧边栏风格
 */

import { useCallback, useEffect, useState } from "react";
import { logger, LOG_LEVELS, type LogLevel } from "@/engine/core/logger";
import { type SaveSlotInfo, StorageManager } from "@/engine/game/storage";

// ============= LocalStorage 键名 =============
const STORAGE_KEY_MUSIC_VOLUME = "jxqy_music_volume";
const STORAGE_KEY_SOUND_VOLUME = "jxqy_sound_volume";
const STORAGE_KEY_AMBIENT_VOLUME = "jxqy_ambient_volume";
const STORAGE_KEY_VIDEO_VOLUME = "jxqy_video_volume";

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

// ============= 类型定义 =============

export interface SaveLoadPanelProps {
  onSave?: (index: number) => Promise<boolean>;
  onLoad?: (index: number) => Promise<boolean>;
  onClose?: () => void;
  /** 仅读档模式（隐藏存档和删除按钮） */
  loadOnly?: boolean;
  /** 自定义标题 */
  title?: string;
  /** 是否显示头部 */
  showHeader?: boolean;
}

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

// ============= 存档/读档面板 =============

export function SaveLoadPanel({
  onSave,
  onLoad,
  onClose,
  loadOnly = false,
  title,
  showHeader = true,
}: SaveLoadPanelProps) {
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatingSlot, setOperatingSlot] = useState<number | null>(null);
  // 确认操作状态: { type: 'save' | 'load' | 'delete', index: number }
  const [confirmAction, setConfirmAction] = useState<{
    type: "save" | "load" | "delete";
    index: number;
  } | null>(null);

  // 加载存档列表
  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const slotInfos = StorageManager.getSaveSlots();
      setSlots(slotInfos);
    } catch (error) {
      logger.error("Failed to load save slots:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // 存档
  const handleSave = async (index: number) => {
    if (!onSave) return;
    setOperatingSlot(index);
    setConfirmAction(null);
    try {
      const success = await onSave(index);
      if (success) {
        await loadSlots();
      }
    } finally {
      setOperatingSlot(null);
    }
  };

  // 读档
  const handleLoad = async (index: number) => {
    if (!onLoad) return;
    setOperatingSlot(index);
    setConfirmAction(null);
    try {
      await onLoad(index);
    } finally {
      setOperatingSlot(null);
    }
  };

  // 删除存档
  const handleDelete = async (index: number) => {
    setOperatingSlot(index);
    setConfirmAction(null);
    try {
      StorageManager.deleteGame(index);
      await loadSlots();
    } finally {
      setOperatingSlot(null);
    }
  };

  // 请求确认操作
  const requestConfirm = (type: "save" | "load" | "delete", index: number) => {
    setConfirmAction({ type, index });
  };

  // 执行确认的操作
  const executeConfirmedAction = () => {
    if (!confirmAction) return;
    const { type, index } = confirmAction;
    switch (type) {
      case "save":
        handleSave(index);
        break;
      case "load":
        handleLoad(index);
        break;
      case "delete":
        handleDelete(index);
        break;
    }
  };

  // 获取确认提示文字
  const getConfirmText = () => {
    if (!confirmAction) return { title: "", message: "" };
    const slot = slots.find((s) => s.index === confirmAction.index);
    switch (confirmAction.type) {
      case "save":
        return {
          title: "覆盖存档",
          message: slot?.exists
            ? `确定要覆盖存档 ${confirmAction.index} 吗？`
            : `确定要保存到存档 ${confirmAction.index} 吗？`,
        };
      case "load":
        return {
          title: "读取存档",
          message: `确定要读取存档 ${confirmAction.index} 吗？当前进度将丢失。`,
        };
      case "delete":
        return {
          title: "删除存档",
          message: `确定要删除存档 ${confirmAction.index} 吗？此操作不可恢复。`,
        };
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0d1a]">
      {showHeader && (
        <PanelHeader title={title || (loadOnly ? "读取存档" : "存档 / 读档")} onClose={onClose} />
      )}

      <div
        className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#4a5568 #1a202c",
        }}
      >
        {loading ? (
          <div className="text-center text-gray-400 py-4">加载中...</div>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div
                key={slot.index}
                className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50
                  hover:bg-gray-700/50 hover:border-gray-600/70 transition-all duration-200
                  group"
              >
                {/* 存档头部 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                    存档 {slot.index}
                  </span>
                  {slot.exists && slot.time && (
                    <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                      {slot.time}
                    </span>
                  )}
                </div>

                {/* 截图预览 + 存档信息 */}
                {slot.exists ? (
                  <div className="flex gap-2 mb-2">
                    {/* 截图 */}
                    {slot.screenshot ? (
                      <div
                        className="w-20 h-15 flex-shrink-0 rounded overflow-hidden border border-gray-600/50
                        group-hover:border-gray-500/70 transition-colors"
                      >
                        <img
                          src={slot.screenshot}
                          alt={`存档 ${slot.index} 截图`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-20 h-15 flex-shrink-0 rounded bg-gray-700/50 flex items-center justify-center border border-gray-600/50
                        group-hover:bg-gray-600/50 group-hover:border-gray-500/70 transition-colors"
                      >
                        <span className="text-gray-500 text-xs">无截图</span>
                      </div>
                    )}
                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {slot.mapName || "未知地图"}
                      </div>
                      <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                        Lv.{slot.level || 1}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 mb-2 group-hover:text-gray-400 transition-colors">
                    空存档位
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-1">
                  {operatingSlot === slot.index ? (
                    <div className="flex-1 text-center text-xs text-gray-400 py-1">处理中...</div>
                  ) : confirmAction?.index === slot.index ? (
                    <>
                      <button
                        onClick={executeConfirmedAction}
                        className={`flex-1 px-2 py-1 text-xs text-white rounded transition-colors cursor-pointer
                          ${
                            confirmAction.type === "delete"
                              ? "bg-red-600 hover:bg-red-500 active:bg-red-700"
                              : confirmAction.type === "save"
                                ? "bg-blue-600 hover:bg-blue-500 active:bg-blue-700"
                                : "bg-green-600 hover:bg-green-500 active:bg-green-700"
                          }`}
                      >
                        {confirmAction.type === "delete"
                          ? "确认删除"
                          : confirmAction.type === "save"
                            ? "确认存档"
                            : "确认读档"}
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="flex-1 px-2 py-1 text-xs bg-gray-600 text-white rounded cursor-pointer
                          hover:bg-gray-500 active:bg-gray-700 transition-colors"
                      >
                        取消
                      </button>
                    </>
                  ) : loadOnly ? (
                    /* loadOnly 模式：只显示读档按钮，点击直接读档无需确认 */
                    slot.exists ? (
                      <button
                        onClick={() => handleLoad(slot.index)}
                        className="flex-1 px-2 py-1 text-xs bg-green-800/70 text-green-200 rounded cursor-pointer
                          hover:bg-green-600 hover:text-white active:bg-green-700 hover:shadow-md hover:shadow-green-500/20 transition-all"
                      >
                        读档
                      </button>
                    ) : (
                      <div className="flex-1 text-center text-xs text-gray-500 py-1">空槽位</div>
                    )
                  ) : (
                    /* 完整模式：存档、读档、删除按钮 */
                    <>
                      <button
                        onClick={() =>
                          slot.exists ? requestConfirm("save", slot.index) : handleSave(slot.index)
                        }
                        className={`flex-1 px-2 py-1 text-xs rounded transition-all cursor-pointer
                          ${
                            slot.exists
                              ? "bg-blue-800/70 text-blue-200 hover:bg-blue-600 hover:text-white active:bg-blue-700 hover:shadow-md hover:shadow-blue-500/20"
                              : "bg-blue-900/50 text-blue-400 hover:bg-blue-800/70 hover:text-blue-200 active:bg-blue-900/80 border border-blue-800/50"
                          }`}
                      >
                        存档
                      </button>
                      {slot.exists && (
                        <>
                          <button
                            onClick={() => requestConfirm("load", slot.index)}
                            className="flex-1 px-2 py-1 text-xs bg-green-800/70 text-green-200 rounded cursor-pointer
                              hover:bg-green-600 hover:text-white active:bg-green-700 hover:shadow-md hover:shadow-green-500/20 transition-all"
                          >
                            读档
                          </button>
                          <button
                            onClick={() => requestConfirm("delete", slot.index)}
                            className="px-2 py-1 text-xs bg-gray-700/70 text-gray-300 rounded cursor-pointer
                              hover:bg-red-500 hover:text-white active:bg-red-700 transition-colors"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* 确认提示 */}
                {confirmAction?.index === slot.index && (
                  <div className="mt-2 text-xs text-yellow-400/80 text-center">
                    {getConfirmText().message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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
  onClose,
}: SettingsPanelProps) {
  // 本地状态
  const [musicVolume, setMusicVolumeLocal] = useState(0.7);
  const [soundVolume, setSoundVolumeLocal] = useState(1.0);
  const [ambientVolume, setAmbientVolumeLocal] = useState(1.0);
  const [autoplayAllowed, setAutoplayAllowed] = useState(false);
  const [logLevel, setLogLevel] = useState<LogLevel>(logger.getMinLevel());

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

  return (
    <div className="h-full flex flex-col bg-[#0d0d1a]">
      <PanelHeader title="设置" onClose={onClose} />

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 音频设置 */}
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">音频</h3>

          {/* 自动播放权限 */}
          {!autoplayAllowed && (
            <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded">
              <div className="text-xs text-yellow-200 mb-2">
                由于浏览器安全策略，需要先与页面交互才能播放音频
              </div>
              <button
                onClick={handleRequestAutoplay}
                className="w-full px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-500 transition-colors"
              >
                点击启用音频
              </button>
            </div>
          )}

          {/* 音乐音量 */}
          <div className="mb-3">
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
          <div className="mb-3">
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

        {/* 显示设置 */}
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">显示</h3>

          {/* 分辨率选择 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">🖥️ 分辨率</span>
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

        {/* 开发者设置 */}
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">开发者</h3>

          {/* 日志级别选择 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">📋 日志级别</span>
              <span className="text-xs text-gray-500">{logLevel.toUpperCase()}</span>
            </div>
            <select
              value={logLevel}
              onChange={handleLogLevelChange}
              className="w-full px-2 py-1.5 text-xs bg-gray-800 text-gray-200 border border-gray-700 rounded cursor-pointer
                hover:border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.toUpperCase()} - {level === "debug" ? "显示所有日志" : level === "info" ? "隐藏调试日志" : level === "warn" ? "仅警告和错误" : "仅错误"}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-600 mt-1">控制控制台日志输出级别</div>
          </div>
        </div>
      </div>
    </div>
  );
}
