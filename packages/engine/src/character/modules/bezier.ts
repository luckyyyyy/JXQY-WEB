/**
 * Bezier curve utilities
 * 贝塞尔曲线工具 - 用于角色跳跃移动
 * Reference: Engine/Lib/BezierCurve.cs
 */
import type { Vector2 } from "../../core/types";

/**
 * Factorial lookup table (precomputed up to 32)
 * 阶乘查找表（预计算到 32）
 */
const FACTORIAL_LOOKUP: readonly number[] = [
  1.0, 1.0, 2.0, 6.0, 24.0, 120.0, 720.0, 5040.0, 40320.0, 362880.0, 3628800.0, 39916800.0,
  479001600.0, 6227020800.0, 87178291200.0, 1307674368000.0, 20922789888000.0, 355687428096000.0,
  6402373705728000.0, 121645100408832000.0, 2432902008176640000.0, 51090942171709440000.0,
  1124000727777607680000.0, 25852016738884976640000.0, 620448401733239439360000.0,
  15511210043330985984000000.0, 403291461126605635584000000.0, 10888869450418352160768000000.0,
  304888344611713860501504000000.0, 8841761993739701954543616000000.0,
  265252859812191058636308480000000.0, 8222838654177922817725562880000000.0,
  263130836933693530167218012160000000.0,
];

/**
 * Factorial
 * 阶乘
 * n)
 */
function factorial(n: number): number {
  if (n < 0 || n > 32) {
    throw new Error(`Factorial: n must be between 0 and 32, got ${n}`);
  }
  return FACTORIAL_LOOKUP[n];
}

/**
 * Binomial coefficient C(n, i) = n! / (i! * (n-i)!)
 * 二项式系数
 * n, int i)
 */
function binomialCoefficient(n: number, i: number): number {
  return factorial(n) / (factorial(i) * factorial(n - i));
}

/**
 * Bernstein basis polynomial
 * 伯恩斯坦基函数
 * n, int i, double t)
 */
function bernstein(n: number, i: number, t: number): number {
  // t^i
  const ti = t === 0.0 && i === 0 ? 1.0 : t ** i;
  // (1 - t)^(n-i)
  const tni = n === i && t === 1.0 ? 1.0 : (1 - t) ** (n - i);
  return binomialCoefficient(n, i) * ti * tni;
}

/**
 * Calculate points on a Bezier curve
 * 计算贝塞尔曲线上的点
 * Reference: BezierCurve.Bezier2D(List<Vector2> inPoints, int outPointsCount)
 *
 * @param controlPoints Control points array / 控制点数组
 * @param outputPointCount Number of output points / 输出点数量
 * @returns Points on the Bezier curve / 贝塞尔曲线上的点数组
 */
export function bezier2D(controlPoints: readonly Vector2[], outputPointCount: number): Vector2[] {
  const n = controlPoints.length - 1; // n-degree Bezier curve
  const result: Vector2[] = [];
  const step = 1.0 / (outputPointCount - 1);

  for (let j = 0; j < outputPointCount; j++) {
    let t = j * step;
    // Ensure the last point is exactly 1.0
    if (1.0 - t < 5e-6) {
      t = 1.0;
    }

    let x = 0;
    let y = 0;
    for (let i = 0; i <= n; i++) {
      const basis = bernstein(n, i, t);
      x += basis * controlPoints[i].x;
      y += basis * controlPoints[i].y;
    }
    result.push({ x, y });
  }

  return result;
}
