import { DashboardApp } from "@miu2d/dashboard";
import { GameScreen } from "@miu2d/game";
import { ApiProvider, AuthProvider, DeviceProvider, ThemeProvider } from "@miu2d/shared";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/landing";
import NotFoundPage from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  return (
    <ApiProvider>
      <AuthProvider>
        <ThemeProvider>
          <DeviceProvider>
            <Router>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/game/:gameSlug" element={<GameScreen />} />
                <Route path="/game/:gameSlug/share/:shareCode" element={<GameScreen />} />
                <Route path="/dashboard/*" element={<DashboardApp />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Router>
          </DeviceProvider>
        </ThemeProvider>
      </AuthProvider>
    </ApiProvider>
  );
}
