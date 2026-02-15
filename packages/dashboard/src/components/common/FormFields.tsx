/**
 * FormFields - 通用表单字段组件族
 *
 * 消除跨模块大量重复的 <label> + <input/select/textarea/number> 模式。
 * 使用泛型 T 约束 field 名，确保类型安全。
 *
 * @example
 * ```tsx
 * <FormTextField  label="名称"  field="name"  value={formData} onChange={updateField} />
 * <FormSelectField label="类型" field="kind"  value={formData} onChange={updateField}
 *   options={{ Drug: "药品", Equipment: "装备" }} />
 * <FormNumberField label="伤害" field="damage" value={formData} onChange={updateField} />
 * <FormTextArea    label="描述" field="intro" value={formData} onChange={updateField} rows={3} />
 * <FormCheckbox    label="穿透" field="passThrough" value={formData} onChange={updateField} />
 * ```
 */

import { NumberInput } from "@miu2d/ui";
import type { ReactNode } from "react";
import { INPUT_CLS, LABEL_CLS, TEXTAREA_CLS } from "../../styles/classNames";

// ── 公共类型 ─────────────────────────────────────────────

/** updateField 回调签名 —— 与各模块现有 updateField 完全兼容 */
type UpdateField<T> = <K extends keyof T>(key: K, value: T[K]) => void;

interface BaseFieldProps<T> {
  /** 字段标签 */
  label: string;
  /** 表单字段名 */
  field: keyof T;
  /** 表单数据（只读取 field 对应值） */
  value: Partial<T>;
  /** updateField 回调 */
  onChange: UpdateField<T>;
  /** 是否跨列 */
  colSpan?: number;
  /** 禁用状态 */
  disabled?: boolean;
  /** label 后的提示 */
  hint?: string;
  /** 条件隐藏 */
  hidden?: boolean;
}

/** 外壳 wrapper - 统一 colSpan 与 hidden 逻辑 */
function FieldWrapper({
  colSpan,
  hidden,
  children,
}: {
  colSpan?: number;
  hidden?: boolean;
  children: ReactNode;
}) {
  if (hidden) return null;
  return <div className={colSpan ? `col-span-${colSpan}` : undefined}>{children}</div>;
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <label className={LABEL_CLS}>
      {text}
      {hint && <span className="ml-1 text-[#555] text-xs">({hint})</span>}
    </label>
  );
}

// ── 文本输入 ─────────────────────────────────────────────

export interface FormTextFieldProps<T> extends BaseFieldProps<T> {
  placeholder?: string;
  type?: "text" | "email" | "password";
}

export function FormTextField<T>({
  label,
  field,
  value,
  onChange,
  colSpan,
  disabled,
  hint,
  hidden,
  placeholder,
  type = "text",
}: FormTextFieldProps<T>) {
  return (
    <FieldWrapper colSpan={colSpan} hidden={hidden}>
      <Label text={label} hint={hint} />
      <input
        type={type}
        value={(value[field] as string) ?? ""}
        onChange={(e) => onChange(field, e.target.value as T[keyof T])}
        placeholder={placeholder}
        disabled={disabled}
        className={INPUT_CLS}
      />
    </FieldWrapper>
  );
}

// ── 下拉选择 ─────────────────────────────────────────────

export interface FormSelectFieldProps<T> extends BaseFieldProps<T> {
  /** { value: label } 映射 */
  options: Record<string, string>;
}

export function FormSelectField<T>({
  label,
  field,
  value,
  onChange,
  options,
  colSpan,
  disabled,
  hint,
  hidden,
}: FormSelectFieldProps<T>) {
  return (
    <FieldWrapper colSpan={colSpan} hidden={hidden}>
      <Label text={label} hint={hint} />
      <select
        value={(value[field] as string) ?? ""}
        onChange={(e) => onChange(field, e.target.value as T[keyof T])}
        disabled={disabled}
        className={INPUT_CLS}
      >
        {Object.entries(options).map(([key, optLabel]) => (
          <option key={key} value={key}>
            {optLabel}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

// ── 数字输入 ─────────────────────────────────────────────

export interface FormNumberFieldProps<T> extends BaseFieldProps<T> {
  min?: number;
  max?: number;
  step?: number;
  allowEmpty?: boolean;
}

export function FormNumberField<T>({
  label,
  field,
  value,
  onChange,
  colSpan,
  disabled,
  hint,
  hidden,
  min,
  max,
  step,
  allowEmpty,
}: FormNumberFieldProps<T>) {
  return (
    <FieldWrapper colSpan={colSpan} hidden={hidden}>
      <Label text={label} hint={hint} />
      <NumberInput
        value={(value[field] as number | null | undefined) ?? (allowEmpty ? null : 0)}
        onChange={(val) => onChange(field, (allowEmpty ? val : (val ?? 0)) as T[keyof T])}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        allowEmpty={allowEmpty}
      />
    </FieldWrapper>
  );
}

// ── 多行文本 ─────────────────────────────────────────────

export interface FormTextAreaProps<T> extends BaseFieldProps<T> {
  rows?: number;
  placeholder?: string;
}

export function FormTextArea<T>({
  label,
  field,
  value,
  onChange,
  colSpan,
  disabled,
  hint,
  hidden,
  rows = 3,
  placeholder,
}: FormTextAreaProps<T>) {
  return (
    <FieldWrapper colSpan={colSpan} hidden={hidden}>
      <Label text={label} hint={hint} />
      <textarea
        rows={rows}
        value={(value[field] as string) ?? ""}
        onChange={(e) => onChange(field, e.target.value as T[keyof T])}
        placeholder={placeholder}
        disabled={disabled}
        className={TEXTAREA_CLS}
      />
    </FieldWrapper>
  );
}

// ── 复选框 ───────────────────────────────────────────────

export interface FormCheckboxProps<T> extends BaseFieldProps<T> {
  /** 值为 boolean 还是 0/1（默认 boolean） */
  numeric?: boolean;
}

export function FormCheckbox<T>({
  label,
  field,
  value,
  onChange,
  colSpan,
  disabled,
  hidden,
  numeric = false,
}: FormCheckboxProps<T>) {
  const checked = numeric ? !!(value[field] as number) : !!(value[field] as boolean);

  return (
    <FieldWrapper colSpan={colSpan} hidden={hidden}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={String(field)}
          checked={checked}
          onChange={(e) => {
            const nextValue = numeric ? (e.target.checked ? 1 : 0) : e.target.checked;
            onChange(field, nextValue as T[keyof T]);
          }}
          disabled={disabled}
          className="w-4 h-4 bg-[#1e1e1e] border border-widget-border rounded"
        />
        <label htmlFor={String(field)} className="text-sm text-[#858585]">
          {label}
        </label>
      </div>
    </FieldWrapper>
  );
}
