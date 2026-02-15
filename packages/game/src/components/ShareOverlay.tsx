/**
 * ShareOverlay - 分享存档提示框
 *
 * 在游戏页面上方显示半透明模糊的提示框
 * 说明谁分享的什么存档，3秒后自动消失
 */

import { useEffect, useState } from "react";

export interface ShareOverlayProps {
  /** 分享的存档信息（null 表示加载中或失败） */
  sharedSave: {
    userName: string;
    saveName: string;
    mapName?: string | null;
    level?: number | null;
    data: Record<string, unknown>;
  } | null;
  /** 加载失败信息 */
  error?: string | null;
  /** 完成后回调（传入存档数据或 null 表示失败） */
  onDone: (data: Record<string, unknown> | null) => void;
}

export function ShareOverlay({ sharedSave, error, onDone }: ShareOverlayProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!sharedSave && !error) return; // still loading

    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    const doneTimer = setTimeout(() => onDone(sharedSave?.data ?? null), 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [sharedSave, error, onDone]);

  // Loading state
  if (!sharedSave && !error) {
    return (
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-[1300]">
        <div className="px-8 py-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl text-center min-w-[320px]">
          <div className="text-white/60 text-lg">加载分享存档...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`fixed top-1/3 left-1/2 -translate-x-1/2 z-[1300] transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}
      >
        <div className="px-8 py-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-red-500/30 shadow-2xl text-center min-w-[320px]">
          <div className="text-red-400 text-lg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-1/3 left-1/2 -translate-x-1/2 z-[1300] transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}
    >
      <div className="px-8 py-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl text-center min-w-[320px]">
        <div className="text-white/50 text-sm mb-2">来自玩家的分享</div>
        <div className="text-white text-lg font-semibold mb-1">{sharedSave!.userName}</div>
        <div className="text-white/70 text-base mb-3">{sharedSave!.saveName}</div>
        <div className="flex items-center justify-center gap-4 text-white/40 text-sm">
          {sharedSave!.mapName && <span>{sharedSave!.mapName}</span>}
          {sharedSave!.level !== undefined && sharedSave!.level !== null && (
            <span>Lv.{sharedSave!.level}</span>
          )}
        </div>
      </div>
    </div>
  );
}
