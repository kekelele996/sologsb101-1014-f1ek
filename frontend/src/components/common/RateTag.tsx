/**
 * <RateTag> 成活率标签
 * 按成活率区间渲染底色与图标，被地块台账与验收台消费。
 */
import { Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { RATE_LEVEL_LABEL, type RateLevel } from '../../types/survey';
import { effectiveWarnRate, rateLevel } from '../../utils/rate';

export interface RateTagProps {
  /** 成活率（%）；null / undefined 表示暂无验收 */
  rate: number | null | undefined;
  /** 可覆盖自动判定的等级（人工复核结果） */
  level?: RateLevel;
  /** 是否被人工复核过 */
  manual?: boolean;
  /** 所属地块的告警线（%，留空按默认 50%），仅用于提示语 */
  warnRate?: number | null;
  suffix?: string;
  size?: 'default' | 'small';
}

const LEVEL_COLOR: Record<RateLevel, string> = {
  excellent: 'success',
  good: 'processing',
  fair: 'warning',
  poor: 'error',
};

const LEVEL_ICON: Record<RateLevel, typeof CheckCircleOutlined> = {
  excellent: CheckCircleOutlined,
  good: CheckCircleOutlined,
  fair: WarningOutlined,
  poor: CloseCircleOutlined,
};

/** 等级提示语：优 / 良边界固定，一般 / 差随地块告警线浮动 */
function levelHint(level: RateLevel, warnRate: number): string {
  switch (level) {
    case 'excellent':
      return '成活率 ≥ 85%，达到优秀水平';
    case 'good':
      return '成活率 70%–85%，长势良好';
    case 'fair':
      return `成活率不低于告警线 ${warnRate}% 且低于 70%，未触发告警，需加密监测`;
    case 'poor':
      return `成活率低于本地块告警线 ${warnRate}%，必须补植`;
  }
}

export default function RateTag({ rate, level, manual = false, warnRate = null, suffix = '', size = 'default' }: RateTagProps) {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) {
    return (
      <Tag icon={<MinusCircleOutlined />} color="default">
        暂无验收
      </Tag>
    );
  }
  const line = effectiveWarnRate(warnRate);
  const resolved: RateLevel = level ?? rateLevel(rate, line);
  const Icon = LEVEL_ICON[resolved];
  return (
    <Tooltip title={`${levelHint(resolved, line)}${manual ? '（等级经人工复核）' : ''}`}>
      <Tag
        icon={<Icon />}
        color={LEVEL_COLOR[resolved]}
        style={size === 'small' ? { fontSize: 12, lineHeight: '18px', margin: 0 } : undefined}
      >
        {rate.toFixed(1)}%{suffix}
        <span style={{ marginLeft: 6, opacity: 0.85 }}>{RATE_LEVEL_LABEL[resolved]}</span>
        {manual ? <span style={{ marginLeft: 4 }}>· 复核</span> : null}
      </Tag>
    </Tooltip>
  );
}
