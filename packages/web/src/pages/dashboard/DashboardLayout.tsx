/**
 * Dashboard 主布局
 * VS Code 风格：Activity Bar + Sidebar + 主内容区
 */
import { Outlet } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { ActivityBar } from "./ActivityBar";
import { SidebarContent } from "./SidebarContent";

export function DashboardLayout() {
  return (
    <div className="flex h-screen w-screen flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
      {/* 顶部栏 */}
      <DashboardHeader />

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar - 左侧图标栏 */}
        <ActivityBar />

        {/* Sidebar - 侧边面板 */}
        <SidebarContent />

        {/* 主内容区域 */}
        <main className="flex-1 overflow-hidden bg-[#1e1e1e]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
