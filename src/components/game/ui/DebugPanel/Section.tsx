/**
 * 折叠区块组件
 */

import React, { useState } from "react";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export const Section: React.FC<SectionProps> = ({
  title,
  children,
  defaultOpen = true,
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
      >
        <span className={`text-[10px] ${isOpen ? "rotate-90" : ""}`}>▶</span>
        <span className="flex-1 text-left">{title}</span>
        {badge !== undefined && <span className="text-[10px] text-zinc-500">{badge}</span>}
      </button>
      {isOpen && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
};
