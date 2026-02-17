/**
 * REST API hooks — drop-in replacement for tRPC react hooks.
 *
 * Migration guide:
 *   import { trpc } from "@miu2d/shared";
 *   →
 *   import { api } from "@miu2d/shared";
 *
 *   trpc.magic.get.useQuery({ gameId, id }, { enabled })
 *   → api.magic.get.useQuery({ gameId, id }, { enabled })
 *
 *   trpc.magic.create.useMutation({ onSuccess })
 *   → api.magic.create.useMutation({ onSuccess })
 *
 *   const utils = trpc.useUtils();
 *   → const utils = api.useUtils();
 *   utils.magic.list.invalidate({ gameId })
 *   → utils.magic.list.invalidate({ gameId })
 */

import type { UseMutationOptions } from "@tanstack/react-query";
import {
  useMutation as useRQMutation,
  useQuery as useRQQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, apiFetch } from "./api-client";

import type {
  FileNode,
  Game,
  GameConfig,
  Good,
  LevelConfig,
  Magic,
  Npc,
  NpcResource,
  Obj,
  ObjResource,
  Player,
  PortraitMap,
  SaveDataResponse,
  SaveSlot,
  Scene,
  Shop,
  TalkData,
  User,
} from "@miu2d/types";

export { ApiError };

// ===== Entity response wrapper types =====

/** Base entity record with DB fields — all CRUD endpoints include these */
interface EntityBase {
  id: string;
  gameId: string;
  key: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

/** NPC resource entity — DB wrapper around NpcResource actions data */
type NpcResourceEntity = EntityBase & {
  resources?: NpcResource;
  icon?: string | null;
};

/** Obj resource entity — DB wrapper around ObjResource actions data */
type ObjResourceEntity = EntityBase & {
  resources?: ObjResource;
  icon?: string | null;
};

/** Scene list item with computed counts */
type SceneEntity = EntityBase & Scene & {
  mapFileName: string;
  data?: Record<string, unknown> | null;
  scriptCount?: number;
  trapCount?: number;
  npcCount?: number;
  objCount?: number;
  scriptKeys?: string[];
  trapKeys?: string[];
  npcKeys?: string[];
  objKeys?: string[];
  mmfData?: string | null;
  mapParsed?: Record<string, unknown> | null;
};

// ===== Internal fetch helpers (camelCase) =====

function apiGet<T>(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  return apiFetch<T>("GET", path, undefined, query as Record<string, string | number | boolean | undefined>);
}

function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>("POST", path, body);
}

function apiPut<T>(path: string, body?: unknown) {
  return apiFetch<T>("PUT", path, body);
}

function apiDel<T>(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
) {
  return apiFetch<T>("DELETE", path, undefined, query);
}

// ===== Hook factories =====

/**
 * Creates a query hook that accepts (input, opts?) — same as tRPC useQuery.
 */
function createQuery<TInput, TOutput>(
  keyPrefix: readonly string[],
  fetcher: (input: TInput) => Promise<TOutput>,
) {
  function useQuery(
    input: TInput,
    opts?: {
      enabled?: boolean;
      retry?: boolean | number;
      refetchOnWindowFocus?: boolean;
      staleTime?: number;
      refetchInterval?: number | false;
    },
  ) {
    return useRQQuery<TOutput, ApiError>({
      queryKey: [...keyPrefix, input],
      queryFn: () => fetcher(input),
      ...opts,
    });
  }
  return { useQuery };
}

/**
 * Query hook with no input (e.g., getProfile).
 */
function createVoidQuery<TOutput>(
  keyPrefix: readonly string[],
  fetcher: () => Promise<TOutput>,
) {
  function useQuery(
    _input?: undefined,
    opts?: {
      enabled?: boolean;
      retry?: boolean | number;
      refetchOnWindowFocus?: boolean;
      staleTime?: number;
    },
  ) {
    return useRQQuery<TOutput, ApiError>({
      queryKey: keyPrefix,
      queryFn: fetcher,
      ...opts,
    });
  }
  return { useQuery };
}

/**
 * Creates a mutation hook — same as tRPC useMutation.
 */
function createMutation<TInput, TOutput>(
  fetcher: (input: TInput) => Promise<TOutput>,
) {
  function useMutation(
    opts?: Omit<UseMutationOptions<TOutput, ApiError, TInput>, "mutationFn">,
  ) {
    return useRQMutation<TOutput, ApiError, TInput>({
      mutationFn: fetcher,
      ...opts,
    });
  }
  return { useMutation };
}

/**
 * Creates a void mutation hook (no input).
 */
function createVoidMutation<TOutput>(
  fetcher: () => Promise<TOutput>,
) {
  function useMutation(
    opts?: Omit<UseMutationOptions<TOutput, ApiError, void>, "mutationFn">,
  ) {
    return useRQMutation<TOutput, ApiError, void>({
      mutationFn: () => fetcher(),
      ...opts,
    });
  }
  return { useMutation };
}

// ===== Entity CRUD hook factory =====

/**
 * Creates standard CRUD hooks for an entity module.
 * Matches tRPC pattern: list/get/create/update/delete/importFromIni/batchImportFromIni
 */
function createEntityModule<T = unknown>(basePath: string, name: string) {
  return {
    list: createQuery(
      [name, "list"],
      (input: { gameId: string; [key: string]: unknown }) => {
        const { gameId, ...filters } = input;
        return apiGet<T[]>(basePath, { gameId, ...filters as Record<string, string> });
      },
    ),
    get: createQuery(
      [name, "get"],
      ({ gameId, id }: { gameId: string; id: string }) =>
        apiGet<T>(`${basePath}/${id}`, { gameId }),
    ),
    create: createMutation<Record<string, unknown>, T>(
      (input) => {
        const { gameId, key, name: entityName, ...data } = input;
        return apiPost(basePath, { gameId, key, name: entityName, data });
      },
    ),
    update: createMutation<{ gameId: string; id: string; data: unknown }, T>(
      ({ gameId, id, data }) =>
        apiPut(`${basePath}/${id}`, { gameId, data }),
    ),
    delete: createMutation<{ gameId: string; id: string }, unknown>(
      ({ gameId, id }) => apiDel(`${basePath}/${id}`, { gameId }),
    ),
    importFromIni: createMutation<Record<string, unknown>, unknown>(
      (input) => apiPost(`${basePath}/batch-import`, input),
    ),
    batchImportFromIni: createMutation<Record<string, unknown>, unknown>(
      (input) => apiPost(`${basePath}/batch-import`, input),
    ),
  };
}

// ===== useUtils factory =====

/**
 * Creates a utils branch with invalidate() and fetch() — same as tRPC useUtils().
 */
function createUtilsBranch<TInput>(
  queryClient: ReturnType<typeof useQueryClient>,
  keyPrefix: readonly string[],
  fetcher?: (input: TInput) => Promise<unknown>,
) {
  return {
    invalidate(input?: TInput) {
      return queryClient.invalidateQueries({
        queryKey: input !== undefined ? [...keyPrefix, input] : keyPrefix,
      });
    },
    fetch(input: TInput) {
      if (!fetcher) throw new Error(`fetch not available for ${keyPrefix.join(".")}`);
      return queryClient.fetchQuery({
        queryKey: [...keyPrefix, input],
        queryFn: () => fetcher(input),
      });
    },
    setData(input: TInput, updater: unknown) {
      queryClient.setQueryData([...keyPrefix, input], updater);
    },
  };
}

// ===== The API object =====

export const api = {
  // ── Auth ──
  auth: {
    login: createMutation<
      { email: string; password: string },
      { user: unknown }
    >((input) => apiPost("/api/auth/login", input)),

    register: createMutation<
      { name: string; email: string; password: string },
      { user: unknown }
    >((input) => apiPost("/api/auth/register", input)),

    logout: createVoidMutation<void>(() => apiPost("/api/auth/logout")),
  },

  // ── User ──
  user: {
    getProfile: createVoidQuery<User>(
      ["user", "getProfile"],
      () => apiGet("/api/user/profile"),
    ),
    updateSettings: createMutation<unknown, unknown>(
      (input) => apiPut("/api/user/settings", input),
    ),
    changeName: createMutation<{ name: string }, unknown>(
      (input) => apiPut("/api/user/name", input),
    ),
    changePassword: createMutation<
      { currentPassword: string; newPassword: string },
      unknown
    >((input) => apiPut("/api/user/password", input)),
    updateProfile: createMutation<Record<string, unknown>, unknown>(
      (input) => apiPut("/api/user/profile", input),
    ),
    deleteAvatar: createVoidMutation<unknown>(
      () => apiDel("/api/user/avatar"),
    ),
    requestEmailVerification: createVoidMutation<unknown>(
      () => apiPost("/api/user/email/send-verify"),
    ),
  },

  // ── Game ──
  game: {
    list: createVoidQuery<Game[]>(
      ["game", "list"],
      () => apiGet("/api/game"),
    ),
    get: createQuery(
      ["game", "get"],
      ({ id }: { id: string }) => apiGet<Game>(`/api/game/${id}`),
    ),
    getBySlug: createQuery(
      ["game", "getBySlug"],
      ({ slug }: { slug: string }) => apiGet<Game>(`/api/game/by-slug/${slug}`),
    ),
    create: createMutation<{ name: string }, Game>(
      (input) => apiPost("/api/game", input),
    ),
    update: createMutation<{ id: string; [key: string]: unknown }, Game>(
      ({ id, ...data }) => apiPut(`/api/game/${id}`, data),
    ),
    delete: createMutation<{ id: string }, unknown>(
      ({ id }) => apiDel(`/api/game/${id}`),
    ),
  },

  // ── Magic ──
  magic: createEntityModule<Magic>("/api/magic", "magic"),

  // ── Goods ──
  goods: createEntityModule<Good>("/api/goods", "goods"),

  // ── Level ──
  level: createEntityModule<LevelConfig>("/api/level", "level"),

  // ── Player ──
  player: createEntityModule<Player>("/api/player", "player"),

  // ── Shop ──
  shop: createEntityModule<Shop & { itemCount?: number }>("/api/shop", "shop"),

  // ── NPC (with sub-resource) ──
  npc: {
    ...createEntityModule<Npc & { icon?: string | null }>("/api/npc", "npc"),
    resource: createEntityModule<NpcResourceEntity>("/api/npc/resource", "npcResource"),
  },

  // ── NPC/Obj Resource (flat aliases — matches tRPC router names) ──
  npcResource: createEntityModule<NpcResourceEntity>("/api/npc/resource", "npcResource"),
  objResource: createEntityModule<ObjResourceEntity>("/api/obj/resource", "objResource"),

  // ── Obj (with sub-resource) ──
  obj: {
    ...createEntityModule<Obj & { icon?: string | null }>("/api/obj", "obj"),
    resource: createEntityModule<ObjResourceEntity>("/api/obj/resource", "objResource"),
  },

  // ── Scene ──
  scene: {
    ...createEntityModule<SceneEntity>("/api/scene", "scene"),
    importScene: createMutation<{ gameId: string; scenes: unknown[] }, unknown>(
      (input) => apiPost("/api/scene/import", input),
    ),
    clearAll: createMutation<{ gameId: string }, unknown>(
      (input) => apiPost("/api/scene/clear-all", input),
    ),
  },

  // ── Talk (singleton) ──
  talk: {
    get: createQuery(
      ["talk", "get"],
      ({ gameId }: { gameId: string }) => apiGet<TalkData>("/api/talk", { gameId }),
    ),
    search: createQuery(
      ["talk", "search"],
      (input: {
        gameId: string;
        portraitIndex?: number;
        query?: string;
        page?: number;
        pageSize?: number;
      }) => apiGet<unknown>("/api/talk/search", input as Record<string, string | number>),
    ),
    update: createMutation<{ gameId: string; entries: unknown[] }, unknown>(
      (input) => apiPut("/api/talk", input),
    ),
    addEntry: createMutation<{ gameId: string; entry: unknown }, unknown>(
      (input) => apiPost("/api/talk/entry", input),
    ),
    updateEntry: createMutation<
      { gameId: string; entryId: number; entry: unknown },
      unknown
    >(({ gameId, entryId, entry }) =>
      apiPut(`/api/talk/entry/${entryId}`, { gameId, entry }),
    ),
    deleteEntry: createMutation<{ gameId: string; entryId: number }, unknown>(
      ({ gameId, entryId }) =>
        apiDel(`/api/talk/entry/${entryId}`, { gameId }),
    ),
    importFromTxt: createMutation<{ gameId: string; entries: unknown[] }, unknown>(
      (input) => apiPost("/api/talk/import", input),
    ),
  },

  // ── Talk Portrait (singleton) ──
  talkPortrait: {
    get: createQuery(
      ["talkPortrait", "get"],
      ({ gameId }: { gameId: string }) =>
        apiGet<PortraitMap>("/api/talk-portrait", { gameId }),
    ),
    update: createMutation<{ gameId: string; entries: unknown[] }, unknown>(
      (input) => apiPut("/api/talk-portrait", input),
    ),
    importFromIni: createMutation<{ gameId: string; entries: unknown[] }, unknown>(
      (input) => apiPost("/api/talk-portrait/import", input),
    ),
  },

  // ── Game Config (singleton) ──
  gameConfig: {
    get: createQuery(
      ["gameConfig", "get"],
      ({ gameId }: { gameId: string }) =>
        apiGet<GameConfig>("/api/game-config", { gameId }),
    ),
    update: createMutation<{ gameId: string; data: unknown }, unknown>(
      (input) => apiPut("/api/game-config", input),
    ),
  },

  // ── Save ──
  save: {
    list: createQuery(
      ["save", "list"],
      ({ gameSlug }: { gameSlug: string }) =>
        apiGet<SaveSlot[]>("/api/save", { gameSlug }),
    ),
    get: createQuery(
      ["save", "get"],
      ({ gameSlug, saveId }: { gameSlug: string; saveId: string }) =>
        apiGet<SaveDataResponse>(`/api/save/${saveId}`, { gameSlug }),
    ),
    upsert: createMutation<unknown, unknown>(
      (input) => apiPost("/api/save/upsert", input),
    ),
    delete: createMutation<{ gameId: string; saveId: string }, unknown>(
      ({ gameId, saveId }) => apiDel(`/api/save/${saveId}`, { gameId }),
    ),
    share: createMutation<{ gameId: string; saveId: string }, unknown>(
      (input) => apiPost("/api/save/share", input),
    ),
    getShared: createQuery(
      ["save", "getShared"],
      ({ gameSlug, shareCode }: { gameSlug: string; shareCode: string }) =>
        apiGet<SaveDataResponse>(`/game/${gameSlug}/api/save/shared/${shareCode}`),
    ),
    // Admin
    adminList: createQuery(
      ["save", "adminList"],
      (input: Record<string, string | number>) =>
        apiGet<unknown>("/api/save/admin", input),
    ),
    adminGet: createQuery(
      ["save", "adminGet"],
      ({ saveId }: { saveId: string }) =>
        apiGet<unknown>(`/api/save/admin/${saveId}`),
    ),
    adminCreate: createMutation<unknown, unknown>(
      (input) => apiPost("/api/save/admin/create", input),
    ),
    adminUpdate: createMutation<{ id: string; data: unknown }, unknown>(
      ({ id, data }) => apiPut(`/api/save/admin/${id}`, data),
    ),
    adminDelete: createMutation<{ id: string }, unknown>(
      ({ id }) => apiDel(`/api/save/admin/${id}`),
    ),
    adminShare: createMutation<{ saveId: string; isShared: boolean }, unknown>(
      ({ saveId, ...rest }) => apiPost(`/api/save/admin/${saveId}/share`, rest),
    ),
  },

  // ── File ──
  file: {
    list: createQuery(
      ["file", "list"],
      ({ gameId, parentId }: { gameId: string; parentId?: string }) =>
        apiGet<FileNode[]>("/api/file", { gameId, parentId }),
    ),
    get: createQuery(
      ["file", "get"],
      ({ gameId, id }: { gameId: string; id: string }) =>
        apiGet<FileNode>(`/api/file/${id}`, { gameId }),
    ),
    getPath: createQuery(
      ["file", "getPath"],
      ({ gameId, id }: { gameId: string; id: string }) =>
        apiGet<FileNode[]>(`/api/file/${id}/path`, { gameId }),
    ),
    createFolder: createMutation<
      { gameId: string; name: string; parentId?: string },
      unknown
    >((input) => apiPost("/api/file/folder", input)),
    prepareUpload: createMutation<
      {
        gameId: string;
        name: string;
        parentId?: string;
        mimeType?: string;
        size?: number;
      },
      { file: unknown; uploadUrl: string }
    >((input) => apiPost("/api/file/prepare-upload", input)),
    confirmUpload: createMutation<
      { gameId: string; fileId: string },
      unknown
    >((input) => apiPost("/api/file/confirm-upload", input)),
    getDownloadUrl: createQuery(
      ["file", "getDownloadUrl"],
      ({ gameId, id }: { gameId: string; id: string }) =>
        apiGet<{ url: string }>(`/api/file/download-url/${id}`, { gameId }),
    ),
    getUploadUrl: createMutation<
      { gameId: string },
      { url: string; storageKey: string }
    >((input) => apiPost("/api/file/upload-url", input)),
    rename: createMutation<
      { gameId: string; id: string; name: string },
      unknown
    >(({ gameId, id, name: n }) => apiPut(`/api/file/rename/${id}`, { gameId, name: n })),
    move: createMutation<
      { gameId: string; id: string; parentId?: string },
      unknown
    >(({ gameId, id, parentId }) => apiPut(`/api/file/move/${id}`, { gameId, parentId })),
    delete: createMutation<{ gameId: string; id: string }, unknown>(
      ({ gameId, id }) => apiDel(`/api/file/${id}`, { gameId }),
    ),
    batchPrepareUpload: createMutation<
      {
        gameId: string;
        files: { name: string; parentId?: string; mimeType?: string; size?: number }[];
      },
      unknown[]
    >((input) => apiPost("/api/file/batch-prepare-upload", input)),
    batchConfirmUpload: createMutation<
      { gameId: string; fileIds: string[] },
      unknown
    >((input) => apiPost("/api/file/batch-confirm-upload", input)),
    ensureFolderPath: createMutation<
      { gameId: string; path: string },
      unknown
    >((input) => apiPost("/api/file/ensure-folder-path", input)),
  },

  // ── Data (public aggregation) ──
  data: {
    getAll: createQuery(
      ["data", "getAll"],
      ({ gameSlug }: { gameSlug: string }) =>
        apiGet<unknown>(`/game/${gameSlug}/api/data`),
    ),
    buildGameData: createQuery(
      ["data", "buildGameData"],
      ({ gameSlug }: { gameSlug: string }) =>
        apiGet<unknown>(`/game/${gameSlug}/api/data`),
    ),
  },

  // ── useUtils hook ──
  useUtils,
};

// ===== useUtils hook — mirrors trpc.useUtils() =====

function useUtils() {
  const queryClient = useQueryClient();

  return useMemo(() => {
    function branch<T>(
      keyPrefix: readonly string[],
      fetcher?: (input: T) => Promise<unknown>,
    ) {
      return createUtilsBranch<T>(queryClient, keyPrefix, fetcher);
    }

    function entityUtils(name: string, basePath: string) {
      return {
        list: branch<{ gameId: string }>(
          [name, "list"],
          ({ gameId }) => apiGet(`${basePath}`, { gameId }),
        ),
        get: branch<{ gameId: string; id: string }>(
          [name, "get"],
          ({ gameId, id }) => apiGet(`${basePath}/${id}`, { gameId }),
        ),
      };
    }

    return {
      auth: {
        login: branch(["auth", "login"]),
        register: branch(["auth", "register"]),
      },
      user: {
        getProfile: branch(
          ["user", "getProfile"],
          () => apiGet("/api/user/profile"),
        ),
      },
      game: {
        list: branch(["game", "list"], () => apiGet("/api/game")),
        get: branch<{ id: string }>(
          ["game", "get"],
          ({ id }) => apiGet(`/api/game/${id}`),
        ),
      },
      magic: entityUtils("magic", "/api/magic"),
      goods: entityUtils("goods", "/api/goods"),
      level: entityUtils("level", "/api/level"),
      player: entityUtils("player", "/api/player"),
      shop: entityUtils("shop", "/api/shop"),
      npc: {
        ...entityUtils("npc", "/api/npc"),
        resource: entityUtils("npcResource", "/api/npc/resource"),
      },
      npcResource: entityUtils("npcResource", "/api/npc/resource"),
      objResource: entityUtils("objResource", "/api/obj/resource"),
      obj: {
        ...entityUtils("obj", "/api/obj"),
        resource: entityUtils("objResource", "/api/obj/resource"),
      },
      scene: entityUtils("scene", "/api/scene"),
      talk: {
        get: branch<{ gameId: string }>(
          ["talk", "get"],
          ({ gameId }) => apiGet("/api/talk", { gameId }),
        ),
        search: branch<Record<string, string | number>>(
          ["talk", "search"],
          (input) => apiGet("/api/talk/search", input),
        ),
      },
      talkPortrait: {
        get: branch<{ gameId: string }>(
          ["talkPortrait", "get"],
          ({ gameId }) => apiGet("/api/talk-portrait", { gameId }),
        ),
      },
      gameConfig: {
        get: branch<{ gameId: string }>(
          ["gameConfig", "get"],
          ({ gameId }) => apiGet("/api/game-config", { gameId }),
        ),
      },
      save: {
        list: branch<{ gameSlug: string }>(
          ["save", "list"],
          ({ gameSlug }) => apiGet("/api/save", { gameSlug }),
        ),
        get: branch<{ gameSlug: string; saveId: string }>(
          ["save", "get"],
          ({ gameSlug, saveId }) => apiGet(`/api/save/${saveId}`, { gameSlug }),
        ),
        getShared: branch<{ gameSlug: string; shareCode: string }>(
          ["save", "getShared"],
          ({ gameSlug, shareCode }) =>
            apiGet(`/game/${gameSlug}/api/save/shared/${shareCode}`),
        ),
        adminList: branch<Record<string, string | number>>(
          ["save", "adminList"],
          (input) => apiGet("/api/save/admin", input),
        ),
        adminGet: branch<{ saveId: string }>(
          ["save", "adminGet"],
          ({ saveId }) => apiGet(`/api/save/admin/${saveId}`),
        ),
      },
      file: {
        list: branch<{ gameId: string; parentId?: string }>(
          ["file", "list"],
          ({ gameId, parentId }) => apiGet("/api/file", { gameId, parentId }),
        ),
        get: branch<{ gameId: string; id: string }>(
          ["file", "get"],
          ({ gameId, id }) => apiGet(`/api/file/${id}`, { gameId }),
        ),
        getDownloadUrl: branch<{ gameId: string; id: string }>(
          ["file", "getDownloadUrl"],
          ({ gameId, id }) =>
            apiGet(`/api/file/download-url/${id}`, { gameId }),
        ),
      },
    };
  }, [queryClient]);
}

export type Api = typeof api;
export type ApiUtils = ReturnType<typeof useUtils>;
