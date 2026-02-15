/**
 * useEntityEditor - 实体详情页通用表单管理 Hook
 *
 * 抽取 Magic / NPC / Obj / Goods / Player / Shop / Level 等模块
 * 中完全相同的 ~50 行表单状态管理 + 缓存同步 + Tab 路由逻辑。
 *
 * 管理：URL 参数、Dashboard Context、缓存感知表单状态、
 * 3 个 useEffect（缓存同步 / 新建初始化 / 服务端数据同步）、
 * Tab URL 同步、updateField、mutation 成功回调。
 *
 * 不管理（由消费方处理）：tRPC query/mutation 调用、handleSave Input 构建。
 *
 * @example
 * ```tsx
 * function MagicDetailPage() {
 *   const { data } = trpc.magic.get.useQuery(...);
 *   const editor = useEntityEditor<Magic>({
 *     entityType: "magic",
 *     paramKey: "magicId",
 *     basePath: (slug) => `/dashboard/${slug}/magic`,
 *     validTabs: ["basic", "resource", "levels", "attack"],
 *     createDefault: (gameId) => createDefaultMagic(gameId, "player"),
 *     entityLabel: "武功",
 *     serverData: data,
 *   });
 *
 *   const createMut = trpc.magic.create.useMutation({
 *     onSuccess: (d) => editor.onCreateSuccess(d.id),
 *   });
 * }
 * ```
 */

import { trpc, useToast } from "@miu2d/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { LOADING_CENTER_CLS, LOADING_TEXT_CLS } from "../styles/classNames";

// ── 类型定义 ─────────────────────────────────────────────

export interface UseEntityEditorOptions<T, TTab extends string = string> {
  /** 实体类型标识（cacheKey 前缀："magic" → "magic:xxx"） */
  entityType: string;
  /** URL param key（如 "magicId" / "npcId"） */
  paramKey: string;
  /** basePath 工厂：(gameSlug) => "/dashboard/xxx/magic" */
  basePath: (gameSlug: string) => string;
  /** 默认 Tab */
  defaultTab?: TTab;
  /** 合法 Tab 值列表（空数组 = 无 Tab 管理） */
  validTabs?: readonly TTab[];
  /** Tab 别名映射（兼容旧 URL），如 { effect: "basic" } */
  tabAliases?: Partial<Record<string, TTab>>;
  /** 新建实体的默认数据工厂 */
  createDefault: (gameId: string, searchParams: URLSearchParams) => Partial<T>;
  /** 实体中文名（toast 提示用） */
  entityLabel: string;
  /** 名称字段，用于 toast 显示（默认 "name"） */
  nameField?: keyof T;
  /** 服务端查询数据（undefined 表示尚未加载） */
  serverData?: T | null | undefined;
  /** 服务端查询加载状态 */
  isQueryLoading?: boolean;
}

export interface UseEntityEditorReturn<T, TTab extends string = string> {
  // ── 路由 ──
  gameSlug: string | undefined;
  gameId: string | undefined;
  entityId: string | undefined;
  isNew: boolean;
  basePath: string;
  /** 缓存 key（"entityType:entityId"） */
  cacheKey: string | null;

  // ── Tab ──
  activeTab: TTab;
  setActiveTab: (tab: TTab) => void;

  // ── 表单 ──
  formData: Partial<T>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<T>>>;
  updateField: <K extends keyof T>(key: K, value: T[K]) => void;

  /** 指示是否正在加载（queryLoading && !isNew） */
  isLoading: boolean;

  // ── Mutation 回调 ──
  /** 创建成功后：清缓存 + toast + navigate 到新 ID */
  onCreateSuccess: (newId: string) => void;
  /** 更新成功后：清缓存 + toast */
  onUpdateSuccess: () => void;
  /** 删除成功后：清缓存 + toast + navigate 回列表 */
  onDeleteSuccess: () => void;
  /** 清除当前实体缓存 */
  clearCache: () => void;

  // ── 引用 ──
  currentGame: ReturnType<typeof useDashboard>["currentGame"];
  editCache: ReturnType<typeof useDashboard>["editCache"];
  navigate: ReturnType<typeof useNavigate>;
  utils: ReturnType<typeof trpc.useUtils>;
  toast: ReturnType<typeof useToast>;
}

// ── 加载占位组件 ────────────────────────────────────────

export function EntityLoadingState() {
  return (
    <div className={LOADING_CENTER_CLS}>
      <div className={LOADING_TEXT_CLS}>加载中...</div>
    </div>
  );
}

// ── Hook 实现 ────────────────────────────────────────────

export function useEntityEditor<T extends Record<string, unknown>, TTab extends string = string>(
  options: UseEntityEditorOptions<T, TTab>
): UseEntityEditorReturn<T, TTab> {
  const {
    entityType,
    paramKey,
    basePath: getBasePath,
    validTabs = [],
    tabAliases,
    createDefault,
    entityLabel,
    nameField = "name" as keyof T,
    serverData,
    isQueryLoading = false,
  } = options;

  const hasTabs = validTabs.length > 0;
  const defaultTab = options.defaultTab ?? validTabs[0];

  // ── 路由 & Context ──
  const params = useParams<Record<string, string>>();
  const gameSlug = params.gameId;
  const entityId = params[paramKey];
  const tab = params.tab as string | undefined;
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const toast = useToast();

  const basePath = gameSlug ? getBasePath(gameSlug) : "";
  const isNew = entityId === "new";
  const cacheKey = entityId ? `${entityType}:${entityId}` : null;

  // ── Tab 管理 ──
  const resolvedTab = tabAliases?.[tab as string];
  const activeTab: TTab = validTabs.includes(tab as TTab)
    ? (tab as TTab)
    : (resolvedTab ?? defaultTab);

  const setActiveTab = useCallback(
    (newTab: TTab) => {
      if (hasTabs) {
        navigate(`${basePath}/${entityId}/${newTab}`, { replace: true });
      }
    },
    [navigate, basePath, entityId, hasTabs]
  );

  // ── 表单状态（缓存感知初始化） ──
  const [formData, setFormData] = useState<Partial<T>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<T>>(cacheKey) || {};
    }
    return {};
  });

  // 使用 ref 稳定 createDefault 引用，避免 effect 重复触发
  const createDefaultRef = useRef(createDefault);
  createDefaultRef.current = createDefault;

  // 1️⃣ 表单 → 缓存同步
  useEffect(() => {
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  // 2️⃣ 新建实体初始化
  useEffect(() => {
    if (isNew && gameId && Object.keys(formData).length === 0) {
      const searchParams = new URLSearchParams(window.location.search);
      setFormData(createDefaultRef.current(gameId, searchParams));
    }
  }, [isNew, gameId, formData]);

  // 3️⃣ 服务端数据 → 表单（仅在无缓存时）
  useEffect(() => {
    if (serverData && cacheKey && !editCache.has(cacheKey)) {
      setFormData(serverData as Partial<T>);
    }
  }, [serverData, cacheKey, editCache]);

  // ── updateField ──
  const updateField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── 缓存清理 ──
  const clearCache = useCallback(() => {
    if (cacheKey) {
      editCache.remove(cacheKey);
      editCache.remove(`${cacheKey}:meta`);
    }
  }, [cacheKey, editCache]);

  // ── Mutation 回调（使用 ref 避免闭包过时问题） ──
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const onCreateSuccess = useCallback(
    (newId: string) => {
      clearCache();
      const displayName = (formDataRef.current[nameField] as string) || `新${entityLabel}`;
      toast.success(`${entityLabel}「${displayName}」创建成功`);
      navigate(hasTabs ? `${basePath}/${newId}/${defaultTab}` : `${basePath}/${newId}`);
    },
    [clearCache, nameField, entityLabel, toast, navigate, basePath, defaultTab, hasTabs]
  );

  const onUpdateSuccess = useCallback(() => {
    clearCache();
    const displayName = (formDataRef.current[nameField] as string) || entityLabel;
    toast.success(`${entityLabel}「${displayName}」保存成功`);
  }, [clearCache, nameField, entityLabel, toast]);

  const onDeleteSuccess = useCallback(() => {
    clearCache();
    toast.success(`${entityLabel}已删除`);
    navigate(basePath);
  }, [clearCache, entityLabel, toast, navigate, basePath]);

  return {
    gameSlug,
    gameId,
    entityId,
    isNew,
    basePath,
    cacheKey,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    updateField,
    isLoading: isQueryLoading && !isNew,
    onCreateSuccess,
    onUpdateSuccess,
    onDeleteSuccess,
    clearCache,
    currentGame,
    editCache,
    navigate,
    utils,
    toast,
  };
}
