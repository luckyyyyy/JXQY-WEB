/**
 * GameSettingsModal - 游戏空间设置弹窗
 *
 * 修改游戏名称、Slug、描述
 */

import { trpc, useToast } from "@miu2d/shared";
import type { Game } from "@miu2d/types";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

interface GameSettingsModalProps {
  game: Game;
  onClose: () => void;
  onUpdated?: (game: Game) => void;
}

export function GameSettingsModal({ game, onClose, onUpdated }: GameSettingsModalProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const { setCurrentGame } = useDashboard();
  const utils = trpc.useUtils();

  const [name, setName] = useState(game.name);
  const [slug, setSlug] = useState(game.slug);
  const [description, setDescription] = useState(game.description ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  // Slug 格式校验
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const isSlugValid = slug.length > 0 && slugRegex.test(slug);

  const updateMutation = trpc.game.update.useMutation({
    onSuccess: (updated) => {
      setSaveStatus("saved");
      toast.success("游戏设置已保存");
      setCurrentGame(updated);
      onUpdated?.(updated);
      utils.game.list.invalidate();

      // 如果 slug 变了，跳转到新 URL
      if (updated.slug !== game.slug) {
        navigate(`/dashboard/${updated.slug}`, { replace: true });
      }

      setTimeout(() => {
        setSaveStatus("idle");
        onClose();
      }, 800);
    },
    onError: (err) => {
      setError(err.message);
      setSaveStatus("idle");
    },
  });

  const hasChanges =
    name.trim() !== game.name ||
    slug !== game.slug ||
    (description || "") !== (game.description || "");

  const canSave = hasChanges && name.trim().length > 0 && isSlugValid && saveStatus !== "saving";

  const handleSave = useCallback(() => {
    setError("");
    if (!canSave) return;

    setSaveStatus("saving");
    const updates: Record<string, unknown> = { id: game.id };

    if (name.trim() !== game.name) updates.name = name.trim();
    if (slug !== game.slug) updates.slug = slug;
    if ((description || "") !== (game.description || "")) {
      updates.description = description || null;
    }

    updateMutation.mutate(
      updates as { id: string; name?: string; slug?: string; description?: string | null }
    );
  }, [canSave, game, name, slug, description, updateMutation]);

  /** 将中文/英文名称自动转为 slug */
  const autoSlug = useCallback(() => {
    const s = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/[\u4e00-\u9fff]+/g, "")
      .replace(/(^-|-$)+/g, "")
      .replace(/-{2,}/g, "-");
    if (s) setSlug(s);
  }, [name]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#1e1e1e] border border-widget-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-widget-border">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {DashboardIcons.settings}
            <span>空间设置</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
          >
            {DashboardIcons.close}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 名称 */}
          <div>
            <label className="block text-sm text-[#bbbbbb] mb-1.5">
              空间名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入游戏空间名称"
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white placeholder-[#858585] focus:outline-none focus:border-focus-border transition-colors"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm text-[#bbbbbb] mb-1.5">
              空间标识 (Slug) <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-game"
                className={`flex-1 px-3 py-2 bg-[#3c3c3c] border rounded-lg text-white placeholder-[#858585] focus:outline-none transition-colors ${
                  slug && !isSlugValid
                    ? "border-red-500 focus:border-red-500"
                    : "border-widget-border focus:border-focus-border"
                }`}
              />
              <button
                type="button"
                onClick={autoSlug}
                title="从名称自动生成"
                className="px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-[#bbbbbb] hover:text-white hover:bg-[#4a4a4a] transition-colors text-sm whitespace-nowrap"
              >
                自动生成
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[#858585]">
              仅支持小写字母、数字和连字符。访问路径：
              <span className="text-[#0098ff]">/dashboard/{slug || "..."}</span>
            </p>
            {slug && !isSlugValid && (
              <p className="mt-1 text-xs text-red-400">
                格式不正确，仅支持小写字母、数字和连字符，不能以连字符开头或结尾
              </p>
            )}
            {slug !== game.slug && isSlugValid && (
              <p className="mt-1 text-xs text-amber-400">
                ⚠ 修改标识后，所有旧链接将失效，页面会自动跳转到新地址
              </p>
            )}
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm text-[#bbbbbb] mb-1.5">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入游戏描述（可选）"
              rows={3}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white placeholder-[#858585] focus:outline-none focus:border-focus-border transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-widget-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded-lg text-sm transition-colors text-[#cccccc]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              saveStatus === "saved"
                ? "bg-emerald-600 text-white"
                : canSave
                  ? "bg-[#0e639c] hover:bg-[#1177bb] text-white"
                  : "bg-[#3c3c3c] text-[#858585] cursor-not-allowed"
            }`}
          >
            {saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "✓ 已保存" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
