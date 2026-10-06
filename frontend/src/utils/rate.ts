/**
 * 成活率与密度计算工具
 * - 亩 ↔ 平方米换算
 * - 成活率、成活率等级
 * - 栽植密度合理性校验阈值
 * - 株高增幅与补植建议
 */
import { RATE_LEVEL_LABEL, type RateLevel } from '../types/survey';

/** 1 亩 = 666.6667 平方米 */
export const MU_TO_M2 = 666.6667;

/** 成活率优秀下限（%） */
export const SURVIVAL_EXCELLENT_RATE = 85;
/** 成活率良好下限（%） */
export const SURVIVAL_GOOD_RATE = 70;
/**
 * 默认告警线（%）——地块台账未单独填写告警线时生效。
 * 告警线既是「是否告警」的判据，也是等级「差 / 一般」的分界。
 */
export const SURVIVAL_WARN_RATE = 50;

/** 地块告警线允许填写的范围（%），留空则按 {@link SURVIVAL_WARN_RATE} */
export const WARN_RATE_MIN = 1;
export const WARN_RATE_MAX = 99;

/** 单株苗木合理占地面积下限（㎡/株），低于该值视为过密 */
export const DENSITY_MIN_M2_PER_PLANT = 0.6;
/** 单株苗木合理占地面积上限（㎡/株），高于该值视为过疏 */
export const DENSITY_MAX_M2_PER_PLANT = 12;

/** 保留 1 位小数 */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 亩 → 平方米 */
export function muToM2(areaMu: number): number {
  return areaMu * MU_TO_M2;
}

/** 平方米 → 亩 */
export function m2ToMu(areaM2: number): number {
  return areaM2 / MU_TO_M2;
}

/**
 * 成活率（%）= 成活株数 / 栽植总株数 × 100
 * 栽植总株数为 0 时返回 0，避免除零。
 */
export function calcSurvivalRate(aliveCount: number, totalCount: number): number {
  if (!Number.isFinite(aliveCount) || !Number.isFinite(totalCount) || totalCount <= 0) return 0;
  return round1(Math.max(0, Math.min(100, (aliveCount / totalCount) * 100)));
}

/**
 * 归一化地块告警线：留空（null / undefined）或非法值一律回落默认 50%。
 * 生效后的告警线被裁剪到 [WARN_RATE_MIN, WARN_RATE_MAX]，避免出现 0% / 100% 这类退化配置。
 */
export function effectiveWarnRate(warnRate: number | null | undefined): number {
  if (typeof warnRate !== 'number' || !Number.isFinite(warnRate)) return SURVIVAL_WARN_RATE;
  return Math.min(WARN_RATE_MAX, Math.max(WARN_RATE_MIN, warnRate));
}

/**
 * 按成活率与地块告警线判定等级：
 * ≥85 优，70–85 良，[告警线, 70) 一般，< 告警线 差。
 * 告警线抬到 70 以上时，低于告警线的区间仍从严归「差」，保证「报警 ⟺ 差」。
 */
export function rateLevel(rate: number, warnRate: number | null | undefined = SURVIVAL_WARN_RATE): RateLevel {
  if (rate >= SURVIVAL_EXCELLENT_RATE) return 'excellent';
  if (rate >= SURVIVAL_GOOD_RATE) return 'good';
  if (rate >= effectiveWarnRate(warnRate)) return 'fair';
  return 'poor';
}

/** 成活率是否低于地块告警线（严格小于才告警，恰好压线不报警） */
export function isBelowWarnRate(rate: number, warnRate: number | null | undefined): boolean {
  return rate < effectiveWarnRate(warnRate);
}

/** 等级中文名 */
export function rateLevelLabel(level: RateLevel): string {
  return RATE_LEVEL_LABEL[level];
}

/** 按株距与面积推算理论株数 */
export function expectedCountBySpacing(areaMu: number, spacingM: number): number {
  if (spacingM <= 0) return 0;
  const areaM2 = muToM2(areaMu);
  return Math.round(areaM2 / (spacingM * spacingM));
}

/** 按面积与株数反推平均单株占地面积（㎡/株） */
export function areaPerPlant(areaMu: number, count: number): number {
  if (count <= 0) return 0;
  return round1(muToM2(areaMu) / count);
}

export interface DensityCheck {
  /** 是否落在合理区间 */
  ok: boolean;
  /** 平均单株占地面积（㎡/株） */
  areaPerPlant: number;
  /** 按株距推算的理论株数 */
  expectedCount: number;
  /** 实际株数相对理论株数的偏差（%） */
  deviationPct: number;
  /** 面向用户的提示文案 */
  message: string;
  level: 'success' | 'warning' | 'error';
}

/** 栽植密度合理性校验：面积 + 株距 + 实际株数 */
export function checkDensity(areaMu: number, spacingM: number, count: number): DensityCheck {
  const perPlant = areaPerPlant(areaMu, count);
  const expected = expectedCountBySpacing(areaMu, spacingM);
  const deviationPct = expected > 0 ? round1(((count - expected) / expected) * 100) : 0;

  if (areaMu <= 0 || count <= 0) {
    return {
      ok: false,
      areaPerPlant: 0,
      expectedCount: expected,
      deviationPct,
      message: '请先填写有效的地块面积与栽植株数，再校验密度。',
      level: 'error',
    };
  }

  if (perPlant < DENSITY_MIN_M2_PER_PLANT) {
    return {
      ok: false,
      areaPerPlant: perPlant,
      expectedCount: expected,
      deviationPct,
      message: `平均单株占地仅 ${perPlant} ㎡/株，低于 ${DENSITY_MIN_M2_PER_PLANT} ㎡/株，栽植过密，请放大株距。`,
      level: 'error',
    };
  }

  if (perPlant > DENSITY_MAX_M2_PER_PLANT) {
    return {
      ok: false,
      areaPerPlant: perPlant,
      expectedCount: expected,
      deviationPct,
      message: `平均单株占地 ${perPlant} ㎡/株，高于 ${DENSITY_MAX_M2_PER_PLANT} ㎡/株，栽植过疏，成活率统计口径可能失真。`,
      level: 'warning',
    };
  }

  return {
    ok: true,
    areaPerPlant: perPlant,
    expectedCount: expected,
    deviationPct,
    message: `平均单株占地 ${perPlant} ㎡/株，落在合理区间 ${DENSITY_MIN_M2_PER_PLANT}–${DENSITY_MAX_M2_PER_PLANT} ㎡/株；按株距推算理论株数 ${expected} 株，实际偏差 ${deviationPct}%。`,
    level: 'success',
  };
}

/** 株高增幅：返回绝对增量与百分比 */
export function heightGrowth(previousCm: number, currentCm: number): { delta: number; pct: number } {
  if (!Number.isFinite(previousCm) || previousCm <= 0) return { delta: round1(currentCm), pct: 0 };
  return { delta: round1(currentCm - previousCm), pct: round1(((currentCm - previousCm) / previousCm) * 100) };
}

/** 补植建议株数：栽植总株数 - 成活株数（不低于 0） */
export function suggestReplantCount(totalCount: number, aliveCount: number): number {
  return Math.max(0, Math.round(totalCount - aliveCount));
}

/** 百分比文案 */
export function percentText(value: number): string {
  return `${round1(value)}%`;
}
