import { useEffect, useRef, useCallback, useState } from "react";
import {
  createMapRenderer,
  loadMapMpcs,
  renderMap,
  updateCamera,
  setCameraSize,
  loadMap,
  type MapRenderer,
} from "../engine";

interface MapViewerProps {
  mapPath: string;
  onMapLoaded?: (mapName: string) => void;
}

const styles = {
  container: {
    position: "relative" as const,
    width: "100%",
    height: "100%",
  },
  canvas: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  loadingContent: {
    textAlign: "center" as const,
    color: "white",
  },
  loadingText: {
    fontSize: "24px",
    marginBottom: "16px",
  },
  progressBar: {
    width: "256px",
    height: "16px",
    backgroundColor: "#374151",
    borderRadius: "9999px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    transition: "width 0.3s",
  },
  progressText: {
    marginTop: "8px",
    fontSize: "14px",
  },
  errorText: {
    fontSize: "24px",
    color: "#f87171",
  },
};

export function MapViewer({ mapPath, onMapLoaded }: MapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize renderer
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = createMapRenderer();
    }
  }, []);

  // Load map when mapPath changes
  useEffect(() => {
    let cancelled = false;

    const loadMapData = async () => {
      if (!rendererRef.current) return;

      setIsLoading(true);
      setLoadProgress(0);
      setError(null);

      try {
        // Extract map name without extension
        const mapFileName = mapPath.split("/").pop() || "";
        const mapNameWithoutExt = mapFileName.replace(/\.map$/i, "");

        // Load the map file
        const mapData = await loadMap(mapPath);
        if (cancelled) return;

        if (!mapData) {
          setError("无法加载地图文件");
          setIsLoading(false);
          return;
        }

        // Load all MPC textures
        const success = await loadMapMpcs(
          rendererRef.current,
          mapData,
          mapNameWithoutExt,
          (progress) => {
            if (!cancelled) setLoadProgress(progress);
          }
        );

        if (cancelled || !success) return;

        // Center camera on map
        const renderer = rendererRef.current;
        renderer.camera.x = Math.max(
          0,
          (mapData.mapPixelWidth - renderer.camera.width) / 2
        );
        renderer.camera.y = Math.max(
          0,
          (mapData.mapPixelHeight - renderer.camera.height) / 2
        );

        setIsLoading(false);
        onMapLoaded?.(mapNameWithoutExt);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading map:", err);
        setError("加载地图时发生错误");
        setIsLoading(false);
      }
    };

    loadMapData();

    return () => {
      cancelled = true;
    };
  }, [mapPath, onMapLoaded]);

  // Handle canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;

    canvas.width = width;
    canvas.height = height;
    setCameraSize(rendererRef.current, width, height);
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();
    const cameraSpeed = 500; // pixels per second

    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const renderer = rendererRef.current;
      if (renderer && !renderer.isLoading) {
        // Handle camera movement
        let dx = 0;
        let dy = 0;

        if (keysPressed.current.has("w") || keysPressed.current.has("arrowup")) {
          dy -= cameraSpeed * deltaTime;
        }
        if (keysPressed.current.has("s") || keysPressed.current.has("arrowdown")) {
          dy += cameraSpeed * deltaTime;
        }
        if (keysPressed.current.has("a") || keysPressed.current.has("arrowleft")) {
          dx -= cameraSpeed * deltaTime;
        }
        if (keysPressed.current.has("d") || keysPressed.current.has("arrowright")) {
          dx += cameraSpeed * deltaTime;
        }

        if (dx !== 0 || dy !== 0) {
          updateCamera(renderer, dx, dy);
        }

        // Render
        renderMap(ctx, renderer);
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        tabIndex={0}
      />
      {isLoading && (
        <div style={styles.overlay}>
          <div style={styles.loadingContent}>
            <div style={styles.loadingText}>加载中...</div>
            <div style={styles.progressBar}>
              <div
                style={{ ...styles.progressFill, width: `${loadProgress * 100}%` }}
              />
            </div>
            <div style={styles.progressText}>
              {Math.round(loadProgress * 100)}%
            </div>
          </div>
        </div>
      )}
      {error && (
        <div style={styles.overlay}>
          <div style={styles.errorText}>{error}</div>
        </div>
      )}
    </div>
  );
}
