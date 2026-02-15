/**
 * 资源管理页面
 */
import { useState } from "react";
import { DashboardIcons } from "../icons";
import { FileManager } from "./fileTree";

export function ResourcesHomePage() {
  // 使用新的文件管理器
  return <FileManager />;
}

export function ImagesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 模拟图片数据
  const images = Array.from({ length: 12 }, (_, i) => ({
    id: `img_${i + 1}`,
    name: `image_${i + 1}.png`,
    size: `${Math.floor(Math.random() * 500 + 100)}KB`,
  }));

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">图片资源</h1>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors">
              上传图片
            </button>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-4 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="bg-[#252526] border border-widget-border rounded-lg overflow-hidden hover:border-[#0098ff] transition-colors cursor-pointer"
              >
                <div className="aspect-square bg-[#1a1a1a] flex items-center justify-center">
                  <span className="text-[#444]">{DashboardIcons.image}</span>
                </div>
                <div className="p-2">
                  <p className="text-sm text-[#cccccc] truncate">{image.name}</p>
                  <p className="text-xs text-[#858585]">{image.size}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#252526] border border-widget-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-[#858585] border-b border-widget-border">
                  <th className="px-4 py-3">名称</th>
                  <th className="px-4 py-3">大小</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {images.map((image) => (
                  <tr key={image.id} className="border-b border-widget-border last:border-0">
                    <td className="px-4 py-3 text-[#cccccc]">{image.name}</td>
                    <td className="px-4 py-3 text-[#858585]">{image.size}</td>
                    <td className="px-4 py-3">
                      <button className="text-[#0098ff] hover:underline text-sm">下载</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function MusicPage() {
  // 模拟音乐数据
  const tracks = [
    { id: "music_001", name: "主题曲.ogg", duration: "3:45" },
    { id: "music_002", name: "战斗曲.ogg", duration: "2:30" },
    { id: "music_003", name: "村庄BGM.ogg", duration: "4:15" },
    { id: "music_004", name: "城镇BGM.ogg", duration: "3:20" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">音乐资源</h1>
          <button className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors">
            上传音乐
          </button>
        </div>

        <div className="space-y-2">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-4 p-4 bg-[#252526] border border-widget-border rounded-lg hover:bg-[#2a2d2e] transition-colors"
            >
              <button className="p-2 rounded-full bg-[#0098ff] hover:bg-[#1177bb] transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <div className="flex-1">
                <p className="text-[#cccccc]">{track.name}</p>
              </div>
              <span className="text-sm text-[#858585]">{track.duration}</span>
              <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-red-400 transition-colors">
                {DashboardIcons.delete}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SoundsPage() {
  // 模拟音效数据
  const sounds = [
    { id: "sound_001", name: "攻击音效.ogg", category: "战斗" },
    { id: "sound_002", name: "点击音效.ogg", category: "UI" },
    { id: "sound_003", name: "拾取物品.ogg", category: "物品" },
    { id: "sound_004", name: "升级音效.ogg", category: "系统" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">音效资源</h1>
          <button className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors">
            上传音效
          </button>
        </div>

        <div className="space-y-2">
          {sounds.map((sound) => (
            <div
              key={sound.id}
              className="flex items-center gap-4 p-4 bg-[#252526] border border-widget-border rounded-lg hover:bg-[#2a2d2e] transition-colors"
            >
              <button className="p-2 rounded-full bg-[#4a4a4a] hover:bg-[#5a5a5a] transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <div className="flex-1">
                <p className="text-[#cccccc]">{sound.name}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-[#3c3c3c] rounded text-[#858585]">
                {sound.category}
              </span>
              <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-red-400 transition-colors">
                {DashboardIcons.delete}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AsfResourcesPage() {
  // 模拟 ASF 数据
  const asfFiles = [
    { id: "asf_001", name: "主角_待机.asf", frames: 8 },
    { id: "asf_002", name: "主角_行走.asf", frames: 16 },
    { id: "asf_003", name: "主角_攻击.asf", frames: 12 },
    { id: "asf_004", name: "特效_火焰.asf", frames: 24 },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">ASF动画资源</h1>
          <button className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors">
            上传ASF
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {asfFiles.map((asf) => (
            <div
              key={asf.id}
              className="bg-[#252526] border border-widget-border rounded-lg overflow-hidden hover:border-[#0098ff] transition-colors cursor-pointer"
            >
              <div className="aspect-square bg-[#1a1a1a] flex items-center justify-center">
                <span className="text-[#444] text-4xl">{DashboardIcons.asf}</span>
              </div>
              <div className="p-3">
                <p className="text-sm text-[#cccccc] truncate">{asf.name}</p>
                <p className="text-xs text-[#858585]">{asf.frames} 帧</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
