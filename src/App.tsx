import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { DeviceProvider } from "./contexts";
import { GameScreen, LandingPage, MapViewerScreen, NotFoundPage } from "./pages";

export default function App() {
  return (
    <DeviceProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/game" element={<GameScreen />} />
          <Route path="/viewer" element={<MapViewerScreen />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </DeviceProvider>
  );
}
