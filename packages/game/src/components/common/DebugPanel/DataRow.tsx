/**
 * 数据行组件
 */

import type React from "react";

interface DataRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
}

export const DataRow: React.FC<DataRowProps> = ({
  label,
  value,
  valueColor = "text-[#d4d4d4]",
}) => (
  <div className="flex justify-between text-[11px] py-px">
    <span className="text-[#969696]">{label}</span>
    <span className={`font-mono ${valueColor}`}>{value}</span>
  </div>
);
