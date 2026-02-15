/**
 * tRPC Provider 组件
 * 包含全局错误处理
 */
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc, trpcClient } from "../lib/trpc";
import { ToastProvider, useToast } from "./ToastContext";

interface TRPCProviderProps {
  children: ReactNode;
}

/**
 * 从 tRPC 错误中提取用户友好的错误消息
 */
function useExtractErrorMessage() {
  const { t } = useTranslation();

  return (error: unknown): string => {
    if (error instanceof TRPCClientError) {
      // 优先使用服务端返回的消息（通常已经是翻译后的）
      const message = error.message;

      // 处理常见错误码，使用 i18n
      if (error.data?.code === "UNAUTHORIZED") {
        return t("errors.common.unauthorized");
      }
      if (error.data?.code === "FORBIDDEN") {
        return t("errors.common.forbidden");
      }
      if (error.data?.code === "NOT_FOUND") {
        return t("errors.common.notFound");
      }
      if (error.data?.code === "BAD_REQUEST") {
        return message || t("errors.common.badRequest");
      }
      if (error.data?.code === "INTERNAL_SERVER_ERROR") {
        return t("errors.common.serverError");
      }

      // 网络错误
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
function TRPCProviderInner({ children }: TRPCProviderProps) {
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
            // mutation 默认不重试
            retry: false,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            // 只对已有数据的查询显示错误（后台刷新失败）
            // 首次加载失败由组件自己处理
            if (query.state.data !== undefined) {
              toast.error(extractErrorMessage(error));
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // 如果 mutation 有自定义 onError，跳过全局处理
            if (mutation.options.onError) {
              return;
            }
            toast.error(extractErrorMessage(error));
          },
        }),
      })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  return (
    <ToastProvider>
      <TRPCProviderInner>{children}</TRPCProviderInner>
    </ToastProvider>
  );
}
