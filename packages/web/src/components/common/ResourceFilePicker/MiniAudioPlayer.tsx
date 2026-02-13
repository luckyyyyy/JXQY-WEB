/**
 * 迷你音频播放器
 * 只有一个播放/停止按钮，用于紧凑的资源选择器
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { parseXnbAudio, xnbToAudioBuffer } from "@miu2d/engine/resource/format/xnb";

interface MiniAudioPlayerProps {
  gameSlug: string;
  path: string;
}

// Web Audio API context（懒加载）
let audioContextInstance: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioContextInstance) {
    audioContextInstance = new AudioContext();
  }
  return audioContextInstance;
}

export function MiniAudioPlayer({ gameSlug, path }: MiniAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isXnb, setIsXnb] = useState(false);

  // 加载音频
  useEffect(() => {
    if (!path) return;

    setIsLoaded(false);
    setIsPlaying(false);

    const lowerPath = path.toLowerCase();
    const url = `/game/${gameSlug}/resources/${lowerPath}`;

    if (lowerPath.endsWith(".xnb")) {
      // XNB 格式
      setIsXnb(true);

      const loadXnb = async () => {
        try {
          const response = await fetch(url);
          if (!response.ok) return;
          const buffer = await response.arrayBuffer();

          const xnbResult = parseXnbAudio(buffer);
          if (!xnbResult.success || !xnbResult.data) return;

          const ctx = getAudioContext();
          audioBufferRef.current = xnbToAudioBuffer(xnbResult.data, ctx);
          setIsLoaded(true);
        } catch {
          // 静默失败
        }
      };

      loadXnb();
    } else {
      // 普通音频
      setIsXnb(false);

      // 尝试 OGG 格式
      let audioUrl = url;
      if (lowerPath.endsWith(".wav")) {
        audioUrl = url.replace(/\.wav$/, ".ogg");
      }

      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = audioUrl;

      audio.onloadedmetadata = () => setIsLoaded(true);
      audio.onerror = () => {
        // 回退到原始格式
        if (audioUrl !== url) {
          audio.src = url;
          audio.load();
        }
      };
      audio.onended = () => setIsPlaying(false);

      audioRef.current = audio;
    }

    return () => {
      // 清理
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
    };
  }, [gameSlug, path]);

  // 播放/停止
  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (isXnb) {
      // XNB 使用 Web Audio API
      if (isPlaying) {
        if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
          sourceNodeRef.current = null;
        }
        setIsPlaying(false);
      } else if (audioBufferRef.current) {
        const ctx = getAudioContext();
        const source = ctx.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.connect(ctx.destination);
        source.onended = () => {
          setIsPlaying(false);
          sourceNodeRef.current = null;
        };
        source.start();
        sourceNodeRef.current = source;
        setIsPlaying(true);
      }
    } else {
      // 普通音频
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
      } else {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, [isPlaying, isXnb]);

  return (
    <button
      type="button"
      onClick={togglePlay}
      disabled={!isLoaded}
      className={`w-6 h-6 flex items-center justify-center rounded flex-shrink-0 transition-colors ${
        isLoaded
          ? isPlaying
            ? "bg-[#0098ff] text-white"
            : "bg-[#3c3c3c] hover:bg-[#4c4c4c] text-[#cccccc]"
          : "bg-[#2d2d2d] text-[#606060] cursor-not-allowed"
      }`}
      title={isPlaying ? "停止" : "播放"}
    >
      {isPlaying ? (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <rect x="2" y="2" width="3" height="8" />
          <rect x="7" y="2" width="3" height="8" />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 2l7 4-7 4V2z" />
        </svg>
      )}
    </button>
  );
}
