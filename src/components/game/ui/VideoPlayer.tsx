/**
 * VideoPlayer - Full screen video player component
 * C# Reference: ScriptExecuter.PlayMovie using XNA VideoPlayer
 *
 * Uses HTML5 Video element for Web implementation
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { GameEvents, type UIVideoPlayEvent } from "@/engine/core/gameEvents";
import type { GameEngine } from "@/engine/game";
import { ResourcePath } from "@/config/resourcePaths";

interface VideoPlayerProps {
  engine: GameEngine | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ engine }) => {
  const [videoFile, setVideoFile] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const events = engine?.events;

  // Handle video playback request
  const handleVideoPlay = useCallback((event: UIVideoPlayEvent) => {
    const { file } = event;
    // Build video path - videos are in Content/video folder
    const videoPath = ResourcePath.video(file);
    setVideoFile(videoPath);
    setIsVisible(true);
  }, []);

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    setIsVisible(false);
    setVideoFile(null);
    // Emit video end event so scripts can continue
    events?.emit(GameEvents.UI_VIDEO_END, {});
  }, [events]);

  // Handle click to skip video
  const handleClick = useCallback(() => {
    handleVideoEnd();
  }, [handleVideoEnd]);

  // Handle keyboard to skip video
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isVisible && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) {
        handleVideoEnd();
      }
    },
    [isVisible, handleVideoEnd]
  );

  // Subscribe to video play events
  useEffect(() => {
    if (!events) return;

    events.on(GameEvents.UI_VIDEO_PLAY, handleVideoPlay);

    return () => {
      events.off(GameEvents.UI_VIDEO_PLAY, handleVideoPlay);
    };
  }, [events, handleVideoPlay]);

  // Add keyboard listener
  useEffect(() => {
    if (isVisible) {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isVisible, handleKeyDown]);

  // Auto-play when video file changes
  useEffect(() => {
    if (videoFile && videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn("[VideoPlayer] Autoplay failed:", err);
        // If autoplay fails, just end the video (browser policy)
        handleVideoEnd();
      });
    }
  }, [videoFile, handleVideoEnd]);

  if (!isVisible || !videoFile) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onClick={handleClick}
    >
      <video
        ref={videoRef}
        src={videoFile}
        className="max-w-full max-h-full"
        onEnded={handleVideoEnd}
        onError={handleVideoEnd}
        playsInline
        autoPlay
      />
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm">
        点击或按任意键跳过
      </div>
    </div>
  );
};

export default VideoPlayer;
