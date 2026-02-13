/**
 * 场景类型定义
 *
 * 场景 = 一张地图 + 关联的脚本、陷阱、NPC、物件
 * 地图文件 (*.mmf) 存储在文件系统 (S3)
 * 其他数据（脚本/陷阱/NPC/OBJ）解析为 JSON 存储在 scene.data 字段
 */
import { z } from "zod";

// ============= 场景子项类型枚举 =============

export const SceneItemKindEnum = z.enum(["script", "trap", "npc", "obj"]);
export type SceneItemKind = z.infer<typeof SceneItemKindEnum>;

export const SceneItemKindLabels: Record<SceneItemKind, string> = {
	script: "脚本",
	trap: "陷阱",
	npc: "NPC",
	obj: "物件",
};

// ============= 场景数据结构（存储在 scene.data JSONB） =============

/** NPC 条目 */
export interface SceneNpcEntry {
	name: string;
	kind: number;
	npcIni: string;
	dir: number;
	mapX: number;
	mapY: number;
	action: number;
	walkSpeed: number;
	state: number;
	pathFinder: number;
	lum: number;
	// 脚本
	scriptFile: string;
	deathScript: string;
	// 视野/对话
	dialogRadius: number;
	visionRadius: number;
	// 阵营
	relation: number;
	group: number;
	// 战斗属性
	attack: number;
	defend: number;
	evade: number;
	attackLevel: number;
	attackRadius: number;
	bodyIni: string;
	flyIni: string;
	// 等级经验
	level: number;
	levelUpExp: number;
	exp: number;
	// 生命/体力/魔法
	life: number;
	lifeMax: number;
	thew: number;
	thewMax: number;
	mana: number;
	manaMax: number;
	// 巡逻路径
	fixedPos: string;
}

/** OBJ 条目 */
export interface SceneObjEntry {
	objName: string;
	objFile: string;
	wavFile: string;
	scriptFile: string;
	kind: number;
	dir: number;
	lum: number;
	mapX: number;
	mapY: number;
	offX: number;
	offY: number;
	damage: number;
	frame: number;
}

/** NPC 数据（一个场景一份） */
export interface SceneNpcData {
	key: string;
	entries: SceneNpcEntry[];
}

/** OBJ 数据（一个场景一份） */
export interface SceneObjData {
	key: string;
	entries: SceneObjEntry[];
}

/** 场景数据：存储在 scene.data JSONB 字段 */
export interface SceneData {
	/** 脚本文件: { fileName: content } */
	scripts?: Record<string, string>;
	/** 陷阱文件: { fileName: content } */
	traps?: Record<string, string>;
	/** NPC 配置：{ fileName: SceneNpcData }，一个场景可有多个 NPC 文件 */
	npc?: Record<string, SceneNpcData>;
	/** OBJ 配置：{ fileName: SceneObjData }，一个场景可有多个 OBJ 文件 */
	obj?: Record<string, SceneObjData>;
}

// ============= MMF 地图数据 DTO（JSON 安全，Uint8Array → base64） =============

/** MSF 文件条目 */
export interface MsfEntryDto {
	name: string;
	looping: boolean;
}

/** 陷阱映射条目（trapIndex ↔ 脚本路径） */
export interface TrapEntryDto {
	/** 陷阱索引 (1-255，对应瓦片中的 trapIndex) */
	trapIndex: number;
	/** 脚本文件路径 (如 "Trap01.txt") */
	scriptPath: string;
}

/**
 * MiuMapData 的 JSON 安全表示
 *
 * 供 API 传输和 JSONB 存储，与 MiuMapData 一一对应。
 * 二进制数组字段（layer1/2/3、barriers、traps）编码为 base64 字符串。
 */
export interface MiuMapDataDto {
	mapColumnCounts: number;
	mapRowCounts: number;
	mapPixelWidth: number;
	mapPixelHeight: number;
	msfEntries: MsfEntryDto[];
	trapTable: TrapEntryDto[];
	/** Layer 1 (ground): base64(totalTiles × 2 bytes) */
	layer1: string;
	/** Layer 2 (decoration): base64(totalTiles × 2 bytes) */
	layer2: string;
	/** Layer 3 (top/occlusion): base64(totalTiles × 2 bytes) */
	layer3: string;
	/** Barrier types: base64(totalTiles × 1 byte) */
	barriers: string;
	/** Trap indices: base64(totalTiles × 1 byte) */
	traps: string;
}

export const MiuMapDataDtoSchema = z.object({
	mapColumnCounts: z.number(),
	mapRowCounts: z.number(),
	mapPixelWidth: z.number(),
	mapPixelHeight: z.number(),
	msfEntries: z.array(z.object({ name: z.string(), looping: z.boolean() })),
	trapTable: z.array(z.object({ trapIndex: z.number(), scriptPath: z.string() })),
	layer1: z.string(),
	layer2: z.string(),
	layer3: z.string(),
	barriers: z.string(),
	traps: z.string(),
});

// ============= 场景 Schema =============

export const SceneSchema = z.object({
	id: z.string().uuid(),
	gameId: z.string().uuid(),
	key: z.string(),
	name: z.string(),
	mapFileName: z.string(),
	/** MMF 地图二进制数据（base64 编码）—— 仅导入/导出时使用 */
	mmfData: z.string().nullable().optional(),
	/** MMF 解析后的结构化地图数据 */
	mapParsed: MiuMapDataDtoSchema.nullable().optional(),
	data: z.record(z.string(), z.unknown()).nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const SceneListItemSchema = z.object({
	id: z.string().uuid(),
	key: z.string(),
	name: z.string(),
	mapFileName: z.string(),
	scriptCount: z.number(),
	trapCount: z.number(),
	npcCount: z.number(),
	objCount: z.number(),
	/** 脚本文件名列表（侧栏展开用） */
	scriptKeys: z.array(z.string()),
	/** 陷阱文件名列表 */
	trapKeys: z.array(z.string()),
	/** NPC 文件名列表 */
	npcKeys: z.array(z.string()),
	/** OBJ 文件名列表 */
	objKeys: z.array(z.string()),
	updatedAt: z.string(),
});
export type SceneListItem = z.infer<typeof SceneListItemSchema>;

// ============= API 输入 Schema =============

export const ListSceneInputSchema = z.object({
	gameId: z.string().uuid(),
});
export type ListSceneInput = z.infer<typeof ListSceneInputSchema>;

export const GetSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	id: z.string().uuid(),
});
export type GetSceneInput = z.infer<typeof GetSceneInputSchema>;

export const CreateSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	key: z.string(),
	name: z.string(),
	mapFileName: z.string(),
	data: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type CreateSceneInput = z.infer<typeof CreateSceneInputSchema>;

export const UpdateSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	id: z.string().uuid(),
	name: z.string().optional(),
	data: z.record(z.string(), z.unknown()).nullable().optional(),
	/** 结构化地图数据更新（局部或完整） */
	mapParsed: MiuMapDataDtoSchema.nullable().optional(),
});
export type UpdateSceneInput = z.infer<typeof UpdateSceneInputSchema>;

export const DeleteSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	id: z.string().uuid(),
});
export type DeleteSceneInput = z.infer<typeof DeleteSceneInputSchema>;

// ============= 批量导入（前端解析好数据，按场景逐条导入） =============

/**
 * 单个场景导入数据（前端解析完成后发送）
 * 包含地图 + 脚本 + 陷阱 + NPC + OBJ 全部数据
 */
export const ImportSceneItemSchema = z.object({
	key: z.string(),
	name: z.string(),
	mapFileName: z.string(),
	/** MMF 地图二进制 base64 */
	mmfData: z.string(),
	/** 解析好的场景数据（脚本/陷阱/NPC/OBJ） */
	data: z.record(z.string(), z.unknown()).nullable(),
});
export type ImportSceneItem = z.infer<typeof ImportSceneItemSchema>;

export const ImportSceneBatchInputSchema = z.object({
	gameId: z.string().uuid(),
	scene: ImportSceneItemSchema,
});
export type ImportSceneBatchInput = z.infer<typeof ImportSceneBatchInputSchema>;

export const ImportSceneBatchResultSchema = z.object({
	ok: z.boolean(),
	action: z.enum(["created", "updated", "error"]),
	sceneName: z.string().optional(),
	error: z.string().optional(),
});
export type ImportSceneBatchResult = z.infer<typeof ImportSceneBatchResultSchema>;

export const ClearAllScenesInputSchema = z.object({
	gameId: z.string().uuid(),
});
export type ClearAllScenesInput = z.infer<typeof ClearAllScenesInputSchema>;

export const ClearAllScenesResultSchema = z.object({
	deletedCount: z.number(),
});
export type ClearAllScenesResult = z.infer<typeof ClearAllScenesResultSchema>;

// ============= 辅助函数 =============

/**
 * 从地图文件名解析 key 和显示名
 * e.g. "map_003_武当山下.mmf" → { key: "map_003_武当山下", name: "003_武当山下" }
 * e.g. "MAP_041_通天塔一层.mmf" → { key: "MAP_041_通天塔一层", name: "041_通天塔一层" }
 */
export function parseMapFileName(fileName: string): { key: string; name: string } {
	const base = fileName.replace(/\.(mmf|map)$/i, "");
	const match = base.match(/^(?:map|MAP)_(\d+_(.+))$/);
	if (match) {
		return { key: base, name: match[1] };
	}
	return { key: base, name: base };
}

/**
 * 从脚本文件名判断类型（陷阱 vs 对话/事件脚本）
 * Trap*.txt → trap
 * 其他 → script
 */
export function classifyScriptFile(fileName: string): SceneItemKind {
	if (/^Trap\d*/i.test(fileName)) {
		return "trap";
	}
	return "script";
}

/**
 * 从 save 文件名判断类型
 * *.npc → npc
 * *.obj → obj
 */
export function classifySaveFile(fileName: string): SceneItemKind | null {
	if (fileName.endsWith(".npc")) return "npc";
	if (fileName.endsWith(".obj")) return "obj";
	return null;
}

/**
 * 从文件名提取显示名
 */
export function extractDisplayName(fileName: string): string {
	return fileName.replace(/\.(txt|npc|obj|ini)$/i, "");
}

// ============= INI 解析函数（前后端共用） =============

/** 解析 INI 文件内容为 sections */
export function parseIniContent(content: string): Record<string, Record<string, string>> {
	const result: Record<string, Record<string, string>> = {};
	let currentSection = "";
	for (const rawLine of content.split(/\r?\n/)) {
		let line = rawLine;
		const sc = line.indexOf(";");
		if (sc >= 0) line = line.substring(0, sc);
		const cc = line.indexOf("//");
		if (cc >= 0) line = line.substring(0, cc);
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			currentSection = trimmed.slice(1, -1).trim();
			if (!result[currentSection]) result[currentSection] = {};
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq > 0 && currentSection) {
			result[currentSection][trimmed.substring(0, eq).trim()] = trimmed.substring(eq + 1).trim();
		}
	}
	return result;
}

/** 从 INI sections 提取 NPC 条目数组 */
export function parseNpcEntries(sections: Record<string, Record<string, string>>): SceneNpcEntry[] {
	const entries: SceneNpcEntry[] = [];
	for (const key of Object.keys(sections)) {
		if (!/^NPC\d+$/i.test(key)) continue;
		const s = sections[key];
		entries.push({
			name: s.Name ?? "",
			kind: Number(s.Kind ?? 0),
			npcIni: s.NpcIni ?? "",
			dir: Number(s.Dir ?? 0),
			mapX: Number(s.MapX ?? 0),
			mapY: Number(s.MapY ?? 0),
			action: Number(s.Action ?? 0),
			walkSpeed: Number(s.WalkSpeed ?? 1),
			state: Number(s.State ?? 0),
			pathFinder: Number(s.PathFinder ?? 0),
			lum: Number(s.Lum ?? 0),
			scriptFile: s.ScriptFile ?? "",
			deathScript: s.DeathScript ?? "",
			dialogRadius: Number(s.DialogRadius ?? 0),
			visionRadius: Number(s.VisionRadius ?? 0),
			relation: Number(s.Relation ?? 0),
			group: Number(s.Group ?? 0),
			attack: Number(s.Attack ?? 0),
			defend: Number(s.Defend ?? 0),
			evade: Number(s.Evade ?? 0),
			attackLevel: Number(s.AttackLevel ?? 0),
			attackRadius: Number(s.AttackRadius ?? 0),
			bodyIni: s.BodyIni ?? "",
			flyIni: s.FlyIni ?? "",
			level: Number(s.Level ?? 0),
			levelUpExp: Number(s.LevelUpExp ?? 0),
			exp: Number(s.Exp ?? 0),
			life: Number(s.Life ?? 0),
			lifeMax: Number(s.LifeMax ?? 0),
			thew: Number(s.Thew ?? 0),
			thewMax: Number(s.ThewMax ?? 0),
			mana: Number(s.Mana ?? 0),
			manaMax: Number(s.ManaMax ?? 0),
			fixedPos: s.FixedPos ?? "",
		});
	}
	return entries;
}

/** 从 INI sections 提取 OBJ 条目数组 */
export function parseObjEntries(sections: Record<string, Record<string, string>>): SceneObjEntry[] {
	const entries: SceneObjEntry[] = [];
	for (const key of Object.keys(sections)) {
		if (!/^OBJ\d+$/i.test(key)) continue;
		const s = sections[key];
		entries.push({
			objName: s.ObjName ?? "",
			objFile: s.ObjFile ?? "",
			wavFile: s.WavFile ?? "",
			scriptFile: s.ScriptFile ?? "",
			kind: Number(s.Kind ?? 0),
			dir: Number(s.Dir ?? 0),
			lum: Number(s.Lum ?? 0),
			mapX: Number(s.MapX ?? 0),
			mapY: Number(s.MapY ?? 0),
			offX: Number(s.OffX ?? 0),
			offY: Number(s.OffY ?? 0),
			damage: Number(s.Damage ?? 0),
			frame: Number(s.Frame ?? 0),
		});
	}
	return entries;
}

/** 从 scene.data 计算子项统计（NPC/OBJ 统计总 entries 数） */
export function getSceneDataCounts(data: SceneData | null | undefined): {
	scriptCount: number;
	trapCount: number;
	npcCount: number;
	objCount: number;
} {
	let npcCount = 0;
	if (data?.npc) {
		for (const v of Object.values(data.npc)) {
			npcCount += v.entries?.length ?? 0;
		}
	}
	let objCount = 0;
	if (data?.obj) {
		for (const v of Object.values(data.obj)) {
			objCount += v.entries?.length ?? 0;
		}
	}
	return {
		scriptCount: data?.scripts ? Object.keys(data.scripts).length : 0,
		trapCount: data?.traps ? Object.keys(data.traps).length : 0,
		npcCount,
		objCount,
	};
}
