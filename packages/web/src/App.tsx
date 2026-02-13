import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { DeviceProvider, AuthProvider, TRPCProvider, ThemeProvider } from "./contexts";
import {
  DashboardApp,
  GameScreen,
  LandingPage,
  LoginPage,
  NotFoundPage,
  RegisterPage,
} from "./pages";

export default function App() {
  return (
    <TRPCProvider>
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
    </TRPCProvider>
  );
}
