/**
 * 通用列表编辑页面
 * 用于角色、NPC、物品、商店、武功等的 CRUD 操作
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardIcons } from "../icons";

interface ListItem {
  id: string;
  name: string;
  description?: string;
}

interface ListEditorPageProps {
  title: string;
  itemName: string;
  items: ListItem[];
  isLoading?: boolean;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  basePath: string;
}

export function ListEditorPage({
  title,
  itemName,
  items,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  basePath,
}: ListEditorPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-2 px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] rounded text-sm transition-colors"
            >
              {DashboardIcons.add}
              <span>添加{itemName}</span>
            </button>
          )}
        </div>

        {/* 搜索栏 */}
        <div className="mb-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]">
              {DashboardIcons.search}
            </span>
            <input
              type="text"
              placeholder={`搜索${itemName}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white placeholder-[#858585] focus:outline-none focus:border-focus-border"
            />
          </div>
        </div>

        {/* 列表 */}
        <div className="bg-[#252526] border border-widget-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-[#858585]">加载中...</div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#858585]">
              {searchTerm ? `没有找到匹配的${itemName}` : `暂无${itemName}`}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-widget-border text-left text-sm text-[#858585]">
                  <th className="px-4 py-3 font-medium">名称</th>
                  <th className="px-4 py-3 font-medium">描述</th>
                  <th className="px-4 py-3 font-medium w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-widget-border last:border-b-0 hover:bg-[#2a2d2e] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`${basePath}/${item.id}`}
                        className="text-[#0098ff] hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#858585] text-sm">
                      {item.description || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit?.(item.id)}
                          className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
                          title="编辑"
                        >
                          {DashboardIcons.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          {DashboardIcons.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 删除确认对话框 */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm bg-[#252526] border border-widget-border rounded-lg shadow-xl p-4">
              <h3 className="text-lg font-medium text-white mb-2">确认删除</h3>
              <p className="text-[#858585] text-sm mb-4">
                确定要删除这个{itemName}吗？此操作无法撤销。
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete?.(deleteConfirm);
                    setDeleteConfirm(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 详情编辑页面布局
 */
interface DetailEditorPageProps {
  title: string;
  backPath: string;
  children: React.ReactNode;
  onSave?: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
}

export function DetailEditorPage({
  title,
  backPath,
  children,
  onSave,
  onDelete,
  isSaving,
}: DetailEditorPageProps) {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        {/* 返回和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
          >
            {DashboardIcons.back}
          </button>
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>

        {/* 内容 */}
        {children}

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-widget-border">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-600/20 rounded text-sm transition-colors"
            >
              {DashboardIcons.delete}
              <span>删除</span>
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors"
            >
              取消
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 rounded text-sm transition-colors"
              >
                {DashboardIcons.save}
                <span>{isSaving ? "保存中..." : "保存"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
