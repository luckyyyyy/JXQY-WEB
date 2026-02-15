/**
 * 性能统计区块
 */

import type { PerformanceStatsData } from "@miu2d/engine/runtime/performance-stats";
import type React from "react";
import { DataRow } from "../DataRow";
import { Section } from "../Section";

interface PerformanceSectionProps {
  performanceStats: PerformanceStatsData;
}

/**
 * 获取 FPS 对应的颜色
 */
function getFpsColor(fps: number): string {
  if (fps >= 55) return "text-[#4ade80]";
  if (fps >= 30) return "text-[#fbbf24]";
  return "text-[#f87171]";
}

/**
 * 格式化时间（毫秒）
 */
function formatTime(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

/**
 * 渲染器后端标签
 */
function getRendererLabel(type: string): { label: string; color: string } {
  switch (type) {
    case "webgl":
      return { label: "WebGL 2", color: "text-[#4ade80]" };
    case "canvas2d":
      return { label: "Canvas 2D", color: "text-[#fbbf24]" };
    default:
      return { label: "None", color: "text-[#969696]" };
  }
}

export const PerformanceSection: React.FC<PerformanceSectionProps> = ({ performanceStats }) => {
  const {
    fps,
    fpsMin,
    fpsMax,
    fpsAvg,
    frameTime,
    frameTimeAvg,
    updateTime,
    renderTime,
    updateTimeAvg,
    renderTimeAvg,
    npcsInView,
    objsInView,
    magicSprites,
    totalFrames,
    droppedFrames,
    rendererType,
    drawCalls,
    spriteCount,
    rectCount,
    textureSwaps,
    textureCount,
  } = performanceStats;

  const dropRate = totalFrames > 0 ? ((droppedFrames / totalFrames) * 100).toFixed(1) : "0.0";
  const renderer = getRendererLabel(rendererType);

  return (
    <Section title="性能统计" defaultOpen={false}>
      <div className="space-y-2">
        {/* 渲染器信息 */}
        <div className="space-y-px">
          <div className="text-[10px] text-[#969696] uppercase">渲染器</div>
          <DataRow label="后端" value={renderer.label} valueColor={renderer.color} />
          <DataRow label="Draw Calls" value={drawCalls} valueColor="text-[#d4d4d4]" />
          <DataRow label="Sprites" value={spriteCount} valueColor="text-[#93c5fd]" />
          <DataRow label="Rects" value={rectCount} valueColor="text-[#60a5fa]" />
          <DataRow label="纹理切换" value={textureSwaps} valueColor="text-[#d4d4d4]" />
          <DataRow label="纹理总数" value={textureCount} valueColor="text-[#d4d4d4]" />
        </div>

        {/* FPS + 帧时间 */}
        <div className="space-y-px">
          <div className="text-[10px] text-[#969696] uppercase">帧率</div>
          <DataRow
            label="FPS"
            value={`${fps}  (${fpsMin}~${fpsMax})`}
            valueColor={getFpsColor(fps)}
          />
          <DataRow label="平均 FPS" value={fpsAvg} valueColor={getFpsColor(fpsAvg)} />
          <DataRow
            label="帧时间"
            value={`${formatTime(frameTime)} (avg: ${formatTime(frameTimeAvg)})`}
            valueColor={frameTime > 33 ? "text-[#f87171]" : "text-[#d4d4d4]"}
          />
        </div>

        {/* 阶段耗时 */}
        <div className="space-y-px">
          <div className="text-[10px] text-[#969696] uppercase">阶段耗时</div>
          <DataRow
            label="Update"
            value={`${formatTime(updateTime)} (avg: ${formatTime(updateTimeAvg)})`}
            valueColor="text-[#969696]"
          />
          <DataRow
            label="Render"
            value={`${formatTime(renderTime)} (avg: ${formatTime(renderTimeAvg)})`}
            valueColor="text-[#969696]"
          />
        </div>

        {/* 视野内对象 */}
        <div className="space-y-px">
          <div className="text-[10px] text-[#969696] uppercase">视野内对象</div>
          <DataRow label="NPC" value={npcsInView} valueColor="text-[#93c5fd]" />
          <DataRow label="物体" value={objsInView} valueColor="text-[#60a5fa]" />
          <DataRow label="武功精灵" value={magicSprites} valueColor="text-[#c084fc]" />
        </div>

        {/* 帧统计 */}
        <div className="space-y-px">
          <div className="text-[10px] text-[#969696] uppercase">帧统计</div>
          <DataRow
            label="总帧数"
            value={totalFrames.toLocaleString()}
            valueColor="text-[#d4d4d4]"
          />
          <DataRow
            label="丢帧"
            value={`${droppedFrames} (${dropRate}%)`}
            valueColor={droppedFrames > 0 ? "text-[#fbbf24]" : "text-[#4ade80]"}
          />
        </div>
      </div>
    </Section>
  );
};
