import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtCurrency(value: number, compact = true): string {
  if (!isFinite(value)) return '$0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (compact) {
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
    if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(0)}K`
  }
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function fmtVolume(value: number): string {
  if (!isFinite(value)) return '0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function fmtPct(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

export function fmtNum(value: number, digits = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
