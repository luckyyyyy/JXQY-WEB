/**
 * 游戏变量区块
 */

import React from "react";
import type { GameVariables } from "@/engine/core/types";
import { Section } from "../Section";

interface VariablesSectionProps {
  gameVariables?: GameVariables;
}

export const VariablesSection: React.FC<VariablesSectionProps> = ({ gameVariables }) => {
  return (
    <Section title="游戏变量" badge={Object.keys(gameVariables || {}).length}>
      <div
        className="max-h-40 overflow-y-auto bg-zinc-900 border border-zinc-700 font-mono text-[10px]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b transparent" }}
      >
        {gameVariables && Object.keys(gameVariables).length > 0 ? (
          Object.entries(gameVariables)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between px-2 py-0.5 hover:bg-zinc-800 border-b border-zinc-800 last:border-b-0"
              >
                <span className="text-zinc-500 truncate mr-2">{k}</span>
                <span className="text-green-400">{v}</span>
              </div>
            ))
        ) : (
          <div className="text-center text-zinc-600 py-2">暂无变量</div>
        )}
      </div>
    </Section>
  );
};
