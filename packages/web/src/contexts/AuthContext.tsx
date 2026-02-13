/**
 * 认证上下文
 *
 * - 页面加载时自动通过 cookie session 恢复用户状态
 * - logout 调用后端 API 清除 session
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "@miu2d/types";
import { trpc } from "../lib/trpc";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 默认 loading 直到 session 检查完

  // 页面加载时恢复 session
  const profileQuery = trpc.user.getProfile.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profileQuery.isSuccess) {
      setUser(profileQuery.data);
      setIsLoading(false);
    } else if (profileQuery.isError) {
      setUser(null);
      setIsLoading(false);
    }
  }, [profileQuery.isSuccess, profileQuery.isError, profileQuery.data]);

  const logoutMutation = trpc.auth.logout.useMutation();

  const login = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        setUser(null);
        // 跳转由使用方处理或通过 window.location
        window.location.href = "/login";
      },
    });
  }, [logoutMutation]);

  const updateUser = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
