/**
 * REST API client — replaces tRPC client.
 *
 * Usage:
 *   import { api } from "@miu2d/shared/lib/api";
 *   const { data } = api.magic.list.useQuery({ gameId });
 *   const mutation = api.magic.create.useMutation();
 */

// ===== Core fetch helper =====

export const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:4000";
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const base = getBaseUrl();
  const url = new URL(`${base}${path}`);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const options: RequestInit = {
    method,
    credentials: "include",
    headers: {} as Record<string, string>,
  };

  if (body !== undefined) {
    (options.headers as Record<string, string>)["Content-Type"] =
      "application/json";
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(url.toString(), options);

  if (!resp.ok) {
    let code = "UNKNOWN";
    let message = `HTTP ${resp.status}`;
    try {
      const errorBody = await resp.json();
      if (errorBody?.error) {
        code = errorBody.error.code || code;
        message = errorBody.error.message || message;
      }
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiError(resp.status, code, message);
  }

  // Handle empty responses (204)
  if (resp.status === 204) {
    return null as T;
  }

  return resp.json();
}

// Convenience helpers
function get<T>(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
) {
  return apiFetch<T>("GET", path, undefined, query);
}

function post<T>(path: string, body?: unknown) {
  return apiFetch<T>("POST", path, body);
}

function put<T>(path: string, body?: unknown) {
  return apiFetch<T>("PUT", path, body);
}

function del<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>) {
  return apiFetch<T>("DELETE", path, body, query);
}

// ===== API endpoint definitions =====

export const apiClient = {
  // Auth
  auth: {
    login: (input: { email: string; password: string }) =>
      post<{ user: unknown }>("/api/auth/login", input),
    register: (input: { name: string; email: string; password: string }) =>
      post<{ user: unknown }>("/api/auth/register", input),
    logout: () => post<void>("/api/auth/logout"),
  },

  // User
  user: {
    getProfile: () => get<unknown>("/api/user/profile"),
    updateSettings: (input: unknown) => put<unknown>("/api/user/settings", input),
    changeName: (input: { name: string }) =>
      put<unknown>("/api/user/name", input),
    changePassword: (input: { currentPassword: string; newPassword: string }) =>
      put<unknown>("/api/user/password", input),
    requestEmailVerification: () =>
      post<unknown>("/api/user/verify-email"),
  },

  // Game
  game: {
    list: () => get<unknown[]>("/api/game"),
    get: (id: string) => get<unknown>(`/api/game/${id}`),
    create: (input: { name: string }) =>
      post<unknown>("/api/game", input),
    update: (id: string, input: unknown) =>
      put<unknown>(`/api/game/${id}`, input),
    delete: (id: string) => del<unknown>(`/api/game/${id}`),
  },

  // File
  file: {
    list: (q: { game_id: string; parent_id?: string }) =>
      get<unknown[]>("/api/file", q),
    get: (id: string, gameId: string) =>
      get<unknown>(`/api/file/${id}`, { game_id: gameId }),
    getPath: (id: string, gameId: string) =>
      get<unknown[]>(`/api/file/${id}/path`, { game_id: gameId }),
    createFolder: (input: { game_id: string; name: string; parent_id?: string }) =>
      post<unknown>("/api/file/folder", input),
    prepareUpload: (input: {
      game_id: string;
      name: string;
      parent_id?: string;
      mime_type?: string;
      size?: number;
    }) => post<{ file: unknown; uploadUrl: string }>("/api/file/prepare-upload", input),
    confirmUpload: (input: { game_id: string; file_id: string }) =>
      post<unknown>("/api/file/confirm-upload", input),
    getDownloadUrl: (id: string, gameId: string) =>
      get<{ url: string }>(`/api/file/download-url/${id}`, { game_id: gameId }),
    getUploadUrl: (input: { game_id: string }) =>
      post<{ url: string; storageKey: string }>("/api/file/upload-url", input),
    rename: (id: string, input: { game_id: string; name: string }) =>
      put<unknown>(`/api/file/rename/${id}`, input),
    move: (id: string, input: { game_id: string; parent_id?: string }) =>
      put<unknown>(`/api/file/move/${id}`, input),
    delete: (id: string, gameId: string) =>
      del<unknown>(`/api/file/${id}`, undefined, { game_id: gameId }),
    batchPrepareUpload: (input: {
      game_id: string;
      files: { name: string; parent_id?: string; mime_type?: string; size?: number }[];
    }) => post<unknown[]>("/api/file/batch-prepare-upload", input),
    batchConfirmUpload: (input: { game_id: string; file_ids: string[] }) =>
      post<unknown>("/api/file/batch-confirm-upload", input),
    ensureFolderPath: (input: { game_id: string; path: string }) =>
      post<unknown>("/api/file/ensure-folder-path", input),
  },

  // Game Config
  gameConfig: {
    get: (gameId: string) =>
      get<unknown>("/api/game-config", { game_id: gameId }),
    update: (input: { game_id: string; data: unknown }) =>
      put<unknown>("/api/game-config", input),
  },

  // ===== CRUD entities (magic, goods, level, npc, obj, player, shop) =====
  magic: createCrudClient("/api/magic"),
  goods: createCrudClient("/api/goods"),
  level: createCrudClient("/api/level"),
  player: createCrudClient("/api/player"),
  shop: createCrudClient("/api/shop"),

  npc: {
    ...createCrudClient("/api/npc"),
    resource: createCrudClient("/api/npc/npc-resource"),
  },

  obj: {
    ...createCrudClient("/api/obj"),
    resource: createCrudClient("/api/obj/obj-resource"),
  },

  // Scene
  scene: {
    ...createCrudClient("/api/scene"),
    importScene: (input: { game_id: string; scenes: unknown[] }) =>
      post<unknown[]>("/api/scene/import", input),
    clearAll: (input: { game_id: string }) =>
      post<unknown>("/api/scene/clear-all", input),
  },

  // Talk (singleton)
  talk: {
    get: (gameId: string) =>
      get<unknown>("/api/talk", { game_id: gameId }),
    search: (q: {
      game_id: string;
      portrait_index?: number;
      query?: string;
      page?: number;
      page_size?: number;
    }) => get<unknown>("/api/talk/search", q as Record<string, string | number>),
    update: (input: { game_id: string; entries: unknown[] }) =>
      put<unknown>("/api/talk", input),
    addEntry: (input: { game_id: string; entry: unknown }) =>
      post<unknown>("/api/talk/entry", input),
    updateEntry: (entryId: number, input: { game_id: string; entry: unknown }) =>
      put<unknown>(`/api/talk/entry/${entryId}`, input),
    deleteEntry: (entryId: number, gameId: string) =>
      del<unknown>(`/api/talk/entry/${entryId}`, undefined, { game_id: gameId }),
    importFromTxt: (input: { game_id: string; entries: unknown[] }) =>
      post<unknown>("/api/talk/import", input),
  },

  // Talk Portrait (singleton)
  talkPortrait: {
    get: (gameId: string) =>
      get<unknown>("/api/talk-portrait", { game_id: gameId }),
    update: (input: { game_id: string; entries: unknown[] }) =>
      put<unknown>("/api/talk-portrait", input),
    importFromIni: (input: { game_id: string; entries: unknown[] }) =>
      post<unknown>("/api/talk-portrait/import", input),
  },

  // Save
  save: {
    list: (gameSlug: string) =>
      get<unknown[]>("/api/save", { game_slug: gameSlug }),
    get: (id: string, gameId: string) =>
      get<unknown>(`/api/save/${id}`, { game_id: gameId }),
    upsert: (input: unknown) => post<unknown>("/api/save", input),
    delete: (id: string, gameId: string) =>
      del<unknown>(`/api/save/${id}`, undefined, { game_id: gameId }),
    share: (input: { game_id: string; save_id: string }) =>
      post<unknown>("/api/save/share", input),
    getShared: (gameSlug: string, shareCode: string) =>
      get<unknown>(`/game/${gameSlug}/api/save/shared/${shareCode}`),
    // Admin
    adminList: (q: Record<string, string | number>) =>
      get<unknown>("/api/save/admin", q),
    adminGet: (id: string) => get<unknown>(`/api/save/admin/${id}`),
    adminCreate: (input: unknown) =>
      post<unknown>("/api/save/admin", input),
    adminUpdate: (id: string, input: unknown) =>
      put<unknown>(`/api/save/admin/${id}`, input),
    adminDelete: (id: string) => del<unknown>(`/api/save/admin/${id}`),
    adminShare: (input: { save_id: string }) =>
      post<unknown>("/api/save/admin/share", input),
  },

  // Data aggregation (public)
  data: {
    buildGameData: (gameSlug: string) =>
      get<unknown>(`/game/${gameSlug}/api/data`),
  },
};

// ===== Factory for standard CRUD entity endpoints =====

function createCrudClient(basePath: string) {
  return {
    list: (gameId: string, filters?: Record<string, string | number | boolean>) =>
      get<unknown[]>(basePath, { game_id: gameId, ...filters }),
    get: (id: string, gameId: string) =>
      get<unknown>(`${basePath}/${id}`, { game_id: gameId }),
    create: (input: unknown) => post<unknown>(basePath, input),
    update: (id: string, input: unknown) =>
      put<unknown>(`${basePath}/${id}`, input),
    delete: (id: string, gameId: string) =>
      del<unknown>(`${basePath}/${id}`, undefined, { game_id: gameId }),
    batchImport: (input: { game_id: string; items: unknown[] }) =>
      post<unknown>(`${basePath}/batch-import`, input),
  };
}

export type ApiClient = typeof apiClient;
