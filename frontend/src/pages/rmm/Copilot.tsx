import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Bot, User, Send, Sparkles, Wrench } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { fetchCopilotStatus, askCopilot } from '../../api/rmm'

interface Msg { role: 'user' | 'assistant'; text: string; tools?: string[]; mode?: string }

const SUGGESTIONS = [
  "What's the price elasticity of BEV-001?",
  'Simulate a 15% Display+Feature promo on SNK-001',
  'Which SKUs should we prune?',
  'How should we respond to a 6% cost spike?',
  'When should we promote Beverages?',
  'Any competitor price breaches?',
]

export default function Copilot() {
  const { data: status } = useQuery({ queryKey: ['rmm', 'agent', 'status'], queryFn: fetchCopilotStatus })
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const mut = useMutation({
    mutationFn: (q: string) => askCopilot(q),
    onSuccess: (res: any) => setMsgs(m => [...m, { role: 'assistant', text: res.answer, tools: res.tools_used, mode: res.mode }]),
    onError: () => setMsgs(m => [...m, { role: 'assistant', text: 'Something went wrong answering that.' }]),
  })

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, mut.isPending])

  const send = (q: string) => {
    const question = q.trim()
    if (!question) return
    setMsgs(m => [...m, { role: 'user', text: question }])
    setInput('')
    mut.mutate(question)
  }

  return (
    <div className="animate-slide-in">
      <PageHeader title="RGM Copilot"
        subtitle="Ask in plain language — the agent calls the right RMM engines and explains the answer" />

      <div className="card p-0 overflow-hidden flex flex-col" style={{ height: '70vh' }}>
        {/* status bar */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-2 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
          <span className="text-text-secondary">
            Mode: <span className="font-semibold" style={{ color: status?.mode === 'llm' ? '#10B981' : '#F59E0B' }}>
              {status?.mode === 'llm' ? `Claude (${status?.model})` : 'Deterministic router'}
            </span>
          </span>
          <span className="ml-auto text-text-muted">{status?.tools?.length ?? 0} tools available</span>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {msgs.length === 0 && (
            <div className="text-center text-text-muted mt-6">
              <Bot className="w-10 h-10 mx-auto mb-3 text-accent-purple/60" />
              <p className="text-sm mb-4">Ask the Copilot about pricing, promotions, portfolio, or the 3-C balance.</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="px-3 py-1.5 rounded-full border border-border bg-bg-elevated text-xs text-text-secondary hover:text-text-primary hover:border-accent-blue transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <span className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-accent-purple" />
                </span>
              )}
              <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-accent-blue text-white' : 'bg-bg-elevated text-text-primary border border-border'}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.tools.map((t, j) => (
                      <span key={j} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-card text-[0.6rem] text-text-muted">
                        <Wrench className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <span className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-accent-blue" />
                </span>
              )}
            </div>
          ))}
          {mut.isPending && (
            <div className="flex gap-3">
              <span className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-accent-purple animate-pulse" />
              </span>
              <div className="bg-bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-muted">Thinking…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* input */}
        <div className="border-t border-border p-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask about a SKU, promo, competitor, cost spike…"
            className="flex-1 text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent-blue"
          />
          <button onClick={() => send(input)} disabled={mut.isPending || !input.trim()}
            className="btn-primary px-4 disabled:opacity-50 flex items-center gap-1.5">
            <Send className="w-4 h-4" /> Ask
          </button>
        </div>
      </div>
    </div>
  )
}
