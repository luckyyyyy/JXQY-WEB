/**
 * XNB 音频预览组件
 *
 * 使用 Web Audio API 解码和播放 XNB 格式的音频文件。
 * 支持 PCM 格式的 SoundEffect 资源。
 */

import type { XnbAudioData } from "@miu2d/engine/resource/format/xnb";
import { parseXnbAudio, xnbToWavBlob } from "@miu2d/engine/resource/format/xnb";
import { useCallback, useEffect, useRef, useState } from "react";

interface XnbAudioViewerProps {
  /** XNB 文件的二进制数据 */
  data: ArrayBuffer;
  /** 文件名 */
  fileName?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

export function XnbAudioViewer({ data, fileName, isLoading, error }: XnbAudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioData, setAudioData] = useState<XnbAudioData | null>(null);
  const [wavUrl, setWavUrl] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 解析 XNB 数据
  useEffect(() => {
    if (!data) return;

    const result = parseXnbAudio(data);

    if (result.success && result.data) {
      setAudioData(result.data);
      setDuration(result.data.duration);
      setParseError(null);

      // 转换为 WAV Blob URL
      const blob = xnbToWavBlob(result.data);
      const url = URL.createObjectURL(blob);
      setWavUrl(url);

      // 清理旧的 URL
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setAudioData(null);
      setWavUrl(null);
      setParseError(result.error || "未知错误");
    }
  }, [data]);

  // 清理 AudioContext
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((e) => {
        setParseError(`播放失败: ${e.message}`);
      });
    }
  }, [isPlaying]);

  // 停止
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  // 进度条点击
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || duration === 0) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      const newTime = percent * duration;
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  // 格式化时间
  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 下载 WAV
  const handleDownload = useCallback(() => {
    if (!wavUrl || !fileName) return;
    const a = document.createElement("a");
    a.href = wavUrl;
    a.download = fileName.replace(/\.xnb$/i, ".wav");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [wavUrl, fileName]);

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-[#808080]">加载中...</span>
        </div>
      </div>
    );
  }

  // 外部错误
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center text-red-400">
          <span className="text-2xl">❌</span>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // 解析错误
  if (parseError) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center text-red-400">
          <span className="text-2xl">❌</span>
          <p className="mt-2">XNB 解析失败</p>
          <p className="mt-1 text-sm text-[#808080]">{parseError}</p>
        </div>
      </div>
    );
  }

  // 等待解析
  if (!audioData || !wavUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-[#808080]">解析 XNB...</span>
        </div>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
      <div className="text-center w-full max-w-md px-4">
        {/* 图标 */}
        <div className="text-6xl mb-4">🎵</div>

        {/* 文件名 */}
        <p className="text-[#cccccc] font-medium mb-2">{fileName}</p>

        {/* 音频信息 */}
        <p className="text-xs text-[#808080] mb-4">
          XNB SoundEffect • {audioData.sampleRate} Hz •{" "}
          {audioData.channels === 1 ? "单声道" : "立体声"} • {audioData.bitsPerSample} bit
        </p>

        {/* 隐藏的 audio 元素 */}
        <audio ref={audioRef} src={wavUrl} preload="auto" />

        {/* 进度条 */}
        <div
          className="h-2 bg-[#3c3c3c] rounded-full cursor-pointer mb-2 overflow-hidden"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-[#0e639c] transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 时间显示 */}
        <div className="flex justify-between text-xs text-[#808080] mb-4">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-3 mb-4">
          {/* 停止按钮 */}
          <button
            onClick={stop}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#3c3c3c] hover:bg-[#4c4c4c] transition-colors"
            title="停止"
          >
            <svg className="w-4 h-4 text-[#cccccc]" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>

          {/* 播放/暂停按钮 */}
          <button
            onClick={togglePlay}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-[#0e639c] hover:bg-[#1177bb] transition-colors"
            title={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* 下载按钮 */}
          <button
            onClick={handleDownload}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#3c3c3c] hover:bg-[#4c4c4c] transition-colors"
            title="下载 WAV"
          >
            <svg
              className="w-4 h-4 text-[#cccccc]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
