export const COLORS = {
  blue:   '#3B82F6',
  green:  '#10B981',
  amber:  '#F59E0B',
  red:    '#EF4444',
  purple: '#8B5CF6',
  cyan:   '#06B6D4',
  orange: '#F97316',
  pink:   '#EC4899',
  indigo: '#6366F1',
  lime:   '#84CC16',
} as const

export const PALETTE = Object.values(COLORS)

export const CATEGORY_COLORS: Record<string, string> = {
  Beverages:      '#3B82F6',
  Snacks:         '#F59E0B',
  'Personal Care':'#8B5CF6',
  Household:      '#10B981',
  Dairy:          '#F97316',
}

export const CHART_STYLE = {
  grid:        { stroke: '#2D3460', strokeDasharray: '3 3' },
  axis:        { stroke: '#2D3460' },
  tickStyle:   { fill: '#94A3B8', fontSize: 11 },
  tooltipBg:   '#1A1D2E',
  tooltipBorder: '#2D3460',
}

export const tooltipStyle: React.CSSProperties = {
  backgroundColor: '#1A1D2E',
  border: '1px solid #2D3460',
  borderRadius: 8,
  color: '#F1F5F9',
  fontSize: 12,
  padding: '8px 12px',
}

import type React from 'react'
