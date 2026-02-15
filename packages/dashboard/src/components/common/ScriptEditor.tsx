/**
 * ScriptEditor - 通用 Monaco 脚本编辑器组件
 *
 * 支持 JXQY 脚本语法高亮（.txt/.npc/.obj）和常见语言。
 * 从 FilePreview 中抽取的可复用编辑器组件，适用于：
 * - 资源管理器的文本文件编辑
 * - 游戏配置中的脚本内容编辑
 * - 其它需要代码编辑的场景
 */

import type { OnMount } from "@monaco-editor/react";
import Editor, { loader } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import {
  defineJxqyScriptTheme,
  JXQY_SCRIPT_LANGUAGE_ID,
  registerJxqyScriptLanguage,
} from "../../lib/monaco/jxqyScriptLanguage";

export interface ScriptEditorProps {
  /** 编辑器内容 */
  value: string;
  /** 内容变更回调 */
  onChange?: (value: string) => void;
  /** Monaco 语言标识，默认自动使用 jxqy-script */
  language?: string;
  /** 高度，默认 "100%" */
  height?: string | number;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否显示缩略图 */
  minimap?: boolean;
  /** 字号，默认 14 */
  fontSize?: number;
  /** 自动换行，默认 "on" */
  wordWrap?: "on" | "off" | "wordWrapColumn" | "bounded";
  /** 额外的编辑器选项 */
  options?: Record<string, unknown>;
  /** CSS class */
  className?: string;
  /** 编辑器挂载回调，可用于注册快捷键等 */
  onMount?: OnMount;
}

let monacoInitialized = false;

/**
 * 通用 Monaco 脚本编辑器
 */
export function ScriptEditor({
  value,
  onChange,
  language,
  height = "100%",
  readOnly = false,
  minimap = false,
  fontSize = 14,
  wordWrap = "on",
  options,
  className,
  onMount,
}: ScriptEditorProps) {
  const initRef = useRef(false);

  // 初始化 Monaco 自定义语言（全局只执行一次）
  useEffect(() => {
    if (monacoInitialized) return;
    monacoInitialized = true;
    initRef.current = true;
    loader.init().then((monaco) => {
      registerJxqyScriptLanguage(monaco);
      defineJxqyScriptTheme(monaco);
    });
  }, []);

  return (
    <div className={className} style={{ position: "static", fontSize: `${fontSize}px` }}>
      <Editor
        height={height}
        language={language ?? JXQY_SCRIPT_LANGUAGE_ID}
        value={value}
        onChange={(v) => onChange?.(v ?? "")}
        theme="jxqy-script-theme"
        onMount={onMount}
        options={{
          minimap: { enabled: minimap },
          fontSize,
          lineNumbers: "on",
          wordWrap,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          readOnly,
          ...options,
        }}
      />
    </div>
  );
}
