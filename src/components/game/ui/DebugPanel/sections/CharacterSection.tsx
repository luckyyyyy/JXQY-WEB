/**
 * 角色状态区块
 */

import React from "react";
import { DataRow } from "../DataRow";
import { Section } from "../Section";
import type { PlayerStats } from "../types";
import { getStateName } from "../utils";

interface CharacterSectionProps {
  playerStats: PlayerStats;
  playerPosition?: { x: number; y: number };
}

export const CharacterSection: React.FC<CharacterSectionProps> = ({
  playerStats,
  playerPosition,
}) => {
  return (
    <Section title="角色状态" defaultOpen={false}>
      <div className="space-y-px">
        <DataRow label="等级" value={playerStats.level} valueColor="text-yellow-400" />
        <DataRow
          label="生命"
          value={`${playerStats.life}/${playerStats.lifeMax}`}
          valueColor="text-red-400"
        />
        <DataRow
          label="内力"
          value={`${playerStats.mana}/${playerStats.manaMax}`}
          valueColor="text-blue-400"
        />
        <DataRow
          label="体力"
          value={`${playerStats.thew}/${playerStats.thewMax}`}
          valueColor="text-green-400"
        />
        <DataRow
          label="经验"
          value={`${playerStats.exp}/${playerStats.levelUpExp || "MAX"}`}
        />
        <DataRow
          label="金钱"
          value={playerStats.money.toLocaleString()}
          valueColor="text-amber-400"
        />
        <DataRow
          label="状态"
          value={`${playerStats.state} ${getStateName(playerStats.state)}`}
          valueColor={playerStats.isInFighting ? "text-red-400" : "text-zinc-300"}
        />
        <DataRow
          label="战斗中"
          value={playerStats.isInFighting ? "是" : "否"}
          valueColor={playerStats.isInFighting ? "text-red-400" : "text-green-400"}
        />
        {playerPosition && (
          <DataRow label="位置" value={`${playerPosition.x}, ${playerPosition.y}`} />
        )}
      </div>
    </Section>
  );
};
