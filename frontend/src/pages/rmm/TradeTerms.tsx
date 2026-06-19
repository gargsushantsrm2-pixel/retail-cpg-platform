import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useProducts } from '../../api/queries'
import {
  postG2NApprove, fetchTradeFund, allocateFund, commitFund, reconcileClaim,
} from '../../api/rmm'
import { fmtCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'g2n', label: 'G2N Approval' },
  { id: 'fund', label: 'Trade Fund' },
  { id: 'claims', label: 'Claims Reconciliation' },
]
const inp = 'w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue'
const Field = ({ label, children }: any) => (<div><label className="label-xs block mb-1">{label}</label>{children}</div>)

export default function TradeTerms() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Trade Terms & Gross-to-Net"
        subtitle="Module 4 · approval workflow, fund guardrails, claims reconciliation" />
      <Tabs tabs={TABS}>{(active) => (<>
        {active === 'g2n' && <G2N />}
        {active === 'fund' && <Fund />}
        {active === 'claims' && <Claims />}
      </>)}</Tabs>
    </div>
  )
}

function G2N() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const [disc, setDisc] = useState(0.30)
  const [thr, setThr] = useState(20)
  const mut = useMutation({ mutationFn: () =>
    postG2NApprove({ product_id: pid, proposed_discount_pct: disc, gm_threshold_pct: thr }) })
  const d = mut.data?.data
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="card p-5 space-y-4">
        <Field label="Product">
          <select value={pid} onChange={e => setPid(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 40)}</option>)}
          </select>
        </Field>
        <Field label={`Proposed discount: ${(disc * 100).toFixed(0)}%`}>
          <input type="range" min={0.05} max={0.6} step={0.01} value={disc} onChange={e => setDisc(+e.target.value)} className="w-full accent-accent-blue" />
        </Field>
        <Field label={`GM threshold: ${thr}%`}>
          <input type="range" min={5} max={50} value={thr} onChange={e => setThr(+e.target.value)} className="w-full accent-accent-blue" />
        </Field>
        <button onClick={() => pid && mut.mutate()} disabled={!pid || mut.isPending} className="btn-primary w-full disabled:opacity-50">Evaluate Deal</button>
      </div>
      <div className="xl:col-span-2">
        {!d ? <div className="card p-10 text-center text-text-muted">Configure a deal and evaluate.</div> : (
          <div className="card p-6" style={{ borderTop: `3px solid ${d.status === 'AUTO_APPROVED' ? '#10B981' : '#F59E0B'}` }}>
            <p className="text-2xl font-bold mb-3" style={{ color: d.status === 'AUTO_APPROVED' ? '#10B981' : '#F59E0B' }}>
              {d.status === 'AUTO_APPROVED' ? '✓ Auto-Approved' : '⚠ Escalated to Finance'}
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat k="Net price" v={`$${d.net_price}`} />
              <Stat k="Resulting GM" v={`${d.resulting_gm_pct}%`} />
              <Stat k="GM threshold" v={`${d.gm_threshold_pct}%`} />
              <Stat k="Routed to" v={d.routed_to} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Fund() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['rmm', 'fund'], queryFn: () => fetchTradeFund(2024) })
  const [region, setRegion] = useState('National')
  const [amt, setAmt] = useState(100000)
  const alloc = useMutation({ mutationFn: () => allocateFund({ region, fiscal_year: 2024, amount: amt }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rmm', 'fund'] }); toast.success('Allocated') } })
  const commit = useMutation({ mutationFn: () => commitFund({ region, fiscal_year: 2024, amount: amt }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['rmm', 'fund'] }); r.allowed ? toast.success('Committed') : toast.error(r.reason) } })
  const ledger = data?.data?.ledger ?? []
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <Field label="Region"><input value={region} onChange={e => setRegion(e.target.value)} className={inp} /></Field>
        <Field label="Amount ($)"><input type="number" value={amt} onChange={e => setAmt(+e.target.value)} className={inp} /></Field>
        <button onClick={() => alloc.mutate()} className="btn-secondary">Allocate</button>
        <button onClick={() => commit.mutate()} className="btn-primary">Commit Spend</button>
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Trade Fund Ledger — FY2024</h3>
        {!ledger.length ? <p className="text-xs text-text-muted">No allocations yet.</p> : (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
              {['Region', 'Allocated', 'Committed', 'Uncommitted', 'Utilization'].map(h => <th key={h} className={`pb-2 font-medium ${h === 'Region' ? 'text-left' : 'text-right'}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ledger.map((r: any) => (
                <tr key={r.region} className="border-b border-border/50">
                  <td className="py-2 text-text-primary font-medium">{r.region}</td>
                  <td className="py-2 text-right text-text-secondary">{fmtCurrency(r.allocated)}</td>
                  <td className="py-2 text-right text-accent-red">{fmtCurrency(r.committed)}</td>
                  <td className="py-2 text-right text-accent-green">{fmtCurrency(r.uncommitted)}</td>
                  <td className="py-2 text-right text-accent-amber">{r.utilization_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[0.65rem] text-text-muted mt-3">Committing more than the uncommitted balance is blocked by the overspend guardrail (Feature 10).</p>
      </div>
    </div>
  )
}

function Claims() {
  const [cid, setCid] = useState('WMT')
  const [claim, setClaim] = useState(5000)
  const [contracted, setContracted] = useState(3000)
  const mut = useMutation({ mutationFn: () =>
    reconcileClaim({ customer_id: cid, claim_amount: claim, contracted_amount: contracted, reason: 'OI deduction' }) })
  const d = mut.data?.data
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="card p-5 space-y-4">
        <Field label="Customer ID"><input value={cid} onChange={e => setCid(e.target.value)} className={inp} /></Field>
        <Field label="Claim amount ($)"><input type="number" value={claim} onChange={e => setClaim(+e.target.value)} className={inp} /></Field>
        <Field label="Contracted amount ($)"><input type="number" value={contracted} onChange={e => setContracted(+e.target.value)} className={inp} /></Field>
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary w-full disabled:opacity-50">Reconcile</button>
      </div>
      <div className="xl:col-span-2">
        {!d ? <div className="card p-10 text-center text-text-muted">Enter a retailer deduction to reconcile against contracted terms.</div> : (
          <div className="card p-6" style={{ borderTop: `3px solid ${d.status === 'APPROVED' ? '#10B981' : '#EF4444'}` }}>
            <p className="text-2xl font-bold mb-3" style={{ color: d.status === 'APPROVED' ? '#10B981' : '#EF4444' }}>
              {d.status === 'APPROVED' ? '✓ Within Contracted Terms' : '✗ Disputed — Unauthorized Leakage'}
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat k="Claim" v={fmtCurrency(d.claim_amount)} />
              <Stat k="Contracted" v={fmtCurrency(d.contracted_amount)} />
              <Stat k="Variance" v={fmtCurrency(d.variance)} />
              <Stat k="Unauthorized leakage" v={fmtCurrency(d.unauthorized_leakage)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Stat = ({ k, v }: any) => (
  <div className="p-3 rounded-lg bg-bg-elevated border border-border">
    <p className="label-xs mb-1">{k}</p><p className="text-sm font-semibold text-text-primary">{v}</p>
  </div>
)
