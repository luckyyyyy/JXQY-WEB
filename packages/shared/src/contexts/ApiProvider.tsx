/**
 * API Provider 组件 — 替代 TRPCProvider
 *
 * 包含 QueryClientProvider + 全局错误处理，配置与原 TRPCProvider 完全一致。
 */
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../lib/api-client";
import { ToastProvider, useToast } from "./ToastContext";

interface ApiProviderProps {
  children: ReactNode;
}

/**
 * 从 API 错误中提取用户友好的错误消息
 */
function useExtractErrorMessage() {
  const { t } = useTranslation();

  return (error: unknown): string => {
    if (error instanceof ApiError) {
      const { code, message } = error;

      if (code === "UNAUTHORIZED") return t("errors.common.unauthorized");
      if (code === "FORBIDDEN") return t("errors.common.forbidden");
      if (code === "NOT_FOUND") return t("errors.common.notFound");
      if (code === "BAD_REQUEST") return message || t("errors.common.badRequest");
      if (code === "INTERNAL_SERVER_ERROR") return t("errors.common.serverError");

      if (message.includes("fetch") || message.includes("network")) {
        return t("errors.common.networkError");
      }

      return message || t("errors.common.operationFailed");
    }

    if (error instanceof Error) {
      return error.message;
    }

    return t("errors.common.unknownError");
  };
}

/**
 * 内部 Provider，用于访问 Toast context
 */
function ApiProviderInner({ children }: ApiProviderProps) {
  const toast = useToast();
  const extractErrorMessage = useExtractErrorMessage();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 分钟
            retry: 1,
          },
          mutations: {
            retry: false,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            // 已有数据时才显示 toast（后台刷新失败）
            if (query.state.data !== undefined) {
              toast.error(extractErrorMessage(error));
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // 如果 mutation 自定义了 onError，不显示全局 toast
            if (mutation.options.onError) {
              return;
            }
            toast.error(extractErrorMessage(error));
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export function ApiProvider({ children }: ApiProviderProps) {
  return (
    <ToastProvider>
      <ApiProviderInner>{children}</ApiProviderInner>
    </ToastProvider>
  );
}
