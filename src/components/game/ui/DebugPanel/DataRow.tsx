/**
 * 数据行组件
 */

import React from "react";

interface DataRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
}

export const DataRow: React.FC<DataRowProps> = ({
  label,
  value,
  valueColor = "text-zinc-300",
}) => (
  <div className="flex justify-between text-[11px] py-px">
    <span className="text-zinc-500">{label}</span>
    <span className={`font-mono ${valueColor}`}>{value}</span>
  </div>
);
