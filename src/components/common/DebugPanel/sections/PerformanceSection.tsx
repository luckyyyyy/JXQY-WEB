/**
 * 性能统计区块
 */

import type React from "react";
import type { PerformanceStatsData } from "@/engine/game/performanceStats";
import { DataRow } from "../DataRow";
import { Section } from "../Section";

interface PerformanceSectionProps {
  performanceStats: PerformanceStatsData;
}

/**
 * 获取 FPS 对应的颜色
 */
function getFpsColor(fps: number): string {
  if (fps >= 55) return "text-green-400";
  if (fps >= 30) return "text-yellow-400";
  return "text-red-400";
}

/**
 * 格式化时间（毫秒）
 */
function formatTime(ms: number): string {
  return `${ms.toFixed(1)}ms`;
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
  } = performanceStats;

  // 计算丢帧率
  const dropRate = totalFrames > 0 ? ((droppedFrames / totalFrames) * 100).toFixed(1) : "0.0";

  return (
    <Section title="性能统计" defaultOpen={false}>
      <div className="space-y-2">
        {/* FPS 统计 */}
        <div className="space-y-px">
          <div className="text-[10px] text-zinc-500 uppercase">帧率</div>
          <DataRow label="当前 FPS" value={fps} valueColor={getFpsColor(fps)} />
          <DataRow
            label="FPS 范围"
            value={`${fpsMin} ~ ${fpsMax}`}
            valueColor="text-zinc-300"
          />
          <DataRow label="平均 FPS" value={fpsAvg} valueColor={getFpsColor(fpsAvg)} />
        </div>

        {/* 帧时间 */}
        <div className="space-y-px">
          <div className="text-[10px] text-zinc-500 uppercase">帧时间</div>
          <DataRow
            label="当前"
            value={formatTime(frameTime)}
            valueColor={frameTime > 33 ? "text-red-400" : "text-zinc-300"}
          />
          <DataRow label="平均" value={formatTime(frameTimeAvg)} valueColor="text-zinc-300" />
        </div>

        {/* Update / Render 耗时 */}
        <div className="space-y-px">
          <div className="text-[10px] text-zinc-500 uppercase">阶段耗时</div>
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>Update</span>
            <span>
              {formatTime(updateTime)} (avg: {formatTime(updateTimeAvg)})
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>Render</span>
            <span>
              {formatTime(renderTime)} (avg: {formatTime(renderTimeAvg)})
            </span>
          </div>
        </div>

        {/* 对象统计 */}
        <div className="space-y-px">
          <div className="text-[10px] text-zinc-500 uppercase">视野内对象</div>
          <DataRow label="NPC" value={npcsInView} valueColor="text-cyan-400" />
          <DataRow label="物体" value={objsInView} valueColor="text-blue-400" />
          <DataRow label="武功精灵" value={magicSprites} valueColor="text-purple-400" />
        </div>

        {/* 帧统计 */}
        <div className="space-y-px">
          <div className="text-[10px] text-zinc-500 uppercase">帧统计</div>
          <DataRow label="总帧数" value={totalFrames.toLocaleString()} valueColor="text-zinc-300" />
          <DataRow
            label="丢帧"
            value={`${droppedFrames} (${dropRate}%)`}
            valueColor={droppedFrames > 0 ? "text-yellow-400" : "text-green-400"}
          />
        </div>
      </div>
    </Section>
  );
};
