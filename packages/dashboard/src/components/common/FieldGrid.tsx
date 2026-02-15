/**
 * 通用字段网格渲染器 — 数据驱动的表单字段渲染
 *
 * 用于将大量字段定义转换为统一的编辑器表单，
 * 避免为每个字段手写重复的 JSX。
 */
import { NumberInput } from "@miu2d/ui";

// ========== 字段定义类型 ==========

/** 数值字段 */
interface NumberFieldDef {
  key: string;
  label: string;
  type: "number";
  defaultValue?: number;
  min?: number;
  max?: number;
  tooltip?: string;
}

/** 复选框字段（boolean → 0/1） */
interface CheckboxFieldDef {
  key: string;
  label: string;
  type: "checkbox";
  tooltip?: string;
}

/** 文本字段 */
interface TextFieldDef {
  key: string;
  label: string;
  type: "text";
  placeholder?: string;
  tooltip?: string;
}

export type FieldDef = NumberFieldDef | CheckboxFieldDef | TextFieldDef;

/** 字段分组（渲染为一个 section） */
export interface FieldGroup {
  title: string;
  icon: string;
  fields: FieldDef[];
  /** 默认折叠（默认 false） */
  collapsed?: boolean;
}

// ========== 组件 ==========

const inputClass =
  "w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border";

/**
 * 渲染一组字段（section 容器 + 网格布局）
 */
export function FieldSection<T extends Record<string, unknown>>({
  group,
  formData,
  updateField,
}: {
  group: FieldGroup;
  formData: Partial<T>;
  updateField: (key: string, value: unknown) => void;
}) {
  return (
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border">
        <h2 className="text-sm font-medium text-[#cccccc]">
          {group.icon} {group.title}
        </h2>
      </div>
      <div className="p-4 grid grid-cols-3 gap-4">
        {group.fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={formData[field.key as keyof T]}
            onChange={(v) => updateField(field.key, v)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * 渲染多组字段
 */
export function FieldGroupList<T extends Record<string, unknown>>({
  groups,
  formData,
  updateField,
}: {
  groups: FieldGroup[];
  formData: Partial<T>;
  updateField: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <FieldSection
          key={group.title}
          group={group}
          formData={formData}
          updateField={updateField}
        />
      ))}
    </div>
  );
}

// ========== 单个字段渲染 ==========

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "number":
      return (
        <div>
          <label className="block text-sm text-[#858585] mb-1" title={field.tooltip}>
            {field.label}
          </label>
          <NumberInput
            min={field.min}
            max={field.max}
            value={(value as number) ?? field.defaultValue ?? 0}
            onChange={(val) => onChange(val ?? field.defaultValue ?? 0)}
          />
        </div>
      );

    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`field-${field.key}`}
            checked={!!value}
            onChange={(e) => onChange(e.target.checked ? 1 : 0)}
            className="w-4 h-4 bg-[#1e1e1e] border border-widget-border rounded-lg"
          />
          <label
            htmlFor={`field-${field.key}`}
            className="text-sm text-[#858585]"
            title={field.tooltip}
          >
            {field.label}
          </label>
        </div>
      );

    case "text":
      return (
        <div>
          <label className="block text-sm text-[#858585] mb-1" title={field.tooltip}>
            {field.label}
          </label>
          <input
            type="text"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        </div>
      );
  }
}
