/**
 * AccountSettingsModal - 账号设置弹窗
 *
 * 包含：个人资料编辑、头像、修改密码、语言、主题设置
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@miu2d/ui";
import { useAuth, useTheme, type Theme } from "../../../contexts";
import { trpc } from "../../../lib/trpc";
import type { Locale } from "../../../i18n";
import { supportedLanguages } from "../../../i18n";
import { DashboardIcons } from "../icons";

interface AccountSettingsModalProps {
  onClose: () => void;
}

type Tab = "profile" | "password" | "preferences";

export function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: t("settings.profile"), icon: DashboardIcons.user },
    { id: "password", label: t("settings.changePassword"), icon: <LockIcon /> },
    { id: "preferences", label: t("settings.language"), icon: <GlobeSmIcon /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl h-[520px] bg-[#1e1e1e] border border-widget-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-widget-border">
          <h2 className="text-lg font-semibold text-white">{t("settings.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
          >
            {DashboardIcons.close}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 shrink-0 border-r border-widget-border bg-[#252526] py-2 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#37373d] text-white border-l-2 border-[#0098ff]"
                    : "text-[#bbbbbb] hover:bg-[#2a2d2e] hover:text-white border-l-2 border-transparent"
                }`}
              >
                <span className="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "profile" && (
              <ProfileTab user={user} onUserUpdate={updateUser} />
            )}
            {activeTab === "password" && <PasswordTab />}
            {activeTab === "preferences" && (
              <PreferencesTab
                user={user}
                theme={theme}
                setTheme={setTheme}
                locale={i18n.language as Locale}
                setLocale={(l) => i18n.changeLanguage(l)}
                onUserUpdate={updateUser}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= Profile Tab =============

import type { User } from "@miu2d/types";

function ProfileTab({
  user,
  onUserUpdate,
}: {
  user: User;
  onUserUpdate: (user: User) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const updateMutation = trpc.user.updateProfile.useMutation({
    onSuccess: (data) => {
      onUserUpdate(data);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      setSaveStatus("idle");
    },
  });

  const deleteAvatarMutation = trpc.user.deleteAvatar.useMutation({
    onSuccess: (data) => {
      onUserUpdate(data);
    },
  });

  const handleSave = useCallback(() => {
    const updates: { name?: string; email?: string } = {};
    if (name.trim() !== user.name) updates.name = name.trim();
    if (email.trim() !== user.email) updates.email = email.trim();
    if (Object.keys(updates).length === 0) return;
    setSaveStatus("saving");
    updateMutation.mutate(updates);
  }, [name, email, user.name, user.email, updateMutation]);

  const hasChanges = name.trim() !== user.name || email.trim() !== user.email;

  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <div className="flex items-center gap-4">
        <Avatar
          name={user.name}
          avatarUrl={user.settings?.avatarUrl}
          size={64}
        />
        <div className="flex-1">
          <div className="text-white font-medium">{user.name}</div>
          <div className="text-sm text-[#858585]">{user.email}</div>
          {user.settings?.avatarUrl && (
            <button
              type="button"
              onClick={() => deleteAvatarMutation.mutate()}
              disabled={deleteAvatarMutation.isPending}
              className="mt-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              {t("settings.deleteAvatar")}
            </button>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm text-[#bbbbbb] mb-1.5">
          {t("settings.name")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("settings.namePlaceholder")}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white placeholder-[#858585] focus:outline-none focus:border-focus-border transition-colors"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm text-[#bbbbbb] mb-1.5">
          {t("settings.email")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("settings.emailPlaceholder")}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white placeholder-[#858585] focus:outline-none focus:border-focus-border transition-colors"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === "saving"}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            saveStatus === "saved"
              ? "bg-emerald-600 text-white"
              : hasChanges
                ? "bg-[#0e639c] hover:bg-[#1177bb] text-white"
                : "bg-[#3c3c3c] text-[#858585] cursor-not-allowed"
          }`}
        >
          {saveStatus === "saving"
            ? t("settings.saving")
            : saveStatus === "saved"
              ? `✓ ${t("settings.saved")}`
              : t("settings.save")}
        </button>
      </div>
    </div>
  );
}

// ============= Password Tab =============

function PasswordTab() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const changeMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      setStatus("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setStatus("idle"), 3000);
    },
    onError: (err) => {
      setError(err.message);
      setStatus("error");
    },
  });

  const handleSubmit = () => {
    setError("");
    if (newPassword !== confirmPassword) {
      setError(t("errors.auth.passwordMismatch"));
      setStatus("error");
      return;
    }
    setStatus("saving");
    changeMutation.mutate({ currentPassword, newPassword });
  };

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 4 &&
    confirmPassword.length > 0 &&
    status !== "saving";

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {status === "saved" && (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          {t("settings.passwordChanged")}
        </div>
      )}

      <div>
        <label className="block text-sm text-[#bbbbbb] mb-1.5">
          {t("settings.currentPassword")}
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setError("");
            setStatus("idle");
          }}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white placeholder-[#858585] focus:outline-none focus:border-focus-border transition-colors"
          autoComplete="current-password"
        />
      </div>

      <div>
        <label className="block text-sm text-[#bbbbbb] mb-1.5">
          {t("settings.newPassword")}
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t("settings.passwordPlaceholder")}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white placeholder-[#858585] focus:outline-none focus:border-focus-border transition-colors"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-sm text-[#bbbbbb] mb-1.5">
          {t("settings.confirmNewPassword")}
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t("settings.passwordPlaceholder")}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white placeholder-[#858585] focus:outline-none focus:border-focus-border transition-colors"
          autoComplete="new-password"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            canSubmit
              ? "bg-[#0e639c] hover:bg-[#1177bb] text-white"
              : "bg-[#3c3c3c] text-[#858585] cursor-not-allowed"
          }`}
        >
          {status === "saving" ? t("settings.saving") : t("settings.changePassword")}
        </button>
      </div>
    </div>
  );
}

// ============= Preferences Tab =============

function PreferencesTab({
  user,
  theme,
  setTheme,
  locale,
  setLocale,
  onUserUpdate,
}: {
  user: User;
  theme: Theme;
  setTheme: (t: Theme) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  onUserUpdate: (user: User) => void;
}) {
  const { t } = useTranslation();

  const updateMutation = trpc.user.updateProfile.useMutation({
    onSuccess: (data) => {
      onUserUpdate(data);
    },
  });

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    updateMutation.mutate({
      settings: { themeMode: newTheme },
    });
  };

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    // langMode only supports "auto" | "zh" | "en" in UserSettings
    const langMode = newLocale === "zh" || newLocale === "en" ? newLocale : undefined;
    if (langMode) {
      updateMutation.mutate({
        settings: { langMode },
      });
    }
  };

  const themeOptions: { value: Theme; label: string }[] = [
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
  ];

  const langOptions: { value: Locale; label: string }[] = supportedLanguages.map(
    (l) => ({
      value: l,
      label: t(`lang.${l}` as `lang.${typeof l}`),
    })
  );

  return (
    <div className="space-y-8">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-[#bbbbbb] mb-3">
          {t("settings.theme")}
        </label>
        <div className="flex gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleThemeChange(opt.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all ${
                theme === opt.value
                  ? "border-[#0098ff] bg-[#0098ff]/10 text-white"
                  : "border-widget-border bg-[#3c3c3c] text-[#bbbbbb] hover:border-[#666666] hover:text-white"
              }`}
            >
              {opt.value === "light" ? (
                <SunSmIcon />
              ) : (
                <MoonSmIcon />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-[#bbbbbb] mb-3">
          {t("settings.language")}
        </label>
        <div className="flex flex-wrap gap-3">
          {langOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleLocaleChange(opt.value)}
              className={`px-4 py-2.5 rounded-lg border text-sm transition-all ${
                locale === opt.value
                  ? "border-[#0098ff] bg-[#0098ff]/10 text-white"
                  : "border-widget-border bg-[#3c3c3c] text-[#bbbbbb] hover:border-[#666666] hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============= Mini Icons =============

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function GlobeSmIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function SunSmIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonSmIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}
