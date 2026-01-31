/**
 * 物品/武功区块
 */

import React, { useMemo, useState } from "react";
import { ALL_GOODS, ALL_PLAYER_MAGICS, GOODS_CATEGORIES } from "@/constants/gameData";
import { btnClass, btnPrimary, selectClass } from "../constants";
import { Section } from "../Section";

interface ItemMagicSectionProps {
  onAddItem?: (itemFile: string) => Promise<void>;
  onAddMagic?: (magicFile: string) => Promise<void>;
  onAddAllMagics?: () => Promise<void>;
}

export const ItemMagicSection: React.FC<ItemMagicSectionProps> = ({
  onAddItem,
  onAddMagic,
  onAddAllMagics,
}) => {
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedItem, setSelectedItem] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedMagic, setSelectedMagic] = useState("");
  const [isAddingMagic, setIsAddingMagic] = useState(false);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "全部") return ALL_GOODS;
    return ALL_GOODS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  const handleAddItem = async () => {
    if (!onAddItem || !selectedItem) return;
    setIsAddingItem(true);
    try {
      await onAddItem(selectedItem);
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleAddMagic = async () => {
    if (!onAddMagic || !selectedMagic) return;
    setIsAddingMagic(true);
    try {
      await onAddMagic(selectedMagic);
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingMagic(false);
    }
  };

  const handleAddAllMagics = async () => {
    if (!onAddAllMagics) return;
    setIsAddingMagic(true);
    try {
      await onAddAllMagics();
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingMagic(false);
    }
  };

  if (!onAddItem && !onAddMagic) return null;

  return (
    <Section title="物品 / 武功" defaultOpen={false}>
      {onAddItem && (
        <div className="flex gap-1 mb-2">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedItem("");
            }}
            className={`${selectClass} w-16`}
          >
            {GOODS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className={`${selectClass} flex-1`}
          >
            <option value="">选择物品...</option>
            {filteredItems.map((i) => (
              <option key={i.file} value={i.file}>
                {i.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddItem}
            disabled={isAddingItem || !selectedItem}
            className={`${btnPrimary} px-3`}
          >
            +
          </button>
        </div>
      )}
      {onAddMagic && (
        <div className="flex gap-1">
          <select
            value={selectedMagic}
            onChange={(e) => setSelectedMagic(e.target.value)}
            className={`${selectClass} flex-1`}
          >
            <option value="">选择武功...</option>
            {ALL_PLAYER_MAGICS.map((m) => (
              <option key={m.file} value={m.file}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddMagic}
            disabled={isAddingMagic || !selectedMagic}
            className={`${btnPrimary} px-3`}
          >
            +
          </button>
          <button
            type="button"
            onClick={handleAddAllMagics}
            disabled={isAddingMagic}
            className={`${btnClass} px-2`}
          >
            全部
          </button>
        </div>
      )}
    </Section>
  );
};
