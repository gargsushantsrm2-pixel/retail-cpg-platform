import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Spinner } from '../../components/ui/Spinner'
import { useProducts } from '../../api/queries'
import {
  fetchIngestion, fetchOpenApiCatalog, fetchStakeholder, fetchOmniChannel, fetchWorkflow,
} from '../../api/rmm'
import { fmtCurrency } from '../../lib/utils'

const TABS = [
  { id: 'workflow', label: 'Workflow Orchestrator' },
  { id: 'stakeholder', label: 'Stakeholder Views' },
  { id: 'omni', label: 'Omni-Channel' },
  { id: 'ingest', label: 'Data Ingestion' },
  { id: 'api', label: 'API Catalog' },
]
const inp = 'w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary'

export default function PlatformGovernance() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Platform & Operating Model" subtitle="Modules 6/20/21/23 · cross-functional workflow, stakeholder views, omni-channel, ingestion, API" />
      <Tabs tabs={TABS}>{(a) => (<>
        {a === 'workflow' && <Workflow />}
        {a === 'stakeholder' && <Stakeholder />}
        {a === 'omni' && <Omni />}
        {a === 'ingest' && <Ingest />}
        {a === 'api' && <ApiCat />}
      </>)}</Tabs>
    </div>
  )
}

function Workflow() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const [price, setPrice] = useState(42)
  const mut = useMutation({ mutationFn: () => fetchWorkflow(pid, price) })
  const d = mut.data?.data
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="card p-5 space-y-4">
        <div><label className="label-xs block mb-1">Product</label><select value={pid} onChange={e => setPid(e.target.value)} className={inp}><option value="">— Select —</option>{(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 30)}</option>)}</select></div>
        <div><label className="label-xs block mb-1">Proposed price: ${price}</label><input type="range" min={10} max={100} value={price} onChange={e => setPrice(+e.target.value)} className="w-full accent-accent-blue" /></div>
        <button onClick={() => pid && mut.mutate()} disabled={!pid || mut.isPending} className="btn-primary w-full disabled:opacity-50">Run Validation</button>
      </div>
      <div className="xl:col-span-2">
        {!d ? <div className="card p-10 text-center text-text-muted">Require parallel Finance / Supply / Brand sign-off before a price change goes live.</div> : (
          <div className="card p-5">
            <p className={`text-xl font-bold mb-4 ${d.approved ? 'text-accent-green' : 'text-accent-red'}`}>{d.approved ? '✓ Approved to go live' : '✗ Blocked — checkpoint failed'}</p>
            <div className="space-y-2">
              {d.checkpoints.map((c: any) => (
                <div key={c.function} className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated border border-border">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.status === 'PASS' ? 'bg-accent-green/15 text-accent-green' : c.status === 'REVIEW' ? 'bg-accent-amber/15 text-accent-amber' : 'bg-accent-red/15 text-accent-red'}`}>{c.status}</span>
                  <div><p className="text-sm text-text-primary font-medium">{c.function}</p><p className="text-xs text-text-muted">{c.detail}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stakeholder() {
  const [role, setRole] = useState('finance')
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'stake', role], queryFn: () => fetchStakeholder(role) })
  const d = data?.data
  return (
    <div className="space-y-4">
      <div className="card p-4 flex gap-2">
        {['finance', 'sales', 'brand_marketing'].map(r => (
          <button key={r} onClick={() => setRole(r)} className={role === r ? 'btn-primary' : 'btn-secondary'}>{r.replace('_', ' ')}</button>
        ))}
      </div>
      {isLoading || !d ? <Spinner /> : (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">{d.headline}</h3>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {Object.entries(d.metrics).map(([k, v]: any) => (
              <div key={k} className="card-elevated p-4">
                <p className="label-xs mb-1">{k.replace(/_/g, ' ')}</p>
                <p className="text-lg font-bold text-text-primary">{typeof v === 'number' && v > 1000 ? fmtCurrency(v) : String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Omni() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'omni'], queryFn: () => fetchOmniChannel() })
  if (isLoading) return <Spinner />
  const rows = data?.data?.channels ?? []
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-3">Omni-Channel Pricing Synchronization</h3>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
          {['Channel', 'Revenue', 'Avg Price', 'Pricing Mode', 'Cadence'].map(h => <th key={h} className={`pb-2 font-medium ${h === 'Channel' ? 'text-left' : 'text-right'}`}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r: any, i: number) => (
          <tr key={i} className="border-b border-border/50">
            <td className="py-2 text-text-primary">{r.channel}</td>
            <td className="py-2 text-right text-text-secondary">{fmtCurrency(r.revenue)}</td>
            <td className="py-2 text-right text-text-secondary">${r.avg_price}</td>
            <td className="py-2 text-right"><span className={`px-2 py-0.5 rounded text-[0.65rem] ${r.pricing_mode.startsWith('DYNAMIC') ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-bg-elevated text-text-muted'}`}>{r.pricing_mode}</span></td>
            <td className="py-2 text-right text-text-muted">{r.reprice_cadence}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function Ingest() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'ingest'], queryFn: fetchIngestion })
  if (isLoading) return <Spinner />
  const rows = data?.data?.sources ?? []
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-3">Source Harmonization ({data?.data?.harmonized}/{data?.data?.total_sources})</h3>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
          {['Source', 'Maps To', 'Taxonomy', 'Rows', 'Status'].map(h => <th key={h} className={`pb-2 font-medium ${h === 'Rows' || h === 'Status' ? 'text-right' : 'text-left'}`}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r: any, i: number) => (
          <tr key={i} className="border-b border-border/50">
            <td className="py-2 text-text-primary">{r.source}</td>
            <td className="py-2 text-text-secondary">{r.maps_to}</td>
            <td className="py-2 text-text-muted">{r.taxonomy}</td>
            <td className="py-2 text-right text-text-secondary">{r.rows.toLocaleString()}</td>
            <td className="py-2 text-right"><span className={`px-2 py-0.5 rounded text-[0.65rem] font-semibold ${r.status === 'HARMONIZED' ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>{r.status}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function ApiCat() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'apicat'], queryFn: fetchOpenApiCatalog })
  if (isLoading) return <Spinner />
  const d = data?.data
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-1">Connectable API Surface</h3>
        <p className="label-xs mb-3">{d?.total_endpoints} endpoints · <a href="/docs" target="_blank" className="text-accent-blue underline">/docs</a> · integration targets: {(d?.integration_targets ?? []).join(', ')}</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {(d?.by_domain ?? []).map((g: any) => (
            <div key={g.domain} className="card-elevated p-3 text-center">
              <p className="label-xs mb-1">{g.domain}</p><p className="text-xl font-bold text-accent-blue">{g.operations}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
