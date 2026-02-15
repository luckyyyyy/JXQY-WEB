/**
 * 通用彩色模块导航组件
 * 游戏编辑和游戏模块侧边栏共用
 * 支持平铺列表和分组列表两种模式
 */
import { NavLink, useLocation } from "react-router-dom";
import { DashboardIcons } from "../icons";

export type AccentColor = "amber" | "blue" | "violet" | "emerald" | "cyan" | "orange" | "rose";

export interface ModuleNavItem {
  id: string;
  label: string;
  path: string;
  icon: keyof typeof DashboardIcons;
  accent: AccentColor;
}

/** 分组导航：带 section header 的导航项 */
export interface ModuleNavSection {
  label: string;
  accent: AccentColor;
  items: { id: string; label: string; path: string }[];
}

/** 色调映射 */
const ACCENTS: Record<AccentColor, { color: string; bg: string; glow: string }> = {
  amber: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", glow: "0 0 12px rgba(245,158,11,0.12)" },
  blue: { color: "#60a5fa", bg: "rgba(96,165,250,0.10)", glow: "0 0 12px rgba(96,165,250,0.12)" },
  violet: {
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.10)",
    glow: "0 0 12px rgba(167,139,250,0.12)",
  },
  emerald: {
    color: "#34d399",
    bg: "rgba(52,211,153,0.10)",
    glow: "0 0 12px rgba(52,211,153,0.12)",
  },
  cyan: { color: "#22d3ee", bg: "rgba(34,211,238,0.10)", glow: "0 0 12px rgba(34,211,238,0.12)" },
  orange: { color: "#fb923c", bg: "rgba(251,146,60,0.10)", glow: "0 0 12px rgba(251,146,60,0.12)" },
  rose: { color: "#fb7185", bg: "rgba(251,113,133,0.10)", glow: "0 0 12px rgba(251,113,133,0.12)" },
};

/** 带图标的导航项（用于游戏模块等平铺列表） */
function IconNavItem({ item, basePath }: { item: ModuleNavItem; basePath: string }) {
  const location = useLocation();
  const fullPath = `${basePath}/${item.path}`;
  const isActive = location.pathname.startsWith(fullPath);
  const accent = ACCENTS[item.accent];

  return (
    <NavLink
      to={fullPath}
      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
        isActive ? "" : "text-[#999] hover:bg-[#2a2d2e] hover:text-[#ccc]"
      }`}
      style={
        isActive
          ? { backgroundColor: accent.bg, color: accent.color, boxShadow: accent.glow }
          : undefined
      }
    >
      {/* 左侧色条 */}
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300"
        style={{ height: isActive ? "55%" : "0%", backgroundColor: accent.color }}
      />
      <span className="shrink-0">{DashboardIcons[item.icon]}</span>
      <span className="truncate">{item.label}</span>
      {isActive && (
        <span
          className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent.color, boxShadow: `0 0 6px ${accent.color}` }}
        />
      )}
    </NavLink>
  );
}

/** 分组内的子项（无图标，紧凑样式） */
function SectionNavItem({
  item,
  basePath,
  accent,
}: {
  item: { id: string; label: string; path: string };
  basePath: string;
  accent: AccentColor;
}) {
  const location = useLocation();
  const fullPath = `${basePath}/${item.path}`;
  const isActive = location.pathname === fullPath || location.pathname.startsWith(`${fullPath}/`);
  const a = ACCENTS[accent];

  return (
    <NavLink
      to={fullPath}
      className={`group relative flex items-center rounded-md px-3 py-1.5 text-[13px] transition-all duration-200 ${
        isActive ? "font-medium" : "text-[#999] hover:bg-[#2a2d2e] hover:text-[#ccc]"
      }`}
      style={isActive ? { backgroundColor: a.bg, color: a.color } : undefined}
    >
      {/* 左侧色点 */}
      <span
        className="mr-2.5 h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300"
        style={{
          backgroundColor: isActive ? a.color : "#555",
          boxShadow: isActive ? `0 0 6px ${a.color}` : "none",
        }}
      />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

/** 平铺导航列表（带图标） */
export function ModuleNav({ items, basePath }: { items: ModuleNavItem[]; basePath: string }) {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((item) => (
        <IconNavItem key={item.id} item={item} basePath={basePath} />
      ))}
    </nav>
  );
}

/** 分组导航列表（带 section header + 色点子项） */
export function SectionedModuleNav({
  sections,
  basePath,
}: {
  sections: ModuleNavSection[];
  basePath: string;
}) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {sections.map((section) => {
        const a = ACCENTS[section.accent];
        return (
          <div key={section.label} className="mb-1">
            {/* 分组标题 */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-1">
              <span
                className="h-px flex-1"
                style={{ background: `linear-gradient(to right, ${a.color}33, transparent)` }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: a.color }}
              >
                {section.label}
              </span>
              <span
                className="h-px flex-1"
                style={{ background: `linear-gradient(to left, ${a.color}33, transparent)` }}
              />
            </div>
            {/* 分组子项 */}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <SectionNavItem
                  key={item.id}
                  item={item}
                  basePath={basePath}
                  accent={section.accent}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
