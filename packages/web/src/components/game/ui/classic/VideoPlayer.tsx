/**
 * VideoPlayer - Full screen video player component
 * using XNA VideoPlayer
 *
 * Uses HTML5 Video element for Web implementation
 * Features: progress bar, volume control, pause/play, seek
 */

import { ResourcePath } from "@miu2d/engine/resource/resource-paths";
import { GameEvents, type UIVideoPlayEvent } from "@miu2d/engine/core/game-events";
import { logger } from "@miu2d/engine/core/logger";
import type { GameEngine } from "@miu2d/engine/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadAudioSettings, saveAudioSettings } from "@/components/common";

interface VideoPlayerProps {
  engine: GameEngine | null;
}

/**
 * Convert video filename to browser-supported format
 * Original game uses .avi/.wmv, we convert to .webm
 */
function normalizeVideoPath(file: string): string {
  const baseName = file.replace(/\.(wmv|avi|mov|mp4)$/i, "").toLowerCase();
  return ResourcePath.video(`${baseName}.webm`);
}

/** Format seconds to MM:SS */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ engine }) => {
  const [videoFile, setVideoFile] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolume] = useState(0); // 默认静音
  const [isMuted, setIsMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Load saved volume on mount
  useEffect(() => {
    const settings = loadAudioSettings();
    setVolume(settings.videoVolume);
    setIsMuted(settings.videoVolume === 0);
  }, []);

  // Handle video playback request
  const handleVideoPlay = useCallback((event: UIVideoPlayEvent) => {
    const { file } = event;
    logger.log(`[VideoPlayer] Received video play event: ${file}`);
    const videoPath = normalizeVideoPath(file);
    setVideoFile(videoPath);
    setIsVisible(true);
    setIsPaused(false);
  }, []);

  // Handle video end - use engine directly to avoid stale closure
  const handleVideoEnd = useCallback(() => {
    logger.log("[VideoPlayer] Video ended, emitting UI_VIDEO_END event");
    setIsVisible(false);
    setVideoFile(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPaused(false);
    // Emit video end event so scripts can continue
    if (engine?.events) {
      engine.events.emit(GameEvents.UI_VIDEO_END, {});
    } else {
      logger.warn("[VideoPlayer] Cannot emit UI_VIDEO_END: engine.events not available");
    }
  }, [engine]);

  // Update progress bar and time
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && !isDragging) {
      const { currentTime: ct, duration: dur } = videoRef.current;
      setCurrentTime(ct);
      if (dur > 0) {
        setProgress((ct / dur) * 100);
      }
    }
  }, [isDragging]);

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // Apply saved volume
      const settings = loadAudioSettings();
      videoRef.current.volume = settings.videoVolume;
      videoRef.current.muted = settings.videoVolume === 0;
    }
  }, []);

  // Toggle pause/play
  const handleTogglePause = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (videoRef.current) {
        if (isPaused) {
          videoRef.current.play();
          setIsPaused(false);
        } else {
          videoRef.current.pause();
          setIsPaused(true);
        }
      }
    },
    [isPaused]
  );

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
    saveAudioSettings({ videoVolume: newVolume });
  }, []);

  // Toggle mute
  const handleToggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      if (videoRef.current) {
        videoRef.current.muted = newMuted;
      }
      // If unmuting and volume is 0, set to a reasonable default
      if (!newMuted && volume === 0) {
        const defaultVolume = 0.5;
        setVolume(defaultVolume);
        if (videoRef.current) {
          videoRef.current.volume = defaultVolume;
        }
        saveAudioSettings({ videoVolume: defaultVolume });
      }
    },
    [isMuted, volume]
  );

  // Handle progress bar click/drag
  const handleProgressBarMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setIsDragging(true);
      const rect = progressBarRef.current?.getBoundingClientRect();
      if (rect && videoRef.current) {
        const pos = (e.clientX - rect.left) / rect.width;
        const newTime = pos * duration;
        videoRef.current.currentTime = newTime;
        setProgress(pos * 100);
        setCurrentTime(newTime);
      }
    },
    [duration]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && progressBarRef.current && videoRef.current) {
        const rect = progressBarRef.current.getBoundingClientRect();
        let pos = (e.clientX - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos));
        const newTime = pos * duration;
        videoRef.current.currentTime = newTime;
        setProgress(pos * 100);
        setCurrentTime(newTime);
      }
    },
    [isDragging, duration]
  );

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Show controls on mouse move, hide after timeout
  const handleMouseMoveContainer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (!isPaused && !isDragging) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPaused, isDragging]);

  // Handle skip button
  const handleSkip = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleVideoEnd();
    },
    [handleVideoEnd]
  );

  // Handle keyboard controls
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return;

      switch (e.key) {
        case "Escape":
          handleVideoEnd();
          break;
        case " ":
          e.preventDefault();
          if (videoRef.current) {
            if (isPaused) {
              videoRef.current.play();
              setIsPaused(false);
            } else {
              videoRef.current.pause();
              setIsPaused(true);
            }
          }
          break;
        case "ArrowLeft":
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          }
          break;
        case "ArrowRight":
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
          }
          break;
        case "ArrowUp":
          {
            const newVol = Math.min(1, volume + 0.1);
            setVolume(newVol);
            setIsMuted(false);
            if (videoRef.current) {
              videoRef.current.volume = newVol;
              videoRef.current.muted = false;
            }
            saveAudioSettings({ videoVolume: newVol });
          }
          break;
        case "ArrowDown":
          {
            const newVol = Math.max(0, volume - 0.1);
            setVolume(newVol);
            setIsMuted(newVol === 0);
            if (videoRef.current) {
              videoRef.current.volume = newVol;
              videoRef.current.muted = newVol === 0;
            }
            saveAudioSettings({ videoVolume: newVol });
          }
          break;
        case "m":
        case "M":
          {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            if (videoRef.current) {
              videoRef.current.muted = newMuted;
            }
          }
          break;
      }
    },
    [isVisible, isPaused, duration, volume, isMuted, handleVideoEnd]
  );

  // Subscribe to video play events
  // Also check for pending movies that may have been requested before
  // this effect ran (race condition: engine emits UI_VIDEO_PLAY synchronously,
  // but React useEffect runs asynchronously after render commit).
  useEffect(() => {
    if (!engine) return;

    const events = engine.events;
    events.on(GameEvents.UI_VIDEO_PLAY, handleVideoPlay);

    // Check for pending movie that was emitted before we subscribed
    const pendingMovie = engine.guiManager.getPendingMovie();
    if (pendingMovie && !videoFile) {
      logger.log(`[VideoPlayer] Found pending movie on subscribe: ${pendingMovie}`);
      handleVideoPlay({ file: pendingMovie } as UIVideoPlayEvent);
    }

    return () => {
      events.off(GameEvents.UI_VIDEO_PLAY, handleVideoPlay);
    };
  }, [engine, handleVideoPlay, videoFile]);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!isVisible || !videoFile) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-[10000] bg-black flex items-center justify-center"
      style={{ pointerEvents: "auto" }}
      onMouseMove={handleMouseMoveContainer}
    >
      <video
        ref={videoRef}
        src={videoFile}
        className="max-w-full max-h-full object-contain"
        onEnded={handleVideoEnd}
        onError={handleVideoEnd}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
        autoPlay
        muted={isMuted}
      >
        <track kind="captions" />
      </video>

      {/* Controls overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Controls container */}
        <div className="relative px-4 pb-4 pt-12">
          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className="h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer group mb-3"
            onMouseDown={handleProgressBarMouseDown}
          >
            <div
              className="h-full bg-white/80 group-hover:bg-white transition-colors relative"
              style={{ width: `${progress}%` }}
            >
              {/* Drag handle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Bottom controls row */}
          <div className="flex items-center justify-between">
            {/* Left: play/pause, time */}
            <div className="flex items-center gap-3">
              {/* Play/Pause button */}
              <button
                type="button"
                onClick={handleTogglePause}
                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
                title={isPaused ? "播放 (空格)" : "暂停 (空格)"}
              >
                {isPaused ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                )}
              </button>

              {/* Time display */}
              <span className="text-white/80 text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right: volume, skip */}
            <div className="flex items-center gap-3">
              {/* Volume control */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
                  title={isMuted ? "取消静音 (M)" : "静音 (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  title="音量 (↑/↓)"
                />
              </div>

              {/* Skip button */}
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-1.5 text-white/80 hover:text-white text-sm border border-white/30 hover:border-white/60 rounded transition-colors"
                title="跳过 (Esc)"
              >
                跳过
              </button>
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="mt-2 text-center text-white/40 text-xs">
            空格 暂停 | ← → 快进快退 | ↑ ↓ 音量 | M 静音 | Esc 跳过
          </div>
        </div>
      </div>

      {/* Pause overlay */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
