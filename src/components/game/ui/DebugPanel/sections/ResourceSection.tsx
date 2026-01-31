/**
 * 资源加载统计区块
 */

import React from "react";
import type { ResourceStats } from "@/engine/resource/resourceLoader";
import { DataRow } from "../DataRow";
import { Section } from "../Section";

interface ResourceSectionProps {
  resourceStats: ResourceStats;
}

export const ResourceSection: React.FC<ResourceSectionProps> = ({ resourceStats }) => {
  return (
    <Section title="资源加载统计" defaultOpen={false}>
      <div className="space-y-1">
        {/* 总览 */}
        <div className="space-y-px">
          <DataRow label="总请求" value={resourceStats.totalRequests} />
          <DataRow
            label="命中率"
            value={
              resourceStats.totalRequests > 0
                ? `${Math.round(((resourceStats.cacheHits + resourceStats.dedupeHits) / resourceStats.totalRequests) * 100)}%`
                : "N/A"
            }
            valueColor={
              resourceStats.cacheHits + resourceStats.dedupeHits > 0
                ? "text-green-400"
                : "text-zinc-300"
            }
          />
          <DataRow
            label="缓存命中"
            value={resourceStats.cacheHits}
            valueColor="text-green-400"
          />
          <DataRow
            label="去重命中"
            value={resourceStats.dedupeHits}
            valueColor="text-cyan-400"
          />
          <DataRow
            label="网络请求"
            value={resourceStats.networkRequests}
            valueColor="text-yellow-400"
          />
          <DataRow
            label="缓存条目"
            value={resourceStats.cacheEntries}
            valueColor="text-blue-400"
          />
          <DataRow
            label="失败"
            value={resourceStats.failures}
            valueColor={resourceStats.failures > 0 ? "text-red-400" : "text-zinc-300"}
          />
        </div>
        {/* 按类型统计 */}
        <div className="text-[10px] text-zinc-500 uppercase mt-2">
          按类型统计 (请求 / 缓存+去重 / 网络)
        </div>
        <div className="space-y-px text-[10px]">
          <div className="flex justify-between text-zinc-400">
            <span>文本</span>
            <span>
              {resourceStats.byType.text.requests} / {resourceStats.byType.text.hits}+
              {resourceStats.byType.text.dedupeHits} / {resourceStats.byType.text.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>二进制</span>
            <span>
              {resourceStats.byType.binary.requests} / {resourceStats.byType.binary.hits}+
              {resourceStats.byType.binary.dedupeHits} / {resourceStats.byType.binary.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>音频</span>
            <span>
              {resourceStats.byType.audio.requests} / {resourceStats.byType.audio.hits}+
              {resourceStats.byType.audio.dedupeHits} / {resourceStats.byType.audio.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>NPC配置</span>
            <span>
              {resourceStats.byType.npcConfig.requests} / {resourceStats.byType.npcConfig.hits}+
              {resourceStats.byType.npcConfig.dedupeHits} / {resourceStats.byType.npcConfig.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>NPC资源</span>
            <span>
              {resourceStats.byType.npcRes.requests} / {resourceStats.byType.npcRes.hits}+
              {resourceStats.byType.npcRes.dedupeHits} / {resourceStats.byType.npcRes.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>物体资源</span>
            <span>
              {resourceStats.byType.objRes.requests} / {resourceStats.byType.objRes.hits}+
              {resourceStats.byType.objRes.dedupeHits} / {resourceStats.byType.objRes.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>ASF</span>
            <span>
              {resourceStats.byType.asf.requests} / {resourceStats.byType.asf.hits}+
              {resourceStats.byType.asf.dedupeHits} / {resourceStats.byType.asf.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>MPC</span>
            <span>
              {resourceStats.byType.mpc.requests} / {resourceStats.byType.mpc.hits}+
              {resourceStats.byType.mpc.dedupeHits} / {resourceStats.byType.mpc.loads}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>脚本</span>
            <span>
              {resourceStats.byType.script.requests} / {resourceStats.byType.script.hits}+
              {resourceStats.byType.script.dedupeHits} / {resourceStats.byType.script.loads}
            </span>
          </div>
          {resourceStats.byType.magic.requests > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>武功</span>
              <span>
                {resourceStats.byType.magic.requests} / {resourceStats.byType.magic.hits}+
                {resourceStats.byType.magic.dedupeHits} / {resourceStats.byType.magic.loads}
              </span>
            </div>
          )}
          {resourceStats.byType.goods.requests > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>物品</span>
              <span>
                {resourceStats.byType.goods.requests} / {resourceStats.byType.goods.hits}+
                {resourceStats.byType.goods.dedupeHits} / {resourceStats.byType.goods.loads}
              </span>
            </div>
          )}
          {resourceStats.byType.level.requests > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>等级</span>
              <span>
                {resourceStats.byType.level.requests} / {resourceStats.byType.level.hits}+
                {resourceStats.byType.level.dedupeHits} / {resourceStats.byType.level.loads}
              </span>
            </div>
          )}
          {resourceStats.byType.other.requests > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>其他</span>
              <span>
                {resourceStats.byType.other.requests} / {resourceStats.byType.other.hits}+
                {resourceStats.byType.other.dedupeHits} / {resourceStats.byType.other.loads}
              </span>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
};
