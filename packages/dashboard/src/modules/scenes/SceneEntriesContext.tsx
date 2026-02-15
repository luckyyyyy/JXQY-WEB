/**
 * 场景 NPC/OBJ/脚本/陷阱 条目的唯一数据源
 *
 * 所有对 entries 和文本内容的读写都通过此 Context，
 * 确保地图标记、右侧列表、脚本编辑器、dirty 状态始终一致。
 */
import type { SceneData, SceneNpcEntry, SceneObjEntry } from "@miu2d/types";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface SceneEntriesContextValue {
  // NPC
  npcEntries: SceneNpcEntry[];
  setNpcEntries: React.Dispatch<React.SetStateAction<SceneNpcEntry[]>>;
  npcDirty: boolean;
  markNpcSaved: () => void;

  // OBJ
  objEntries: SceneObjEntry[];
  setObjEntries: React.Dispatch<React.SetStateAction<SceneObjEntry[]>>;
  objDirty: boolean;
  markObjSaved: () => void;

  // Script（文本内容）
  scriptContent: string;
  setScriptContent: React.Dispatch<React.SetStateAction<string>>;
  scriptDirty: boolean;
  markScriptSaved: () => void;

  // Trap（文本内容）
  trapContent: string;
  setTrapContent: React.Dispatch<React.SetStateAction<string>>;
  trapDirty: boolean;
  markTrapSaved: () => void;

  // 组合
  isAnyDirty: boolean;
}

const SceneEntriesContext = createContext<SceneEntriesContextValue | null>(null);

export function useSceneEntries(): SceneEntriesContextValue {
  const ctx = useContext(SceneEntriesContext);
  if (!ctx) throw new Error("useSceneEntries must be used within SceneEntriesProvider");
  return ctx;
}

/**
 * Provider：管理当前 npcKey/objKey/scriptKey/trapKey 对应的状态。
 * 当 key 切换时自动从 sceneData 重新加载，丢弃未保存的修改。
 */
export function SceneEntriesProvider({
  sceneData,
  npcKey,
  objKey,
  scriptKey,
  trapKey,
  children,
}: {
  sceneData: SceneData;
  npcKey: string | null;
  objKey: string | null;
  scriptKey: string | null;
  trapKey: string | null;
  children: ReactNode;
}) {
  // ── NPC ──
  const [npcEntries, setNpcEntries] = useState<SceneNpcEntry[]>([]);
  const [npcOriginal, setNpcOriginal] = useState("[]");

  useEffect(() => {
    const data = npcKey ? (sceneData.npc?.[npcKey]?.entries ?? []) : [];
    setNpcEntries(data);
    setNpcOriginal(JSON.stringify(data));
  }, [npcKey, sceneData]);

  const npcDirty = JSON.stringify(npcEntries) !== npcOriginal;
  const npcEntriesRef = useRef(npcEntries);
  npcEntriesRef.current = npcEntries;
  const markNpcSaved = useCallback(() => {
    setNpcOriginal(JSON.stringify(npcEntriesRef.current));
  }, []);

  // ── OBJ ──
  const [objEntries, setObjEntries] = useState<SceneObjEntry[]>([]);
  const [objOriginal, setObjOriginal] = useState("[]");

  useEffect(() => {
    const data = objKey ? (sceneData.obj?.[objKey]?.entries ?? []) : [];
    setObjEntries(data);
    setObjOriginal(JSON.stringify(data));
  }, [objKey, sceneData]);

  const objDirty = JSON.stringify(objEntries) !== objOriginal;
  const objEntriesRef = useRef(objEntries);
  objEntriesRef.current = objEntries;
  const markObjSaved = useCallback(() => {
    setObjOriginal(JSON.stringify(objEntriesRef.current));
  }, []);

  // ── Script ──
  const [scriptContent, setScriptContent] = useState("");
  const [scriptOriginal, setScriptOriginal] = useState("");

  useEffect(() => {
    const text = scriptKey ? (sceneData.scripts?.[scriptKey] ?? "") : "";
    setScriptContent(text);
    setScriptOriginal(text);
  }, [scriptKey, sceneData]);

  const scriptDirty = scriptContent !== scriptOriginal;
  const scriptContentRef = useRef(scriptContent);
  scriptContentRef.current = scriptContent;
  const markScriptSaved = useCallback(() => {
    setScriptOriginal(scriptContentRef.current);
  }, []);

  // ── Trap ──
  const [trapContent, setTrapContent] = useState("");
  const [trapOriginal, setTrapOriginal] = useState("");

  useEffect(() => {
    let text = "";
    if (trapKey && sceneData.traps) {
      // 大小写不敏感匹配（原系统文件名不区分大小写）
      text =
        sceneData.traps[trapKey] ??
        Object.entries(sceneData.traps).find(
          ([k]) => k.toLowerCase() === trapKey.toLowerCase()
        )?.[1] ??
        "";
    }
    setTrapContent(text);
    setTrapOriginal(text);
  }, [trapKey, sceneData]);

  const trapDirty = trapContent !== trapOriginal;
  const trapContentRef = useRef(trapContent);
  trapContentRef.current = trapContent;
  const markTrapSaved = useCallback(() => {
    setTrapOriginal(trapContentRef.current);
  }, []);

  // ── 组合 ──
  const isAnyDirty = npcDirty || objDirty || scriptDirty || trapDirty;

  const value = useMemo<SceneEntriesContextValue>(
    () => ({
      npcEntries,
      setNpcEntries,
      npcDirty,
      markNpcSaved,
      objEntries,
      setObjEntries,
      objDirty,
      markObjSaved,
      scriptContent,
      setScriptContent,
      scriptDirty,
      markScriptSaved,
      trapContent,
      setTrapContent,
      trapDirty,
      markTrapSaved,
      isAnyDirty,
    }),
    [
      npcEntries,
      npcDirty,
      markNpcSaved,
      objEntries,
      objDirty,
      markObjSaved,
      scriptContent,
      scriptDirty,
      markScriptSaved,
      trapContent,
      trapDirty,
      markTrapSaved,
      isAnyDirty,
    ]
  );

  return <SceneEntriesContext.Provider value={value}>{children}</SceneEntriesContext.Provider>;
}
