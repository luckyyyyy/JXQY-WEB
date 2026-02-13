import { useCallback, useEffect, useRef, useState } from "react";

export interface NumberInputProps {
  /** 当前值 */
  value: number | null | undefined;
  /** 值变化回调 */
  onChange: (value: number | null) => void;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 点击事件（用于阻止事件冒泡等） */
  onClick?: (e: React.MouseEvent) => void;
  /** 允许空值（失去焦点时不会自动变成0） */
  allowEmpty?: boolean;
  /** 空值时的默认值（默认为 0，仅当 allowEmpty=false 时使用） */
  emptyValue?: number;
}

/**
 * 自定义数字输入框组件
 * - 使用 text 输入框代替原生 number 输入框
 * - 输入非数字时失去焦点后边框闪烁提示并恢复默认值
 * - 支持 min/max 范围限制
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  disabled = false,
  className = "",
  onClick,
  allowEmpty = false,
  emptyValue = 0,
}: NumberInputProps) {
  // 内部文本状态（允许用户输入任意字符）
  const [text, setText] = useState(() => (value != null ? String(value) : ""));
  // 是否显示错误动画
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部 value 到内部 text
  useEffect(() => {
    if (value != null) {
      setText(String(value));
    } else if (allowEmpty) {
      setText("");
    } else {
      setText(String(emptyValue));
    }
  }, [value, allowEmpty, emptyValue]);

  // 解析并限制数值范围
  const parseAndClamp = useCallback(
    (input: string): number | null => {
      const trimmed = input.trim();
      if (trimmed === "") {
        return allowEmpty ? null : emptyValue;
      }

      // 支持负数和小数
      const num = Number(trimmed);
      if (Number.isNaN(num)) {
        return null; // 解析失败
      }

      // 应用范围限制
      let result = num;
      if (min != null) result = Math.max(min, result);
      if (max != null) result = Math.min(max, result);

      return result;
    },
    [min, max, allowEmpty, emptyValue]
  );

  // 处理输入变化（允许任意输入）
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);

    // 尝试实时解析，如果是有效数字则立即通知
    const parsed = parseAndClamp(newText);
    if (parsed != null && !Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  // 处理失去焦点
  const handleBlur = () => {
    const trimmed = text.trim();

    // 空值处理
    if (trimmed === "") {
      if (allowEmpty) {
        onChange(null);
        setText("");
      } else {
        onChange(emptyValue);
        setText(String(emptyValue));
      }
      return;
    }

    const parsed = parseAndClamp(trimmed);

    if (parsed === null || Number.isNaN(parsed)) {
      // 输入了非法内容，触发错误动画
      setShowError(true);
      setTimeout(() => {
        setShowError(false);
        // 恢复为默认值
        if (allowEmpty) {
          onChange(null);
          setText("");
        } else {
          onChange(emptyValue);
          setText(String(emptyValue));
        }
      }, 400);
    } else {
      // 有效数值，更新显示文本和值
      setText(String(parsed));
      onChange(parsed);
    }
  };

  // 处理键盘上下键调整数值
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const current = parseAndClamp(text) ?? emptyValue;
      const delta = e.key === "ArrowUp" ? step : -step;
      let newValue = current + delta;
      if (min != null) newValue = Math.max(min, newValue);
      if (max != null) newValue = Math.min(max, newValue);
      setText(String(newValue));
      onChange(newValue);
    } else if (e.key === "Enter") {
      // 按回车时立即验证
      handleBlur();
      inputRef.current?.blur();
    }
  };

  // 基础样式
  const baseClassName =
    "px-2 py-1.5 bg-[#1e1e1e] border rounded-lg text-white text-sm focus:outline-none transition-all duration-200";

  // 错误状态样式
  const errorClassName = showError
    ? "border-red-500 animate-[shake_0.4s_ease-in-out] shadow-[0_0_8px_rgba(239,68,68,0.5)]"
    : "border-[#3c3c3c] focus:border-[#0098ff]";

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      placeholder={placeholder}
      disabled={disabled}
      className={`${baseClassName} ${errorClassName} ${className}`}
    />
  );
}

export default NumberInput;
