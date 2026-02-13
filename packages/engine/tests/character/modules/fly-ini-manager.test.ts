/**
 * FlyIniManager tests - 技能配置管理器
 */
import { describe, expect, it, vi } from "vitest";
import { FlyIniManager, parseMagicList, parseMagicListNoDistance } from "../../../src/character/modules/fly-ini-manager";

vi.mock("../../../src/core/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ========== Pure parsers ==========

describe("parseMagicList", () => {
  it("returns empty array for empty string", () => {
    expect(parseMagicList("")).toEqual([]);
  });

  it("parses single magic without distance", () => {
    const result = parseMagicList("FireBall");
    expect(result).toEqual([{ magicIni: "FireBall", useDistance: 0 }]);
  });

  it("parses single magic with distance", () => {
    const result = parseMagicList("FireBall:5");
    expect(result).toEqual([{ magicIni: "FireBall", useDistance: 5 }]);
  });

  it("parses multiple magics separated by semicolon", () => {
    const result = parseMagicList("FireBall:3;IceBolt:10;Heal");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ magicIni: "FireBall", useDistance: 3 });
    expect(result[1]).toEqual({ magicIni: "IceBolt", useDistance: 10 });
    expect(result[2]).toEqual({ magicIni: "Heal", useDistance: 0 });
  });

  it("supports Chinese semicolons", () => {
    const result = parseMagicList("火球术：3；冰箭术：10");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ magicIni: "火球术", useDistance: 3 });
    expect(result[1]).toEqual({ magicIni: "冰箭术", useDistance: 10 });
  });

  it("skips empty parts", () => {
    const result = parseMagicList("FireBall;;IceBolt");
    expect(result).toHaveLength(2);
  });

  it("trims outer whitespace but colon must be adjacent to digit", () => {
    // regex is /^(.+?)[：:](\d+)$/ — spaces around colon prevent match
    const result = parseMagicList("  FireBall : 5 ;  IceBolt  ");
    expect(result).toHaveLength(2);
    // "FireBall : 5" doesn't match colon pattern → treated as magicIni with distance 0
    expect(result[0].magicIni).toBe("FireBall : 5");
    expect(result[0].useDistance).toBe(0);
    expect(result[1].magicIni).toBe("IceBolt");
  });
});

describe("parseMagicListNoDistance", () => {
  it("returns empty array for empty string", () => {
    expect(parseMagicListNoDistance("")).toEqual([]);
  });

  it("strips distance from entries", () => {
    const result = parseMagicListNoDistance("FireBall:5;IceBolt:10;Heal");
    expect(result).toEqual(["FireBall", "IceBolt", "Heal"]);
  });

  it("handles Chinese punctuation", () => {
    const result = parseMagicListNoDistance("火球术：3；冰箭术");
    expect(result).toEqual(["火球术", "冰箭术"]);
  });
});

// ========== FlyIniManager class ==========

describe("FlyIniManager", () => {
  it("starts empty", () => {
    const mgr = new FlyIniManager();
    expect(mgr.length).toBe(0);
    expect(mgr.hasMagicConfigured).toBe(false);
    expect(mgr.flyIniInfos).toEqual([]);
  });

  describe("build", () => {
    it("builds from flyIni only", () => {
      const mgr = new FlyIniManager();
      mgr.flyIni = "FireBall.ini";
      mgr.build(5);

      expect(mgr.length).toBe(1);
      expect(mgr.flyIniInfos[0]).toEqual({ useDistance: 5, magicIni: "FireBall.ini" });
    });

    it("builds from flyIni + flyIni2", () => {
      const mgr = new FlyIniManager();
      mgr.flyIni = "FireBall.ini";
      mgr.flyIni2 = "IceBolt.ini";
      mgr.build(3);

      expect(mgr.length).toBe(2);
      // Both use attackRadius=3
      expect(mgr.flyIniInfos[0].useDistance).toBe(3);
      expect(mgr.flyIniInfos[1].useDistance).toBe(3);
    });

    it("builds from flyInis (multi magic list with distances)", () => {
      const mgr = new FlyIniManager();
      mgr.flyInis = "Close.ini:2;Mid.ini:8;Far.ini:15";
      mgr.build(5);

      expect(mgr.length).toBe(3);
      // Should be sorted by useDistance ascending
      expect(mgr.flyIniInfos[0].useDistance).toBe(2);
      expect(mgr.flyIniInfos[1].useDistance).toBe(8);
      expect(mgr.flyIniInfos[2].useDistance).toBe(15);
    });

    it("sorts all entries by useDistance", () => {
      const mgr = new FlyIniManager();
      mgr.flyIni = "Main.ini"; // will use attackRadius=10
      mgr.flyInis = "Close.ini:2;Far.ini:20";
      mgr.build(10);

      // Close(2), Main(10), Far(20)
      expect(mgr.flyIniInfos.map((f) => f.useDistance)).toEqual([2, 10, 20]);
    });

    it("uses attackRadius for flyInis without distance", () => {
      const mgr = new FlyIniManager();
      mgr.flyInis = "NoDist.ini";
      mgr.build(7);

      expect(mgr.flyIniInfos[0].useDistance).toBe(7);
    });
  });

  describe("getClosedAttackRadius", () => {
    it("returns 1 when no magic configured", () => {
      const mgr = new FlyIniManager();
      expect(mgr.getClosedAttackRadius(10)).toBe(1);
    });

    it("returns closest distance not exceeding target", () => {
      const mgr = new FlyIniManager();
      mgr.flyInis = "Close.ini:3;Mid.ini:8;Far.ini:15";
      mgr.build(5);

      expect(mgr.getClosedAttackRadius(10)).toBe(8);
      expect(mgr.getClosedAttackRadius(3)).toBe(3);
      expect(mgr.getClosedAttackRadius(20)).toBe(15);
    });

    it("returns min distance when target is very small", () => {
      const mgr = new FlyIniManager();
      mgr.flyInis = "A.ini:5;B.ini:10";
      mgr.build(5);

      expect(mgr.getClosedAttackRadius(1)).toBe(5);
    });
  });

  describe("getRandomMagicWithUseDistance", () => {
    it("returns null when empty", () => {
      const mgr = new FlyIniManager();
      expect(mgr.getRandomMagicWithUseDistance(5)).toBeNull();
    });

    it("returns magic with exact distance match", () => {
      const mgr = new FlyIniManager();
      mgr.flyInis = "A.ini:3;B.ini:8;C.ini:15";
      mgr.build(5);

      expect(mgr.getRandomMagicWithUseDistance(8)).toBe("B.ini");
    });

    it("returns closest when no exact match", () => {
      const mgr = new FlyIniManager();
      mgr.flyInis = "A.ini:3;B.ini:15";
      mgr.build(5);

      // 8 > 3 but < 15, so returns A.ini (i-1)
      expect(mgr.getRandomMagicWithUseDistance(8)).toBe("A.ini");
    });

    it("returns last magic when distance exceeds all", () => {
      const mgr = new FlyIniManager();
      mgr.flyInis = "A.ini:3;B.ini:8";
      mgr.build(5);

      expect(mgr.getRandomMagicWithUseDistance(100)).toBe("B.ini");
    });
  });

  describe("replaceMagicList / recoverMagicList", () => {
    it("replaces and recovers magic list", () => {
      const mgr = new FlyIniManager();
      mgr.flyIni = "Original.ini";
      mgr.build(5);
      expect(mgr.length).toBe(1);
      expect(mgr.hasBackup).toBe(false);

      // Replace
      mgr.replaceMagicList("Transformed.ini:3;Super.ini:10", 5);
      expect(mgr.hasBackup).toBe(true);
      expect(mgr.length).toBe(2);
      expect(mgr.flyIniInfos[0].magicIni).toBe("Transformed.ini");

      // Recover
      mgr.recoverMagicList();
      expect(mgr.hasBackup).toBe(false);
      expect(mgr.length).toBe(1);
      expect(mgr.flyIniInfos[0].magicIni).toBe("Original.ini");
    });

    it("replaces with '无' clears list", () => {
      const mgr = new FlyIniManager();
      mgr.flyIni = "Original.ini";
      mgr.build(5);

      mgr.replaceMagicList("无", 5);
      expect(mgr.length).toBe(0);
      expect(mgr.hasBackup).toBe(true);
    });

    it("does nothing when listStr is empty", () => {
      const mgr = new FlyIniManager();
      mgr.flyIni = "Original.ini";
      mgr.build(5);

      mgr.replaceMagicList("", 5);
      expect(mgr.length).toBe(1); // unchanged
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      const mgr = new FlyIniManager();
      mgr.flyIni = "Test.ini";
      mgr.flyIni2 = "Test2.ini";
      mgr.flyInis = "A:1;B:2";
      mgr.build(5);

      mgr.reset();
      expect(mgr.flyIni).toBe("");
      expect(mgr.flyIni2).toBe("");
      expect(mgr.flyInis).toBe("");
      expect(mgr.length).toBe(0);
      expect(mgr.hasBackup).toBe(false);
    });
  });
});
