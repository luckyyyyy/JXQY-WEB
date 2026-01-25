import { useState, useCallback, useEffect } from "react";
import { MapViewer, Game } from "./components";

// =============================================================================
// Game Modes
// =============================================================================
type GameMode = "title" | "game" | "viewer";

// =============================================================================
// Map Definitions
// =============================================================================
const MAPS = [
  { name: "凌绝峰连接地图", path: "/resources/map/map_001_凌绝峰连接地图.map" },
  { name: "凌绝峰峰顶", path: "/resources/map/map_002_凌绝峰峰顶.map" },
  { name: "武当山下", path: "/resources/map/map_003_武当山下.map" },
  { name: "武当山连接地图", path: "/resources/map/map_004_武当山连接地图.map" },
  { name: "洗剑池", path: "/resources/map/map_005_洗剑池.map" },
  { name: "武当山山顶", path: "/resources/map/map_006_武当山山顶.map" },
  { name: "连接地图 007", path: "/resources/map/map_007_连接地图.map" },
  { name: "野树林", path: "/resources/map/map_008_野树林.map" },
  { name: "山洞内部 009", path: "/resources/map/map_009_山洞内部.map" },
  { name: "山洞内部 010", path: "/resources/map/map_010_山洞内部.map" },
  { name: "连接地图 011", path: "/resources/map/map_011_连接地图.map" },
  { name: "惠安镇", path: "/resources/map/map_012_惠安镇.map" },
];

// =============================================================================
// Styles
// =============================================================================
const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#0a0a14",
    overflow: "hidden",
  } as React.CSSProperties,

  // Title screen
  titleScreen: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #0a1628 0%, #1a0a28 100%)",
  } as React.CSSProperties,
  titleLogo: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#ffd700",
    textShadow: "0 4px 20px rgba(255, 215, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.3)",
    marginBottom: 60,
    letterSpacing: 8,
  } as React.CSSProperties,
  titleMenu: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } as React.CSSProperties,
  menuButton: {
    padding: "16px 48px",
    fontSize: 18,
    color: "#e8e8e8",
    backgroundColor: "rgba(40, 60, 100, 0.6)",
    border: "2px solid rgba(100, 140, 200, 0.5)",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s ease",
    minWidth: 200,
    textAlign: "center" as const,
  } as React.CSSProperties,
  menuButtonHover: {
    backgroundColor: "rgba(60, 90, 140, 0.8)",
    borderColor: "rgba(140, 180, 240, 0.8)",
    transform: "scale(1.05)",
  } as React.CSSProperties,

  // Game / Viewer common
  mapContainer: {
    width: "100%",
    height: "100%",
  } as React.CSSProperties,
  gameContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  // Viewer overlay
  uiOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    padding: "16px",
    pointerEvents: "none" as const,
  } as React.CSSProperties,
  controlsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
  controlsLeft: {
    pointerEvents: "auto" as const,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,
  button: {
    padding: "8px 16px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s",
  } as React.CSSProperties,
  modeButton: {
    padding: "8px 16px",
    backgroundColor: "#059669",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s",
  } as React.CSSProperties,
  mapSelectButton: {
    padding: "8px 16px",
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    minWidth: "180px",
  } as React.CSSProperties,
  instructions: {
    pointerEvents: "auto" as const,
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    color: "white",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "14px",
  } as React.CSSProperties,
  mapList: {
    pointerEvents: "auto" as const,
    marginTop: "8px",
    backgroundColor: "rgba(31, 41, 55, 0.95)",
    borderRadius: "8px",
    maxHeight: "384px",
    overflowY: "auto" as const,
    width: "256px",
  } as React.CSSProperties,
  mapListItem: {
    width: "100%",
    textAlign: "left" as const,
    padding: "8px 16px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    display: "block",
  } as React.CSSProperties,
  statusBar: {
    position: "absolute" as const,
    bottom: "16px",
    left: "16px",
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    color: "white",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "14px",
  } as React.CSSProperties,
};

// =============================================================================
// App Component
// =============================================================================
export default function App() {
  const [viewerMapIndex, setViewerMapIndex] = useState(1);
  const [showMapList, setShowMapList] = useState(false);
  const [currentMapName, setCurrentMapName] = useState("");
  const [mode, setMode] = useState<GameMode>("title");
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Update window size
  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: Math.min(window.innerWidth, 1280),
        height: Math.min(window.innerHeight - 20, 720),
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleMapLoaded = useCallback((mapName: string) => {
    setCurrentMapName(mapName);
  }, []);

  const handleMapSelect = (index: number) => {
    setViewerMapIndex(index);
    setShowMapList(false);
  };

  // Title Screen
  const renderTitleScreen = () => (
    <div style={styles.titleScreen}>
      <div style={styles.titleLogo}>剑侠情缘</div>
      <div style={styles.titleMenu as React.CSSProperties}>
        <button
          style={{
            ...styles.menuButton,
            ...(hoveredButton === "new" ? styles.menuButtonHover : {}),
          }}
          onMouseEnter={() => setHoveredButton("new")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => setMode("game")}
        >
          🎮 开始新游戏
        </button>
        <button
          style={{
            ...styles.menuButton,
            ...(hoveredButton === "load" ? styles.menuButtonHover : {}),
            opacity: 0.5,
            cursor: "not-allowed",
          }}
          onMouseEnter={() => setHoveredButton("load")}
          onMouseLeave={() => setHoveredButton(null)}
          disabled
        >
          📂 读取存档
        </button>
        <button
          style={{
            ...styles.menuButton,
            ...(hoveredButton === "viewer" ? styles.menuButtonHover : {}),
          }}
          onMouseEnter={() => setHoveredButton("viewer")}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => setMode("viewer")}
        >
          🗺️ 地图查看器
        </button>
      </div>
      <div style={{ marginTop: 60, color: "#666", fontSize: 14 }}>
        Web版复刻 - 基于 JxqyHD 引擎
      </div>
    </div>
  );

  // Game Screen
  const renderGameScreen = () => (
    <div style={styles.gameContainer}>
      <Game
        initialMapPath="/resources/map/map_002_凌绝峰峰顶.map"
        width={windowSize.width}
        height={windowSize.height}
        runInitScript={true}
      />
      {/* Return to title button */}
      <div style={{ position: "absolute", top: 16, left: 16, pointerEvents: "auto", zIndex: 100 }}>
        <button
          onClick={() => setMode("title")}
          style={{
            ...styles.button,
            backgroundColor: "#6b7280",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#4b5563")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#6b7280")}
        >
          ← 返回标题
        </button>
      </div>
    </div>
  );

  // Viewer Screen
  const renderViewerScreen = () => (
    <>
      <div style={styles.mapContainer}>
        <MapViewer
          mapPath={MAPS[viewerMapIndex].path}
          onMapLoaded={handleMapLoaded}
        />
      </div>

      <div style={styles.uiOverlay}>
        <div style={styles.controlsRow}>
          <div style={styles.controlsLeft}>
            <button
              onClick={() => setMode("title")}
              style={styles.modeButton}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#047857")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
            >
              ← 返回标题
            </button>
            <button
              onClick={() => setViewerMapIndex((i) => (i - 1 + MAPS.length) % MAPS.length)}
              style={styles.button}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
            >
              ◀ 上一张
            </button>
            <button
              onClick={() => setShowMapList(!showMapList)}
              style={styles.mapSelectButton}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(55, 65, 81, 0.9)")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "rgba(31, 41, 55, 0.9)")}
            >
              📍 {MAPS[viewerMapIndex].name}
            </button>
            <button
              onClick={() => setViewerMapIndex((i) => (i + 1) % MAPS.length)}
              style={styles.button}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
            >
              下一张 ▶
            </button>
          </div>
          <div style={styles.instructions}>
            使用 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 或方向键移动视角
          </div>
        </div>

        {showMapList && (
          <div style={styles.mapList}>
            {MAPS.map((map, index) => (
              <button
                key={map.path}
                onClick={() => handleMapSelect(index)}
                style={{
                  ...styles.mapListItem,
                  backgroundColor: index === viewerMapIndex ? "#2563eb" : "transparent",
                  color: index === viewerMapIndex ? "white" : "#e5e7eb",
                }}
                onMouseOver={(e) => {
                  if (index !== viewerMapIndex) e.currentTarget.style.backgroundColor = "#374151";
                }}
                onMouseOut={(e) => {
                  if (index !== viewerMapIndex) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {map.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={styles.statusBar}>当前地图: {currentMapName || "加载中..."}</div>
    </>
  );

  return (
    <div style={styles.container}>
      {mode === "title" && renderTitleScreen()}
      {mode === "game" && renderGameScreen()}
      {mode === "viewer" && renderViewerScreen()}
    </div>
  );
}
