import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Spinner } from '../../components/ui/Spinner'
import {
  fetchPerOunce, fetchCompetitorIndex, fetchPremiumization, fetchTiers, fetchValueIndex,
} from '../../api/rmm'
import { fmtCurrency } from '../../lib/utils'

const TABS = [
  { id: 'oz', label: 'Per-Ounce Matrix' },
  { id: 'comp', label: 'Competitor Index' },
  { id: 'prem', label: 'Premiumization' },
  { id: 'tiers', label: 'Tier Editor' },
  { id: 'value', label: 'Value Index' },
]
const CATS = ['Beverages', 'Snacks', 'Personal Care', 'Household', 'Dairy']
const Th = ({ children, l }: any) => <th className={`pb-2 font-medium ${l ? 'text-left' : 'text-right'}`}>{children}</th>

export default function PriceArchitecture() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Price Pack Architecture" subtitle="Modules 1/3/18/24 · per-ounce, competitor corridor, premiumization, Good-Better-Best, value index" />
      <Tabs tabs={TABS}>{(a) => (<>
        {a === 'oz' && <PerOunce />}
        {a === 'comp' && <Competitor />}
        {a === 'prem' && <Premium />}
        {a === 'tiers' && <TierEd />}
        {a === 'value' && <ValueIdx />}
      </>)}</Tabs>
    </div>
  )
}

function PerOunce() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'peroz'], queryFn: () => fetchPerOunce() })
  if (isLoading) return <Spinner />
  const rows = data?.data?.matrix ?? []
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-3">Price & Margin per Ounce ({rows.length} SKUs)</h3>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
          <Th l>SKU</Th><Th>Pack</Th><Th>Price</Th><Th>$/oz</Th><Th>Margin/oz</Th><Th>GM%</Th>
        </tr></thead>
        <tbody>{rows.map((r: any) => (
          <tr key={r.product_id} className="border-b border-border/50">
            <td className="py-2 text-text-primary">{r.sku_name?.slice(0, 34)}</td>
            <td className="py-2 text-right text-text-secondary">{r.pack_size}</td>
            <td className="py-2 text-right text-text-secondary">${r.price}</td>
            <td className="py-2 text-right text-accent-blue">${r.price_per_oz}</td>
            <td className="py-2 text-right text-accent-green">${r.margin_per_oz}</td>
            <td className="py-2 text-right text-text-secondary">{r.gross_margin_pct}%</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function Competitor() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'compidx'], queryFn: fetchCompetitorIndex })
  if (isLoading) return <Spinner />
  const rows = data?.data?.index ?? []
  const alerts = data?.data?.alerts ?? []
  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="card p-4 border-accent-amber" style={{ background: 'rgba(245,158,11,0.06)' }}>
          <p className="text-xs font-semibold text-accent-amber">{alerts.length} corridor breach alert(s)</p>
        </div>
      )}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Price Index vs Competitor Average</h3>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
            <Th l>Category</Th><Th l>Brand</Th><Th>Our Price</Th><Th>Comp Avg</Th><Th>Index</Th><Th>Status</Th>
          </tr></thead>
          <tbody>{rows.map((r: any, i: number) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-2 text-text-secondary">{r.category}</td>
              <td className="py-2 text-text-primary">{r.brand}</td>
              <td className="py-2 text-right text-text-secondary">${r.our_price}</td>
              <td className="py-2 text-right text-text-secondary">${r.competitor_avg}</td>
              <td className="py-2 text-right text-accent-blue">{r.price_index}</td>
              <td className="py-2 text-right"><span className={`px-2 py-0.5 rounded text-[0.65rem] font-semibold ${r.status === 'WITHIN' ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>{r.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

function Premium() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'prem'], queryFn: fetchPremiumization })
  if (isLoading) return <Spinner />
  const ops = data?.data?.opportunities ?? []
  return (
    <div className="grid xl:grid-cols-2 gap-4">
      {ops.map((o: any, i: number) => (
        <div key={i} className="card p-5" style={{ borderTop: '3px solid #8B5CF6' }}>
          <h3 className="text-sm font-semibold mb-1">{o.category}</h3>
          <p className="text-2xl font-bold text-accent-purple mb-2">${o.suggested_price}</p>
          <p className="text-xs text-text-secondary">White-space between ${o.gap_low} and ${o.gap_high} · headroom ${o.headroom}</p>
          <p className="text-xs text-text-muted mt-1">{o.rationale}</p>
          <p className="text-xs mt-2">Target margin: <span className="text-accent-green font-medium">{o.target_margin_pct}%</span></p>
        </div>
      ))}
    </div>
  )
}

function TierEd() {
  const [cat, setCat] = useState('Beverages')
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'tiers', cat], queryFn: () => fetchTiers(cat) })
  const d = data?.data
  return (
    <div className="space-y-4">
      <div className="card p-4"><select value={cat} onChange={e => setCat(e.target.value)} className="text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary">{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
      {isLoading || !d ? <Spinner /> : (
        <div className="grid xl:grid-cols-3 gap-4">
          {['Good', 'Better', 'Best'].map((t) => d.tiers[t] && (
            <div key={t} className="card p-5 text-center" style={{ borderTop: `3px solid ${t === 'Good' ? '#06B6D4' : t === 'Better' ? '#3B82F6' : '#F97316'}` }}>
              <p className="label-xs mb-1">{t}</p>
              <p className="text-2xl font-bold text-text-primary">${d.tiers[t].avg}</p>
              <p className="text-xs text-text-muted mt-1">${d.tiers[t].min}–${d.tiers[t].max} · {d.tiers[t].count} SKU</p>
            </div>
          ))}
          {d.spacing_violations?.length > 0 && (
            <div className="xl:col-span-3 card p-4 border-accent-red" style={{ background: 'rgba(239,68,68,0.06)' }}>
              <p className="text-xs font-semibold text-accent-red mb-1">Spacing violations</p>
              {d.spacing_violations.map((v: any, i: number) => <p key={i} className="text-xs text-text-secondary">{v.between}: {v.spacing_pct}% (need {v.required_pct}%)</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ValueIdx() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'validx'], queryFn: fetchValueIndex })
  if (isLoading) return <Spinner />
  const rows = data?.data?.index ?? []
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-3">Attribute-Based Value Index</h3>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
          <Th l>SKU</Th><Th l>Category</Th><Th>Brand Equity</Th><Th>GM%</Th><Th>Price Premium</Th><Th>Value Index</Th>
        </tr></thead>
        <tbody>{rows.map((r: any) => (
          <tr key={r.product_id} className="border-b border-border/50">
            <td className="py-2 text-text-primary">{r.sku_name?.slice(0, 32)}</td>
            <td className="py-2 text-text-secondary">{r.category}</td>
            <td className="py-2 text-right text-text-secondary">{r.brand_equity_share}</td>
            <td className="py-2 text-right text-text-secondary">{r.gm_pct}%</td>
            <td className="py-2 text-right text-text-secondary">{r.price_premium}×</td>
            <td className="py-2 text-right font-bold text-accent-purple">{r.value_index}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
