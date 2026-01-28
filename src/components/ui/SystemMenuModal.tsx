/**
 * SystemMenuModal - 系统菜单弹窗
 *
 * 统一的系统菜单界面，包含：
 * - 存档功能
 * - 读档功能
 * - 系统配置（音量调节）
 *
 * 设计：
 * - 左侧 Tab 导航
 * - 右侧对应内容区
 * - 配置保存到 localStorage
 */

import { useState, useEffect, useCallback } from "react";
import {
  StorageManager,
  type SaveSlotInfo,
} from "../../engine/game/storage";

// ============= LocalStorage 键名 =============
const STORAGE_KEY_MUSIC_VOLUME = "jxqy_music_volume";
const STORAGE_KEY_SOUND_VOLUME = "jxqy_sound_volume";
const STORAGE_KEY_AMBIENT_VOLUME = "jxqy_ambient_volume";

// ============= 类型定义 =============

export type SystemMenuTab = "saveload" | "settings";

export interface SystemMenuModalProps {
  /** 是否显示 */
  open: boolean;
  /** 初始显示的标签页 */
  initialTab?: SystemMenuTab;
  /** 仅读档模式（隐藏存档和删除按钮，标题界面使用） */
  loadOnly?: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 存档回调 */
  onSave?: (index: number) => Promise<boolean>;
  /** 读档回调 */
  onLoad?: (index: number) => Promise<boolean>;
  /** 获取当前音乐音量 */
  getMusicVolume?: () => number;
  /** 设置音乐音量 */
  setMusicVolume?: (volume: number) => void;
  /** 获取当前音效音量 */
  getSoundVolume?: () => number;
  /** 设置音效音量 */
  setSoundVolume?: (volume: number) => void;
  /** 获取当前环境音音量 */
  getAmbientVolume?: () => number;
  /** 设置环境音音量 */
  setAmbientVolume?: (volume: number) => void;
  /** 检查浏览器是否允许自动播放 */
  isAutoplayAllowed?: () => boolean;
  /** 请求自动播放权限 */
  requestAutoplayPermission?: () => Promise<boolean>;
}

// ============= 工具函数：localStorage 配置 =============

export function loadAudioSettings(): {
  musicVolume: number;
  soundVolume: number;
  ambientVolume: number;
} {
  const musicVolume = localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME);
  const soundVolume = localStorage.getItem(STORAGE_KEY_SOUND_VOLUME);
  const ambientVolume = localStorage.getItem(STORAGE_KEY_AMBIENT_VOLUME);

  return {
    musicVolume: musicVolume ? parseFloat(musicVolume) : 0.7,
    soundVolume: soundVolume ? parseFloat(soundVolume) : 1.0,
    ambientVolume: ambientVolume ? parseFloat(ambientVolume) : 1.0,
  };
}

export function saveAudioSettings(settings: {
  musicVolume?: number;
  soundVolume?: number;
  ambientVolume?: number;
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
}

// ============= 确认对话框组件 =============

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1101] flex items-center justify-center bg-black/60">
      <div className="bg-[#1a2744] rounded-lg p-6 min-w-[300px] shadow-xl border border-gray-600">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-300 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= Toast 组件 =============

interface ToastProps {
  message: string;
  type: "success" | "error" | "warning";
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: "bg-green-600",
    error: "bg-red-600",
    warning: "bg-yellow-600",
  }[type];

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1102] px-4 py-2 rounded ${bgColor} text-white shadow-lg`}>
      {message}
    </div>
  );
}

// ============= Tab 按钮组件 =============

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors rounded-lg mb-1 ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-300 hover:bg-gray-700 hover:text-white"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ============= 存档管理面板组件（统一的存档/读档界面） =============

interface SaveLoadPanelProps {
  slots: SaveSlotInfo[];
  loading: boolean;
  loadOnly?: boolean;
  onSave: (index: number) => void;
  onLoad: (index: number) => void;
  onDelete: (index: number) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
}

function SaveLoadPanel({
  slots,
  loading,
  loadOnly = false,
  onSave,
  onLoad,
  onDelete,
  showConfirm,
  showToast,
}: SaveLoadPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedSlot = slots.find((s) => s.index === selectedIndex);

  const handleSave = () => {
    if (selectedIndex === null) {
      showToast("请先选择一个存档槽位", "warning");
      return;
    }
    const slot = selectedSlot;
    if (!slot) return;

    showConfirm(
      slot.exists ? "覆盖存档" : "保存存档",
      slot.exists ? "确定覆盖此存档？" : "确定保存到此槽位？",
      () => onSave(slot.index)
    );
  };

  const handleLoad = () => {
    if (selectedIndex === null) {
      showToast("请先选择一个存档", "warning");
      return;
    }
    const slot = selectedSlot;
    if (!slot?.exists) {
      showToast("该槽位没有存档", "warning");
      return;
    }
    onLoad(slot.index);
  };

  const handleDelete = () => {
    if (selectedIndex === null) {
      showToast("请先选择一个存档", "warning");
      return;
    }
    const slot = selectedSlot;
    if (!slot?.exists) {
      showToast("该槽位没有存档", "warning");
      return;
    }
    showConfirm("删除存档", "确定删除此存档？", () => onDelete(slot.index));
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-bold text-white mb-4">
        {loadOnly ? "📂 读取存档" : "💾 存档管理"}
      </h3>

      {/* 存档列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {slots.length === 0 ? (
          <div className="text-center text-gray-500 py-8">暂无存档槽位</div>
        ) : (
          slots.map((slot) => {
            const isSelected = selectedIndex === slot.index;
            return (
              <div
                key={slot.index}
                className={`cursor-pointer transition-all rounded-lg p-3 border ${
                  isSelected
                    ? "border-blue-500 shadow-lg bg-[#1a2744]"
                    : "border-gray-600 hover:border-gray-400 bg-[#141e30]"
                }`}
                onClick={() => setSelectedIndex(slot.index)}
              >
                <div className="flex items-center gap-3">
                  {/* 选中指示器 */}
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      isSelected
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-500"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-full h-full flex items-center justify-center text-white text-xs">
                        ✓
                      </div>
                    )}
                  </div>

                  {/* 截图预览 */}
                  <div
                    className="bg-gray-800 rounded overflow-hidden flex-shrink-0"
                    style={{ width: 80, height: 60 }}
                  >
                    {slot.screenshot ? (
                      <img
                        src={slot.screenshot}
                        alt={`存档 ${slot.index}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        {slot.exists ? "无预览" : "空"}
                      </div>
                    )}
                  </div>

                  {/* 存档信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white mb-0.5">
                      存档 {slot.index}
                    </div>
                    {slot.exists ? (
                      <>
                        <div className="text-xs text-gray-400 truncate">
                          🕐 {slot.time}
                        </div>
                        <div className="text-xs text-gray-400">
                          📍 {slot.mapName || "未知地图"} · 👤 Lv.{slot.level || 1}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">
                        {loadOnly ? "空槽位" : "空槽位 - 可保存新存档"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部操作按钮 */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex gap-3">
          {!loadOnly && (
            <button
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading || selectedIndex === null}
              onClick={handleSave}
            >
              <span>💾</span>
              <span>存档</span>
            </button>
          )}
          <button
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={loading || selectedIndex === null || !selectedSlot?.exists}
            onClick={handleLoad}
          >
            <span>📂</span>
            <span>读档</span>
          </button>
          {!loadOnly && (
            <button
              className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading || selectedIndex === null || !selectedSlot?.exists}
              onClick={handleDelete}
            >
              <span>🗑️</span>
              <span>删除</span>
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 text-center mt-3">
          {selectedIndex === null
            ? "请选择一个存档"
            : selectedSlot?.exists
            ? `已选择存档 ${selectedIndex}`
            : loadOnly
            ? `槽位 ${selectedIndex} 为空`
            : `已选择空槽位 ${selectedIndex}，可保存新存档`}
        </div>
      </div>
    </div>
  );
}

// ============= 设置面板组件 =============

interface SettingsPanelProps {
  musicVolume: number;
  soundVolume: number;
  ambientVolume: number;
  autoplayAllowed: boolean;
  onMusicVolumeChange: (volume: number) => void;
  onSoundVolumeChange: (volume: number) => void;
  onAmbientVolumeChange: (volume: number) => void;
  onRequestAutoplay: () => Promise<void>;
}

function SettingsPanel({
  musicVolume,
  soundVolume,
  ambientVolume,
  autoplayAllowed,
  onMusicVolumeChange,
  onSoundVolumeChange,
  onAmbientVolumeChange,
  onRequestAutoplay,
}: SettingsPanelProps) {
  const [requestingPermission, setRequestingPermission] = useState(false);

  const handleRequestAutoplay = async () => {
    setRequestingPermission(true);
    await onRequestAutoplay();
    setRequestingPermission(false);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-4">⚙️ 系统设置</h3>

      {/* 浏览器音频权限提示 */}
      {!autoplayAllowed && (
        <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-600/50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔇</span>
            <div className="flex-1">
              <div className="text-yellow-200 font-medium mb-1">
                浏览器禁止自动播放音频
              </div>
              <p className="text-xs text-yellow-300/70 mb-3">
                为了保护用户体验，浏览器默认禁止网页自动播放声音。
                点击下方按钮授权后即可正常播放背景音乐。
              </p>
              <button
                onClick={handleRequestAutoplay}
                disabled={requestingPermission}
                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {requestingPermission ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>授权中...</span>
                  </>
                ) : (
                  <>
                    <span>🔊</span>
                    <span>点击启用音频</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 音乐音量 */}
      <div className="bg-[#141e30] rounded-lg p-4 border border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-medium">🎵 音乐音量</span>
          <span className="text-gray-400 text-sm">
            {Math.round(musicVolume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(musicVolume * 100)}
          onChange={(e) => onMusicVolumeChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 音效音量 */}
      <div className="bg-[#141e30] rounded-lg p-4 border border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-medium">🔈 音效音量</span>
          <span className="text-gray-400 text-sm">
            {Math.round(soundVolume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(soundVolume * 100)}
          onChange={(e) => onSoundVolumeChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 环境音音量 */}
      <div className="bg-[#141e30] rounded-lg p-4 border border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-medium">🌲 环境音音量</span>
          <span className="text-gray-400 text-sm">
            {Math.round(ambientVolume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(ambientVolume * 100)}
          onChange={(e) => onAmbientVolumeChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 提示 */}
      <div className="text-xs text-gray-500 text-center">
        设置会自动保存，下次打开游戏时自动应用
      </div>
    </div>
  );
}

// ============= 主组件 =============

export function SystemMenuModal({
  open,
  initialTab = "saveload",
  loadOnly = false,
  onClose,
  onSave,
  onLoad,
  getMusicVolume,
  setMusicVolume,
  getSoundVolume,
  setSoundVolume,
  getAmbientVolume,
  setAmbientVolume,
  isAutoplayAllowed,
  requestAutoplayPermission,
}: SystemMenuModalProps) {
  const [activeTab, setActiveTab] = useState<SystemMenuTab>(initialTab);
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // 音频设置状态
  const [musicVolume, setMusicVolumeState] = useState(0.7);
  const [soundVolume, setSoundVolumeState] = useState(1.0);
  const [ambientVolume, setAmbientVolumeState] = useState(1.0);
  const [autoplayAllowed, setAutoplayAllowed] = useState(true);

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  // Toast 状态
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "warning";
  }>({ show: false, message: "", type: "success" });

  // 显示 Toast
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "warning") => {
      setToast({ show: true, message, type });
    },
    []
  );

  // 显示确认对话框
  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, message, onConfirm });
    },
    []
  );

  // 当打开弹窗时加载存档列表
  useEffect(() => {
    if (open) {
      refreshSlots();
    }
  }, [open]);

  // 当打开弹窗时设置初始标签页
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // 当打开弹窗时加载音频设置（只在首次打开时）
  useEffect(() => {
    if (open) {
      // 从 localStorage 加载音频设置
      const settings = loadAudioSettings();
      setMusicVolumeState(settings.musicVolume);
      setSoundVolumeState(settings.soundVolume);
      setAmbientVolumeState(settings.ambientVolume);

      // 同步实际的音频状态（如果提供了回调）
      if (getMusicVolume) {
        setMusicVolumeState(getMusicVolume());
      }
      if (getSoundVolume) {
        setSoundVolumeState(getSoundVolume());
      }
      if (getAmbientVolume) {
        setAmbientVolumeState(getAmbientVolume());
      }
      // 检查自动播放权限
      if (isAutoplayAllowed) {
        setAutoplayAllowed(isAutoplayAllowed());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshSlots = () => {
    const saveSlots = StorageManager.getSaveSlots();
    setSlots(saveSlots);
  };

  // 处理存档
  const handleSave = async (index: number) => {
    if (!onSave) return;

    setLoading(true);
    try {
      const success = await onSave(index);
      if (success) {
        showToast(`存档成功 (槽位 ${index})`, "success");
        refreshSlots();
      } else {
        showToast("存档失败", "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      showToast("存档出错", "error");
    } finally {
      setLoading(false);
    }
  };

  // 处理读档
  const handleLoad = async (index: number) => {
    if (!onLoad) return;

    setLoading(true);
    try {
      const success = await onLoad(index);
      if (success) {
        showToast("读档成功", "success");
        onClose();
      } else {
        showToast("读档失败", "error");
      }
    } catch (error) {
      console.error("Load error:", error);
      showToast("读档出错", "error");
    } finally {
      setLoading(false);
    }
  };

  // 删除存档
  const handleDelete = (index: number) => {
    StorageManager.deleteGame(index);
    showToast(`存档 ${index} 已删除`, "success");
    refreshSlots();
  };

  // 音乐音量变化
  const handleMusicVolumeChange = (volume: number) => {
    setMusicVolumeState(volume);
    saveAudioSettings({ musicVolume: volume });
    if (setMusicVolume) {
      setMusicVolume(volume);
    }
  };

  // 音效音量变化
  const handleSoundVolumeChange = (volume: number) => {
    setSoundVolumeState(volume);
    saveAudioSettings({ soundVolume: volume });
    if (setSoundVolume) {
      setSoundVolume(volume);
    }
  };

  // 环境音音量变化
  const handleAmbientVolumeChange = (volume: number) => {
    setAmbientVolumeState(volume);
    saveAudioSettings({ ambientVolume: volume });
    if (setAmbientVolume) {
      setAmbientVolume(volume);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-[1100] bg-black/70 flex items-center justify-center"
        onClick={onClose}
      >
        {/* 模态框 */}
        <div
          className="bg-[#0d1117] rounded-lg shadow-xl border border-gray-700 w-[850px] h-[600px] flex overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 右上角关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-xl"
            title="关闭"
          >
            ✕
          </button>

          {/* 左侧 Tab 导航 */}
          <div className="w-[180px] bg-[#161b22] p-3 border-r border-gray-700 flex flex-col">
            <div className="mb-4 pb-3 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white text-center">
                系统菜单
              </h2>
            </div>
            <nav className="flex-1">
              <TabButton
                active={activeTab === "saveload"}
                onClick={() => setActiveTab("saveload")}
                icon="💾"
                label="存档管理"
              />
              <TabButton
                active={activeTab === "settings"}
                onClick={() => setActiveTab("settings")}
                icon="⚙️"
                label="设置"
              />
            </nav>
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "saveload" && (
              <SaveLoadPanel
                slots={slots}
                loading={loading}
                loadOnly={loadOnly}
                onSave={handleSave}
                onLoad={handleLoad}
                onDelete={handleDelete}
                showConfirm={showConfirm}
                showToast={showToast}
              />
            )}

            {activeTab === "settings" && (
              <SettingsPanel
                musicVolume={musicVolume}
                soundVolume={soundVolume}
                ambientVolume={ambientVolume}
                autoplayAllowed={autoplayAllowed}
                onMusicVolumeChange={handleMusicVolumeChange}
                onSoundVolumeChange={handleSoundVolumeChange}
                onAmbientVolumeChange={handleAmbientVolumeChange}
                onRequestAutoplay={async () => {
                  if (requestAutoplayPermission) {
                    const success = await requestAutoplayPermission();
                    setAutoplayAllowed(success);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, open: false });
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
      />

      {/* Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </>
  );
}

export default SystemMenuModal;
