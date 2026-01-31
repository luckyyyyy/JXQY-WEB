/**
 * 地图信息区块
 */

import React from "react";
import { DataRow } from "../DataRow";
import { Section } from "../Section";
import type { LoadedResources } from "../types";

interface MapSectionProps {
  loadedResources: LoadedResources;
  triggeredTrapIds?: number[];
}

export const MapSection: React.FC<MapSectionProps> = ({
  loadedResources,
  triggeredTrapIds,
}) => {
  return (
    <Section title="地图信息">
      <div className="space-y-px">
        <DataRow label="地图" value={loadedResources.mapName || "N/A"} />
        <DataRow label="NPC数" value={loadedResources.npcCount} />
        <DataRow label="物体数" value={loadedResources.objCount} />
        {triggeredTrapIds && triggeredTrapIds.length > 0 && (
          <DataRow
            label="已触发陷阱"
            value={triggeredTrapIds.join(", ")}
            valueColor="text-orange-400"
          />
        )}
      </div>
    </Section>
  );
};
