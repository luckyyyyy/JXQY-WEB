/**
 * Dashboard 侧边栏共享组件
 * TreeNode 类型、SidebarPanel、TreeItem、TreeView、ListPanel
 */
import { NavLink } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export interface TreeNode {
  id: string;
  label: string;
  path?: string;
  icon?: keyof typeof DashboardIcons;
  children?: TreeNode[];
}

// 数据统计模块的子菜单
export const statisticsTree: TreeNode[] = [
  { id: "player-data", label: "玩家数据", path: "player-data", icon: "user" },
  { id: "player-saves", label: "玩家存档", path: "player-saves", icon: "save" },
];

interface SidebarPanelProps {
  title: string;
  children: React.ReactNode;
}

export function SidebarPanel({ title, children }: SidebarPanelProps) {
  return (
    <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
      <div className="flex h-9 items-center px-4 text-xs font-medium uppercase tracking-wide text-[#bbbbbb] border-b border-panel-border">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto py-1">{children}</div>
    </div>
  );
}

interface TreeItemProps {
  node: TreeNode;
  basePath: string;
  level?: number;
}

function TreeItem({ node, basePath, level = 0 }: TreeItemProps) {
  const { expandedNodes, toggleNode } = useDashboard();
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const fullPath = node.path ? `${basePath}/${node.path}` : basePath;

  const paddingLeft = 12 + level * 16;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleNode(node.id)}
          className="flex w-full items-center gap-1 py-1 pr-2 text-left text-sm hover:bg-[#2a2d2e] transition-colors"
          style={{ paddingLeft }}
        >
          <span
            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
          >
            {DashboardIcons.chevronRight}
          </span>
          {node.icon && (
            <span className="text-[#858585]">{DashboardIcons[node.icon]}</span>
          )}
          <span className="truncate">{node.label}</span>
        </button>
        {isExpanded && (
          <div>
            {node.children!.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                basePath={basePath}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={fullPath}
      className={({ isActive }) =>
        `flex items-center gap-2 py-1 pr-2 text-sm transition-colors ${
          isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
        }`
      }
      style={{ paddingLeft: paddingLeft + 16 }}
    >
      {node.icon && (
        <span className="text-[#858585]">{DashboardIcons[node.icon]}</span>
      )}
      <span className="truncate">{node.label}</span>
    </NavLink>
  );
}

export function TreeView({ nodes, basePath }: { nodes: TreeNode[]; basePath: string }) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeItem key={node.id} node={node} basePath={basePath} />
      ))}
    </div>
  );
}

// 通用列表面板（用于角色、NPC、物品等的动态列表）
interface ListPanelProps {
  title: string;
  basePath: string;
  items: { id: string; name: string }[];
  isLoading?: boolean;
  onAdd?: () => void;
}

export function ListPanel({ title, basePath, items, isLoading, onAdd }: ListPanelProps) {
  return (
    <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
      <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
        <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
          {title}
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
            title="添加"
          >
            {DashboardIcons.add}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-2 text-sm text-[#858585]">暂无数据</div>
        ) : (
          items.map((item) => (
            <NavLink
              key={item.id}
              to={`${basePath}/${item.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-1 text-sm transition-colors ${
                  isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                }`
              }
            >
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))
        )}
      </div>
    </div>
  );
}
