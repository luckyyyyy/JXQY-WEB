/**
 * AttrInt / AttrString - INI 配置中的随机值解析
 * /AttrInt.cs and Engine/AttrString.cs
 *
 * 支持的格式：
 * - AttrInt:
 *   - 普通值: "123" → 固定返回 123
 *   - 范围值: "10>20" → 随机返回 10-20 之间的值
 *   - 列表值: "1,2,3,5" → 随机返回列表中的一个值
 *
 * - AttrString:
 *   - 普通值: "abc" → 固定返回 "abc"
 *   - 列表值: "a,b,c" → 随机返回列表中的一个值
 *   - 加权列表: "a[2],b[1],c[3]" → 按权重随机（a=2/6, b=1/6, c=3/6）
 */

import { logger } from "../core/logger";

/**
 * 随机数生成器
 */
function randomInt(min: number, max: number): number {
  // max is inclusive, matching 's Random.Next(min, max+1)
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDouble(): number {
  return Math.random();
}

/**
 * AttrInt - 支持随机整数值的属性类型
 *
 * 解析格式：
 * - "123" → 固定值
 * - "10>20" → 范围 [10, 20]
 * - "1,3,5,7" → 从列表中随机选取
 */
export class AttrInt {
  private readonly value: number;
  private readonly start: number;
  private readonly end: number;
  private readonly isRandom: boolean;
  private readonly randomValues: number[];
  private readonly originalString: string;

  constructor(input: string | number) {
    this.randomValues = [];
    this.isRandom = false;
    this.originalString = "";

    if (typeof input === "number") {
      // 直接传入数值
      this.value = input;
      this.start = input;
      this.end = input;
      return;
    }

    const str = input.trim();
    this.originalString = str;

    if (str.includes(">")) {
      // 范围格式: "10>20"
      const parts = str.split(">");
      this.isRandom = true;
      let startVal = parseInt(parts[0], 10) || 0;
      let endVal = parseInt(parts[1], 10) || 0;

      // 确保 start <= end
      if (startVal > endVal) {
        [startVal, endVal] = [endVal, startVal];
      }

      this.start = startVal;
      this.end = endVal;
      this.value = 0;
    } else if (str.includes(",")) {
      // 列表格式: "1,2,3,5"
      const parts = str.split(",");
      for (const part of parts) {
        const val = parseInt(part.trim(), 10);
        if (!Number.isNaN(val)) {
          this.randomValues.push(val);
        }
      }
      this.isRandom = true;
      this.value = 0;
      this.start = 0;
      this.end = 0;
    } else {
      // 普通值: "123"
      this.isRandom = false;
      this.value = parseInt(str, 10) || 0;
      this.start = this.value;
      this.end = this.value;
    }
  }

  /**
   * 是否为随机属性
   */
  isRand(): boolean {
    return this.isRandom;
  }

  /**
   * 获取一个值（如果是随机属性，则随机选取）
   */
  getOneValue(): number {
    if (this.isRandom) {
      if (this.randomValues.length > 0) {
        const index = randomInt(0, this.randomValues.length - 1);
        return this.randomValues[index];
      }
      return randomInt(this.start, this.end);
    }
    return this.value;
  }

  /**
   * 获取最大值（用于显示上限）
   */
  getMaxValue(): number {
    if (this.isRandom) {
      if (this.randomValues.length > 0) {
        return this.randomValues[this.randomValues.length - 1];
      }
      return this.end;
    }
    return this.value;
  }

  /**
   * 获取最小值
   */
  getMinValue(): number {
    if (this.isRandom) {
      if (this.randomValues.length > 0) {
        return this.randomValues[0];
      }
      return this.start;
    }
    return this.value;
  }

  /**
   * 获取一个非随机的 AttrInt（使用 getOneValue 的结果）
   */
  getNonRandom(): AttrInt {
    return new AttrInt(this.getOneValue());
  }

  /**
   * 获取字符串表示（用于保存）
   */
  getString(): string {
    if (this.isRandom) {
      if (this.randomValues.length > 0) {
        return this.randomValues.join(",");
      }
      return `${this.start}-${this.end}`;
    }
    return this.value.toString();
  }

  /**
   * 获取 UI 显示字符串（带符号）
   * 例如: "+10>20" 或 "-5"
   */
  getUIString(): string {
    if (this.isRandom) {
      if (this.randomValues.length > 0) {
        return this.randomValues.join(",");
      }
      if (this.start < 0) {
        return `${this.formatWithSign(this.end)}>${Math.abs(this.start)}`;
      }
      return `${this.formatWithSign(this.start)}>${Math.abs(this.end)}`;
    }
    return this.formatWithSign(this.value);
  }

  /**
   * 格式化带符号的数值
   */
  private formatWithSign(value: number): string {
    if (value > 0) return `+${value}`;
    if (value < 0) return `${value}`;
    return "0";
  }
}

/**
 * AttrString 的加权项信息
 */
interface RandItemInfo {
  value: string;
  weight: number; // NaN 表示默认权重 1
}

/**
 * AttrString - 支持随机字符串值的属性类型
 *
 * 解析格式：
 * - "abc" → 固定值
 * - "a,b,c" → 等概率随机选取
 * - "a[2],b[1],c[3]" → 按权重随机（a=2/6, b=1/6, c=3/6）
 */
export class AttrString {
  private readonly value: string;
  private readonly isRandom: boolean;
  private readonly randomValues: RandItemInfo[];
  private readonly probabilities: number[];

  constructor(str: string) {
    this.randomValues = [];
    this.probabilities = [];

    const trimmed = str.trim();

    if (trimmed.includes(",")) {
      // 列表格式
      this.isRandom = true;
      this.value = "";

      const items = trimmed.split(",");
      for (const item of items) {
        const trimmedItem = item.trim();
        let itemValue = trimmedItem;
        let weight = NaN; // NaN 表示默认权重

        // 检查是否有权重: "value[weight]"
        if (trimmedItem.endsWith("]")) {
          const startIdx = trimmedItem.lastIndexOf("[");
          if (startIdx !== -1) {
            itemValue = trimmedItem.substring(0, startIdx);
            const weightStr = trimmedItem.substring(startIdx + 1, trimmedItem.length - 1);
            weight = parseFloat(weightStr);
            if (Number.isNaN(weight)) {
              weight = NaN; // 解析失败使用默认权重
            }
          }
        }

        this.randomValues.push({ value: itemValue, weight });
      }

      // 计算累积概率
      let total = 0;
      for (const r of this.randomValues) {
        total += Number.isNaN(r.weight) ? 1 : r.weight;
      }

      let cumulative = 0;
      for (const r of this.randomValues) {
        cumulative += (Number.isNaN(r.weight) ? 1 : r.weight) / total;
        this.probabilities.push(cumulative);
      }
    } else {
      // 普通值
      this.isRandom = false;
      this.value = trimmed;
    }
  }

  /**
   * 是否为随机属性
   */
  isRand(): boolean {
    return this.isRandom;
  }

  /**
   * 获取一个值（如果是随机属性，则按权重随机选取）
   */
  getOneValue(): string {
    if (this.isRandom) {
      if (this.randomValues.length > 0) {
        const rand = randomDouble();
        for (let i = 0; i < this.randomValues.length; i++) {
          if (this.probabilities[i] >= rand) {
            return this.randomValues[i].value;
          }
        }
      }
      return "";
    }
    return this.value;
  }

  /**
   * 获取固定值（如果是随机属性会报警告）
   */
  getValue(): string {
    if (this.isRandom) {
      logger.warn(`[AttrString] Accessing random attribute as fixed value: ${this.getString()}`);
    }
    return this.value;
  }

  /**
   * 获取字符串表示（用于保存）
   */
  getString(): string {
    if (this.isRandom) {
      if (this.randomValues.length > 0) {
        return this.randomValues
          .map((r) => {
            if (Number.isNaN(r.weight)) {
              return r.value;
            }
            return `${r.value}[${r.weight}]`;
          })
          .join(",");
      }
    }
    return this.value;
  }
}

// ============= 工具函数 =============
