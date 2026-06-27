import { useState, useRef, useCallback } from 'react'
import {
  Search,
  FileSearch,
  PenLine,
  ClipboardCheck,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react'

const API_BASE = 'http://localhost:8000'

// ---- Pipeline stage definitions ----
// Order matters: this drives the rail UI top-to-bottom / left-to-right.
const STAGES = [
  { key: 'search', label: 'Search', verb: 'Searching', icon: Search, tabLabel: 'Search results' },
  { key: 'scrape', label: 'Scrape', verb: 'Scraping', icon: FileSearch, tabLabel: 'Scraped content' },
  { key: 'write', label: 'Write', verb: 'Drafting', icon: PenLine, tabLabel: 'Report' },
  { key: 'critic', label: 'Critique', verb: 'Reviewing', icon: ClipboardCheck, tabLabel: 'Critic feedback' },
]

const STATE_KEY_FOR_STAGE = {
  search: 'search_result',
  scrape: 'scraped_content',
  write: 'report',
  critic: 'feedback',
}

// idle -> pending -> running -> done   (or -> error)
function StageNode({ stage, status, isActive, onClick, disabled }) {
  const Icon = stage.icon
  const isDone = status === 'done'
  const isRunning = status === 'running'
  const isError = status === 'error'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative flex flex-col items-center gap-2 px-3 py-2 rounded-lg transition-colors',
        'disabled:cursor-not-allowed',
        isActive ? 'bg-panel' : 'hover:bg-panel/60',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all',
          isDone && 'border-signal bg-signal/10 text-signal',
          isRunning && 'border-progress bg-progress/10 text-progress animate-pulse_dot',
          isError && 'border-err bg-err/10 text-err',
          status === 'idle' && 'border-panelborder text-muted',
          status === 'pending' && 'border-panelborder text-muted',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
      </div>
      <span
        className={[
          'font-mono text-[11px] uppercase tracking-wider',
          isDone || isRunning ? 'text-ink' : 'text-muted',
        ].join(' ')}
      >
        {stage.label}
      </span>
    </button>
  )
}

function Connector({ active }) {
  return (
    <div className="relative mx-1 h-px w-10 flex-shrink-0 bg-panelborder sm:w-16">
      {active && (
        <span className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-signal shadow-[0_0_8px_rgba(94,234,212,0.9)] animate-signal_travel" />
      )}
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex items-center gap-1.5 rounded-md border border-panelborder px-2.5 py-1.5 font-mono text-xs text-muted transition-colors hover:border-signal/50 hover:text-signal"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function App() {
  const [topic, setTopic] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(null)
  // stageStatus: { search: 'idle'|'pending'|'running'|'done'|'error', ... }
  const [stageStatus, setStageStatus] = useState(
    Object.fromEntries(STAGES.map((s) => [s.key, 'idle']))
  )
  const [results, setResults] = useState(
    Object.fromEntries(STAGES.map((s) => [s.key, '']))
  )
  const [activeTab, setActiveTab] = useState('search')
  const abortRef = useRef(null)

  const resetState = () => {
    setStageStatus(Object.fromEntries(STAGES.map((s) => [s.key, 'pending'])))
    setResults(Object.fromEntries(STAGES.map((s) => [s.key, ''])))
    setError(null)
  }

  const runPipeline = useCallback(async () => {
    if (!topic.trim() || isRunning) return

    resetState()
    setIsRunning(true)
    setActiveTab('search')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${API_BASE}/api/research/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Server responded with ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by a blank line
        const events = buffer.split('\n\n')
        buffer = events.pop() // keep incomplete chunk for next read

        for (const raw of events) {
          if (!raw.trim()) continue
          const lines = raw.split('\n')
          let eventName = 'message'
          let dataStr = ''
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            if (line.startsWith('data:')) dataStr += line.slice(5).trim()
          }
          if (!dataStr) continue
          const payload = JSON.parse(dataStr)

          if (eventName === 'status') {
            const { step, status, data } = payload
            setStageStatus((prev) => ({ ...prev, [step]: status }))
            if (status === 'done' && data) {
              setResults((prev) => ({ ...prev, [step]: data }))
            }
          } else if (eventName === 'error') {
            setError(payload.message || 'The pipeline hit an unexpected error.')
            setStageStatus((prev) => {
              const next = { ...prev }
              for (const s of STAGES) {
                if (next[s.key] === 'running' || next[s.key] === 'pending') next[s.key] = 'error'
              }
              return next
            })
          } else if (eventName === 'complete') {
            setResults({
              search: payload.search_result || '',
              scrape: payload.scraped_content || '',
              write: payload.report || '',
              critic: payload.feedback || '',
            })
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(
          e.message?.includes('fetch')
            ? "Can't reach the backend. Confirm it's running at " + API_BASE + '.'
            : e.message
        )
      }
    } finally {
      setIsRunning(false)
    }
  }, [topic, isRunning])

  const activeStageIndex = STAGES.findIndex((s) => stageStatus[s.key] === 'running')
  const anyStarted = STAGES.some((s) => stageStatus[s.key] !== 'idle')
  const activeStage = STAGES.find((s) => s.key === activeTab)
  const activeContent = results[activeTab]
  const activeStatus = stageStatus[activeTab]

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Header */}
      <header className="border-b border-panelborder px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-signal">
              Research Agent
            </h1>
            <p className="mt-1 text-sm text-muted">Research Multi Agent</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
        {/* Topic input */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runPipeline()}
            disabled={isRunning}
            placeholder="Enter a research topic, e.g. quantum error correction in 2026"
            className="flex-1 rounded-lg border border-panelborder bg-panel px-4 py-3 font-sans text-sm text-ink placeholder:text-muted/70 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/40 disabled:opacity-50"
          />
          <button
            onClick={runPipeline}
            disabled={!topic.trim() || isRunning}
            className="flex items-center justify-center gap-2 rounded-lg bg-signal px-5 py-3 font-mono text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Running
              </>
            ) : (
              <>
                Search <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Pipeline rail */}
        {anyStarted && (
          <div className="mt-8 animate-fade_up rounded-xl border border-panelborder bg-panel/40 px-4 py-5 sm:px-6">
            <div className="flex items-center justify-center overflow-x-auto">
              {STAGES.map((stage, i) => (
                <div key={stage.key} className="flex items-center">
                  <StageNode
                    stage={stage}
                    status={stageStatus[stage.key]}
                    isActive={activeTab === stage.key}
                    onClick={() => setActiveTab(stage.key)}
                    disabled={stageStatus[stage.key] === 'idle'}
                  />
                  {i < STAGES.length - 1 && (
                    <Connector active={i === activeStageIndex} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-err/40 bg-err/10 px-4 py-3 text-sm text-err">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Pipeline stopped.</p>
              <p className="mt-0.5 text-err/80">{error}</p>
            </div>
          </div>
        )}

        {/* Output tabs */}
        {anyStarted && (
          <div className="mt-8 animate-fade_up">
            <div className="flex gap-1 border-b border-panelborder">
              {STAGES.map((stage) => {
                const status = stageStatus[stage.key]
                const isClickable = status !== 'idle' && status !== 'pending'
                return (
                  <button
                    key={stage.key}
                    onClick={() => isClickable && setActiveTab(stage.key)}
                    disabled={!isClickable}
                    className={[
                      'relative px-4 py-2.5 font-mono text-xs uppercase tracking-wide transition-colors',
                      activeTab === stage.key ? 'text-signal' : 'text-muted',
                      isClickable ? 'hover:text-ink' : 'cursor-not-allowed opacity-40',
                    ].join(' ')}
                  >
                    {stage.tabLabel}
                    {activeTab === stage.key && (
                      <span className="absolute bottom-0 left-0 h-[2px] w-full bg-signal" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 min-h-[280px] rounded-xl border border-panelborder bg-panel p-5 sm:p-6">
              {activeStatus === 'running' && (
                <div className="flex h-full min-h-[230px] flex-col items-center justify-center gap-3 text-muted">
                  <Loader2 size={22} className="animate-spin text-progress" />
                  <p className="font-mono text-sm">{activeStage.verb} …</p>
                </div>
              )}

              {activeStatus === 'pending' && (
                <div className="flex h-full min-h-[230px] flex-col items-center justify-center gap-2 text-muted">
                  <activeStage.icon size={22} className="opacity-40" />
                  <p className="font-mono text-sm">Waiting for earlier stages to finish</p>
                </div>
              )}

              {activeStatus === 'error' && (
                <div className="flex h-full min-h-[230px] flex-col items-center justify-center gap-2 text-err">
                  <AlertTriangle size={22} />
                  <p className="font-mono text-sm">This stage didn't complete</p>
                </div>
              )}

              {activeStatus === 'done' && (
                <div>
                  <div className="mb-3 flex items-center justify-end">
                    <CopyButton text={activeContent} />
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink/90">
                    {activeContent}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!anyStarted && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted">
            <p className="font-mono text-sm">Enter a topic above and run the pipeline to begin.</p>
            <p className="max-w-md text-xs text-muted/70">
              Each stage runs in order — search, scrape, write, critique — and lights up on the
              rail as it completes.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
