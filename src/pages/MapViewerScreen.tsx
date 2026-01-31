import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapViewer } from "../components";
import { MAPS } from "../constants/maps";

// Icons as simple SVG components
const ArrowLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const MapPinIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export default function MapViewerScreen() {
  const navigate = useNavigate();
  const [viewerMapIndex, setViewerMapIndex] = useState(1);
  const [currentMapName, setCurrentMapName] = useState("");

  const handleMapLoaded = useCallback((mapName: string) => {
    setCurrentMapName(mapName);
  }, []);

  const handleMapSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewerMapIndex(Number(e.target.value));
  };

  return (
    <div className="w-full h-full relative">
      <div className="w-full h-full">
        <MapViewer mapPath={MAPS[viewerMapIndex].path} onMapLoaded={handleMapLoaded} />
      </div>

      {/* Top Control Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pointer-events-auto"
        >
          <div className="bg-gray-900/80 backdrop-blur-md rounded-xl shadow-lg border border-gray-700/50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
                >
                  <ArrowLeftIcon />
                  返回标题
                </motion.button>

                <div className="flex items-center">
                  <button
                    onClick={() => setViewerMapIndex((i) => (i - 1 + MAPS.length) % MAPS.length)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-l-lg border-r border-gray-600 transition-colors"
                  >
                    <ChevronLeftIcon />
                    上一张
                  </button>

                  <select
                    value={viewerMapIndex}
                    onChange={handleMapSelect}
                    className="min-w-[200px] px-3 py-2 bg-gray-700 text-white border-x border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {MAPS.map((map, index) => (
                      <option key={map.path} value={index}>
                        📍 {map.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setViewerMapIndex((i) => (i + 1) % MAPS.length)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-r-lg border-l border-gray-600 transition-colors"
                  >
                    下一张
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 rounded-lg">
                <span className="text-gray-400 text-sm">控制:</span>
                {["W", "A", "S", "D"].map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded text-xs font-mono border border-gray-600"
                  >
                    {key}
                  </kbd>
                ))}
                <span className="text-gray-500 text-sm">或方向键</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="pointer-events-auto"
        >
          <div className="relative">
            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full z-10">
              {viewerMapIndex + 1}/{MAPS.length}
            </span>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 backdrop-blur-md rounded-lg shadow-lg border border-gray-700/50">
              <MapPinIcon />
              <span className="text-sm text-gray-200">{currentMapName || "加载中..."}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
