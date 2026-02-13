import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setResourcePaths,
  getResourceRoot,
  buildPath,
  extractRelativePath,
  ResourcePath,
  ResourceDirs,
  normalizeCacheKey,
  isResourcePath,
  ensureResourcePath,
  resolveScriptPath,
  resetResourcePaths,
} from "../../src/resource/resource-paths";

// Mock import.meta.env
vi.stubGlobal("import", { meta: { env: {} } });

describe("resourcePaths", () => {
  beforeEach(() => {
    resetResourcePaths();
  });

  afterEach(() => {
    resetResourcePaths();
  });

  describe("setResourcePaths / getResourceRoot", () => {
    it("default root is /resources", () => {
      expect(getResourceRoot()).toBe("/resources");
    });

    it("can set custom root", () => {
      setResourcePaths({ root: "/game/demo/resources" });
      expect(getResourceRoot()).toBe("/game/demo/resources");
    });
  });

  describe("buildPath", () => {
    it("joins root with relative path", () => {
      expect(buildPath("map/test.map")).toBe("/resources/map/test.map");
    });

    it("strips leading slash from relative path", () => {
      expect(buildPath("/map/test.map")).toBe("/resources/map/test.map");
    });

    it("converts backslashes to forward slashes", () => {
      expect(buildPath("map\\test.map")).toBe("/resources/map/test.map");
    });

    it("respects custom root", () => {
      setResourcePaths({ root: "/game/demo/resources" });
      expect(buildPath("map/test.map")).toBe("/game/demo/resources/map/test.map");
    });
  });

  describe("extractRelativePath", () => {
    it("extracts relative path when full path starts with root", () => {
      const rel = extractRelativePath("/resources/map/test.map");
      expect(rel).toBe("map/test.map");
    });

    it("returns path as-is if no root prefix", () => {
      const rel = extractRelativePath("some/other/path.txt");
      expect(rel).toBe("some/other/path.txt");
    });

    it("handles custom root", () => {
      setResourcePaths({ root: "/game/demo/resources" });
      const rel = extractRelativePath("/game/demo/resources/map/test.map");
      expect(rel).toBe("map/test.map");
    });
  });

  describe("ResourcePath builders", () => {
    it("map()", () => {
      expect(ResourcePath.map("test.map")).toBe("/resources/map/test.map");
    });

    it("asfCharacter()", () => {
      expect(ResourcePath.asfCharacter("hero.asf")).toBe("/resources/asf/character/hero.asf");
    });

    it("npc()", () => {
      expect(ResourcePath.npc("小花.ini")).toBe("/resources/ini/npc/小花.ini");
    });

    it("obj()", () => {
      expect(ResourcePath.obj("门.ini")).toBe("/resources/ini/obj/门.ini");
    });

    it("goods()", () => {
      expect(ResourcePath.goods("sword.ini")).toBe("/resources/ini/goods/sword.ini");
    });

    it("magic()", () => {
      expect(ResourcePath.magic("fireball.ini")).toBe("/resources/ini/magic/fireball.ini");
    });

    it("scriptCommon()", () => {
      expect(ResourcePath.scriptCommon("init.txt")).toBe("/resources/script/common/init.txt");
    });

    it("scriptMap()", () => {
      expect(ResourcePath.scriptMap("town1")).toBe("/resources/script/map/town1");
    });

    it("music()", () => {
      expect(ResourcePath.music("bgm01.ogg")).toBe("/resources/content/music/bgm01.ogg");
    });

    it("sound()", () => {
      expect(ResourcePath.sound("click.wav")).toBe("/resources/content/sound/click.wav");
    });

    it("mpcMap()", () => {
      expect(ResourcePath.mpcMap("tiles.mpc")).toBe("/resources/mpc/map/tiles.mpc");
    });

    it("from()", () => {
      expect(ResourcePath.from("custom/path.dat")).toBe("/resources/custom/path.dat");
    });
  });

  describe("ResourceDirs", () => {
    it("has correct map directory", () => {
      expect(ResourceDirs.map).toBe("map");
    });

    it("has correct ini subdirectories", () => {
      expect(ResourceDirs.ini.npc).toBe("ini/npc");
      expect(ResourceDirs.ini.magic).toBe("ini/magic");
      expect(ResourceDirs.ini.goods).toBe("ini/goods");
    });

    it("has correct script subdirectories", () => {
      expect(ResourceDirs.script.common).toBe("script/common");
      expect(ResourceDirs.script.map).toBe("script/map");
    });
  });

  describe("isResourcePath", () => {
    it("returns true for resource paths", () => {
      expect(isResourcePath("/resources/map/test.map")).toBe(true);
    });

    it("returns false for non-resource paths", () => {
      expect(isResourcePath("/other/path")).toBe(false);
    });
  });

  describe("ensureResourcePath", () => {
    it("returns path as-is if already resource path", () => {
      expect(ensureResourcePath("/resources/map/test.map")).toBe("/resources/map/test.map");
    });

    it("adds root prefix if not resource path", () => {
      expect(ensureResourcePath("map/test.map")).toBe("/resources/map/test.map");
    });
  });

  describe("resolveScriptPath", () => {
    it("uses scriptFile directly for absolute paths", () => {
      expect(resolveScriptPath("/base", "/abs/script.txt")).toBe("/abs/script.txt");
    });

    it("joins basePath and scriptFile for relative paths", () => {
      expect(resolveScriptPath("/base/dir", "script.txt")).toBe("/base/dir/script.txt");
    });
  });

  describe("normalizeCacheKey", () => {
    it("normalizes to lowercase", () => {
      expect(normalizeCacheKey("小花.INI", ["ini/npc/"])).toBe("小花.ini");
    });

    it("strips matching prefix", () => {
      expect(normalizeCacheKey("ini/npc/小花.ini", ["ini/npc/", "ini/partner/"])).toBe("小花.ini");
    });

    it("strips resource root", () => {
      expect(normalizeCacheKey("/resources/ini/npc/小花.ini", ["ini/npc/"])).toBe("小花.ini");
    });

    it("converts backslashes", () => {
      expect(normalizeCacheKey("ini\\npc\\小花.ini", ["ini/npc/"])).toBe("小花.ini");
    });

    it("only strips first matching prefix", () => {
      expect(normalizeCacheKey("ini/npc/file.ini", ["ini/npc/", "ini/"])).toBe("file.ini");
    });
  });
});
