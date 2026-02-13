/**
 * 资源配置区块 - NPC / Obj 资源详情页共用
 *
 * 每行显示：状态名 (State)  动画 [picker]  音效 [picker]
 */
import { ResourceFilePicker } from "../../../components/common";

export interface StateItem {
  /** 显示标签，如 "站立" */
  label: string;
  /** 英文状态名，如 "Stand" */
  stateName: string;
  /** 资源键名（camelCase），如 "stand"、"fightStand" */
  stateKey: string;
}

export interface ResourceStateValue {
  image?: string | null;
  sound?: string | null;
}

interface ResourceConfigSectionProps {
  /** 状态列表 */
  states: StateItem[];
  /** 当前资源数据 */
  getResource: (stateKey: string) => ResourceStateValue | undefined;
  /** 更新某个状态的字段（readonly 模式下可省略） */
  onResourceChange?: (stateKey: string, field: "image" | "sound", value: string | null) => void;
  /** fieldName 前缀，如 "npcResource" 或 "objResource" */
  fieldPrefix: string;
  gameId: string;
  gameSlug: string;
  /** 动画文件扩展名，默认 [".asf"] */
  imageExtensions?: string[];
  /** 音效文件扩展名，默认 [".wav", ".ogg"] */
  soundExtensions?: string[];
  /** 只读模式：禁止编辑，但保留预览 / 试听 */
  readonly?: boolean;
  /** 自定义标题，默认 "🎨 资源配置" */
  title?: string;
  /** 标题右侧额外内容，如链接、徽章等 */
  titleExtra?: React.ReactNode;
}

export function ResourceConfigSection({
  states,
  getResource,
  onResourceChange,
  fieldPrefix,
  gameId,
  gameSlug,
  imageExtensions = [".asf"],
  soundExtensions = [".wav", ".ogg"],
  readonly: isReadonly = false,
  title = "🎨 资源配置",
  titleExtra,
}: ResourceConfigSectionProps) {
  const noop = () => {};
  return (
    <section className="bg-[#252526] border border-widget-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-widget-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#cccccc]">{title}</h2>
        {titleExtra}
      </div>
      <div className="p-4 space-y-2">
        {states.map((s) => {
          const resource = getResource(s.stateKey);
          return (
            <div
              key={s.stateName}
              className="flex items-center gap-3 py-1.5 border-b border-widget-border/50 last:border-b-0"
            >
              {/* 状态标签 */}
              <div className="flex items-center gap-1.5 w-40 flex-shrink-0">
                <span className="text-sm font-medium text-white">{s.label}</span>
                <span className="text-xs text-[#858585]">({s.stateName})</span>
              </div>
              {/* 动画 + 音效 */}
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1">
                  <ResourceFilePicker
                    label="动画"
                    inlineLabel
                    value={resource?.image ?? null}
                    onChange={isReadonly ? noop : (val) => onResourceChange?.(s.stateKey, "image", val)}
                    fieldName={`${fieldPrefix}_${s.stateKey}_image`}
                    gameId={gameId}
                    gameSlug={gameSlug}
                    extensions={imageExtensions}
                    placeholder="选择动画文件"
                    readonly={isReadonly}
                  />
                </div>
                <div className="flex-1">
                  <ResourceFilePicker
                    label="音效"
                    inlineLabel
                    value={resource?.sound ?? null}
                    onChange={isReadonly ? noop : (val) => onResourceChange?.(s.stateKey, "sound", val)}
                    fieldName={`${fieldPrefix}_${s.stateKey}_sound`}
                    gameId={gameId}
                    gameSlug={gameSlug}
                    extensions={soundExtensions}
                    placeholder="选择音效文件"
                    readonly={isReadonly}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
