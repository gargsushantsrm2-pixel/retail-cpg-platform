/**
 * Waterfall chart built with Recharts BarChart.
 * Uses stacked bars: invisible "base" offsets the visible bar segment.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { fmtCurrency } from '../../lib/utils'
import { CHART_STYLE, tooltipStyle } from '../../lib/chartTheme'
import type { WaterfallItem } from '../../types'

interface Props {
  data:   WaterfallItem[]
  height?: number
}

function buildWaterfallData(items: WaterfallItem[]) {
  let running = 0
  return items.map((item) => {
    if (item.type === 'total') {
      const base = 0
      const value = item.value
      running = value
      return { label: item.label, base, value, isTotal: true, raw: item.value }
    }
    const base = item.value >= 0 ? running : running + item.value
    const abs = Math.abs(item.value)
    running += item.value
    return { label: item.label, base, value: abs, isPositive: item.value >= 0, isTotal: false, raw: item.value }
  })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color: d?.isTotal ? '#3B82F6' : d?.isPositive ? '#10B981' : '#EF4444' }}>
        {d?.isTotal ? '' : d?.isPositive ? '+' : '-'}{fmtCurrency(Math.abs(d?.raw ?? 0))}
      </p>
    </div>
  )
}

export default function WaterfallChart({ data, height = 320 }: Props) {
  const chartData = buildWaterfallData(data)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ ...CHART_STYLE.tickStyle }} axisLine={CHART_STYLE.axis} tickLine={false} />
        <YAxis
          tickFormatter={(v) => fmtCurrency(v)}
          tick={{ ...CHART_STYLE.tickStyle }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#2D3460" />
        {/* invisible base bar */}
        <Bar dataKey="base" stackId="wf" fill="transparent" />
        {/* visible segment */}
        <Bar dataKey="value" stackId="wf" radius={[4, 4, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell
              key={i}
              fill={d.isTotal ? '#3B82F6' : d.isPositive ? '#10B981' : '#EF4444'}
              opacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
