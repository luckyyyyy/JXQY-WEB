// =============================================================================
// Map Definitions
// =============================================================================

import { ResourcePath } from "../config/resourcePaths";

export interface MapInfo {
  name: string;
  path: string;
}

/** 地图文件名列表（不含路径前缀） */
const MAP_FILES = [
  { name: "凌绝峰连接地图", file: "map_001_凌绝峰连接地图.map" },
  { name: "凌绝峰峰顶", file: "map_002_凌绝峰峰顶.map" },
  { name: "武当山下", file: "map_003_武当山下.map" },
  { name: "武当山连接地图", file: "map_004_武当山连接地图.map" },
  { name: "洗剑池", file: "map_005_洗剑池.map" },
  { name: "武当山山顶", file: "map_006_武当山山顶.map" },
  { name: "连接地图 007", file: "map_007_连接地图.map" },
  { name: "野树林", file: "map_008_野树林.map" },
  { name: "山洞内部 009", file: "map_009_山洞内部.map" },
  { name: "山洞内部 010", file: "map_010_山洞内部.map" },
  { name: "连接地图 011", file: "map_011_连接地图.map" },
  { name: "惠安镇", file: "map_012_惠安镇.map" },
  { name: "连接地图 014", file: "map_014_连接地图.map" },
  { name: "藏剑山庄", file: "map_015_藏剑山庄.map" },
  { name: "剑气峰", file: "map_016_剑气峰.map" },
  { name: "连接地图 017", file: "map_017_连接地图.map" },
  { name: "连接地图 018", file: "map_018_连接地图.map" },
  { name: "寒波谷", file: "map_019_寒波谷.map" },
  { name: "寒波谷 (A)", file: "map_019_寒波谷(A).map" },
  { name: "寒波谷 (B)", file: "map_019_寒波谷(B).map" },
  { name: "樱花谷", file: "map_020_樱花谷.map" },
  { name: "油菜花地", file: "map_021_油菜花地.map" },
  { name: "清平乡", file: "map_022_清平乡.map" },
  { name: "连接地图 023", file: "map_023_连接地图.map" },
  { name: "倚天山", file: "map_024_倚天山.map" },
  { name: "摘星楼", file: "map_025_摘星楼.map" },
  { name: "摘星楼地下", file: "map_026_摘星楼地下.map" },
  { name: "连接地图 027", file: "map_027_连接地图.map" },
  { name: "连接地图 028", file: "map_028_连接地图.map" },
  { name: "码头", file: "map_029_码头.map" },
  { name: "悲魔山庄", file: "map_030_悲魔山庄.map" },
  { name: "连接地图 031", file: "map_031_连接地图.map" },
  { name: "天山", file: "map_032_天山.map" },
  { name: "落叶谷", file: "map_033_落叶谷.map" },
  { name: "落叶谷 (破坏后)", file: "map_033_落叶谷(破坏后).map" },
  { name: "天池", file: "map_034_天池.map" },
  { name: "天池内部", file: "map_035_天池内部.map" },
  { name: "连接地图 036", file: "map_036_连接地图.map" },
  { name: "敦煌十洞", file: "map_037_敦煌十洞.map" },
  { name: "连接地图 038", file: "map_038_连接地图.map" },
  { name: "飞龙堡", file: "map_039_飞龙堡.map" },
  { name: "沙漠", file: "map_040_沙漠.map" },
  { name: "通天塔一层", file: "MAP_041_通天塔一层.map" },
  { name: "通天塔二层", file: "MAP_042_通天塔二层.map" },
  { name: "通天塔第三层", file: "map_043_通天塔第三层.map" },
  { name: "通天塔四层", file: "MAP_044_通天塔四层.map" },
  { name: "通天塔第五层", file: "map_045_通天塔第五层.map" },
  { name: "通天塔第六层", file: "map_046_通天塔第六层.map" },
  { name: "通天塔第七层", file: "map_047_通天塔第七层.map" },
  { name: "通天塔第八层", file: "map_049_通天塔第八层.map" },
  { name: "忘忧岛", file: "map_050_忘忧岛.map" },
  { name: "海边", file: "map_051_海边.map" },
  { name: "码头 052", file: "map_052_码头.map" },
  { name: "连接地图 053", file: "map_053_连接地图.map" },
  { name: "北山", file: "map_054_北山.map" },
  { name: "山洞", file: "map_055_山洞.map" },
  { name: "盆地", file: "map_056_盆地.map" },
  { name: "盆地加坟墓", file: "map_056_盆地加坟墓.map" },
  { name: "连接地图 057", file: "map_057_连接地图.map" },
  { name: "禁地", file: "map_058_禁地.map" },
  { name: "禁地一层", file: "map_059_禁地一层.map" },
  { name: "禁地二层", file: "map_060_禁地二层.map" },
  { name: "禁地三层", file: "map_061_禁地三层.map" },
  { name: "禁地密室", file: "map_062_禁地密室.map" },
  { name: "药王谷", file: "map_063_药王谷.map" },
  { name: "霹雳堂", file: "map_064_霹雳堂.map" },
  { name: "霹雳堂被炸后", file: "map_064_霹雳堂被炸后.map" },
  { name: "天山古道", file: "map_065_天山古道.map" },
] as const;

/** 动态生成地图列表，使用配置的资源路径 */
export const MAPS: MapInfo[] = MAP_FILES.map(({ name, file }) => ({
  name,
  path: ResourcePath.map(file),
}));
