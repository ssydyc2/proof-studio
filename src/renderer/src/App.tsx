import { useEffect, useRef, useState } from 'react'
import type { ExplainProgress, ExplainRound } from '../../shared/explain'
import type { FormalizeProgress, FormalizeRound } from '../../shared/formalize'
import { PROOF_ATTEMPTS, PROOF_ATTEMPT_MAX, proofAttemptCount, type ProveProgress, type ProveRound } from '../../shared/prove'
import {
  fileByKey,
  isListedFile,
  pdfKeyFor,
  type FileContent,
  type FileKey,
  type ProblemFileView,
  type ProblemSummary,
  type TexSourceKey
} from '../../shared/problem'
import type { ToolStatus } from '../../shared/toolchain'

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const STATE_LABEL = {
  empty: 'Empty',
  current: 'Current',
  stale: 'Stale',
  failed: 'Failed'
} as const

type PairAction = 'generate-tex' | 'generate-pdf' | 'generate-lean' | 'generate-proof' | 'generate-solution' | 'none'

type Busy = 'transcribe' | 'pdf' | 'formalize' | 'prove' | 'explain' | null

type FilePair = {
  left: FileKey
  right: FileKey
  title: string
  action: PairAction
  label: string
  busyLabel: string
  texKey?: TexSourceKey
}

export function App() {
  const [problems, setProblems] = useState<ProblemSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileKey>('source')
  const [leftContent, setLeftContent] = useState<FileContent | null>(null)
  const [rightContent, setRightContent] = useState<FileContent | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [formalizeProgress, setFormalizeProgress] = useState<FormalizeProgress | null>(null)
  const [formalizeRounds, setFormalizeRounds] = useState<FormalizeRound[]>([])
  const [proveProgress, setProveProgress] = useState<ProveProgress | null>(null)
  const [proveRounds, setProveRounds] = useState<ProveRound[]>([])
  const [explainProgress, setExplainProgress] = useState<ExplainProgress | null>(null)
  const [explainRounds, setExplainRounds] = useState<ExplainRound[]>([])
  const [attempts, setAttempts] = useState(String(PROOF_ATTEMPTS))
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProblemSummary | null>(null)
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [keySet, setKeySet] = useState(false)
  const [loadTick, setLoadTick] = useState(0)
  const [tools, setTools] = useState<ToolStatus[] | null>(null)
  const [checkingTools, setCheckingTools] = useState(false)
  const loaded = useRef('')
  const loadedId = useRef('')
  const saveGen = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingAfterKey = useRef<'transcribe' | 'formalize' | 'prove' | 'explain' | null>(null)

  const selected = problems.find((problem) => problem.id === selectedId) ?? null
  const pair = selected ? pairFor(selectedFile, selected.files) : null
  const showsTex = pair?.left === 'problemText' || pair?.right === 'problemText'

  useEffect(() => {
    if (!window.proofStudio) return
    void window.proofStudio.listProblems().then((nextProblems) => {
      setProblems(nextProblems)
      if (nextProblems[0]) setSelectedId(nextProblems[0].id)
    })
    void window.proofStudio.hasApiKey().then(setKeySet)
    void refreshTools()
    const stopFormalize = window.proofStudio.onFormalizeProgress((progress) => {
      setFormalizeProgress(progress)
      setFormalizeRounds(progress.rounds)
    })
    const stopProve = window.proofStudio.onProveProgress((progress) => {
      setProveProgress(progress)
      setProveRounds(progress.rounds)
    })
    const stopExplain = window.proofStudio.onExplainProgress((progress) => {
      setExplainProgress(progress)
      setExplainRounds(progress.rounds)
    })
    return () => {
      stopFormalize()
      stopProve()
      stopExplain()
    }
  }, [])

  useEffect(() => {
    if (!selectedId || !pair) {
      setLeftContent(null)
      setRightContent(null)
      return
    }
    let cancelled = false
    void Promise.all([
      window.proofStudio.readFile(selectedId, pair.left),
      window.proofStudio.readFile(selectedId, pair.right)
    ]).then(([left, right]) => {
      if (cancelled) return
      setLeftContent(left)
      setRightContent(right)
      const tex = pair.left === 'problemText' ? left : pair.right === 'problemText' ? right : null
      if (tex?.kind === 'text') {
        const sameProblem = loadedId.current === selectedId
        const previous = loaded.current
        loaded.current = tex.text
        loadedId.current = selectedId
        setDraft((current) => (!sameProblem || current === previous || current === tex.text ? tex.text : current))
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, pair?.left, pair?.right, loadTick])

  useEffect(() => {
    if (!selectedId || !showsTex || draft === loaded.current) return
    const id = selectedId
    const text = draft
    const timer = window.setTimeout(() => {
      const gen = ++saveGen.current
      void window.proofStudio
        .writeText(id, text)
        .then(async (nextProblems) => {
          if (saveGen.current !== gen) return
          loaded.current = text
          setProblems(nextProblems)
          const compiled = await window.proofStudio.compilePdf(id, 'problemText')
          if (saveGen.current !== gen) return
          setProblems(compiled)
          setError(null)
          setLoadTick((tick) => tick + 1)
        })
        .catch((cause: unknown) => {
          if (saveGen.current !== gen) return
          setError(messageOf(cause))
          void window.proofStudio.listProblems().then((nextProblems) => {
            if (saveGen.current !== gen) return
            setProblems(nextProblems)
            setLoadTick((tick) => tick + 1)
          })
        })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [draft, selectedId, showsTex])

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = imageFromClipboard(event.clipboardData)
      if (!file) return
      event.preventDefault()
      void attachImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  async function refreshTools() {
    setCheckingTools(true)
    try {
      setTools(await window.proofStudio.toolchainStatus())
    } catch (cause: unknown) {
      setError(messageOf(cause))
    } finally {
      setCheckingTools(false)
    }
  }

  async function removeProblem(problem: ProblemSummary) {
    try {
      const nextProblems = await window.proofStudio.deleteProblem(problem.id)
      setProblems(nextProblems)
      setPendingDelete(null)
      setError(null)
      if (selectedId === problem.id) {
        setSelectedId(nextProblems[0]?.id ?? null)
        setSelectedFile('source')
      }
    } catch (cause) {
      setPendingDelete(null)
      setError(messageOf(cause))
    }
  }

  async function openFolder(): Promise<string | null> {
    const opened = await window.proofStudio.openFolder()
    if (!opened) return null
    setProblems(opened.problems)
    setSelectedId(opened.id)
    setSelectedFile('source')
    setError(null)
    return opened.id
  }

  async function attachImage(image: File, problemId?: string) {
    if (!ACCEPTED.has(image.type)) {
      setError('Use a PNG, JPEG, WebP, or GIF screenshot.')
      return
    }
    if (image.size > 50_000_000) {
      setError('This file is larger than 50 MB.')
      return
    }
    setError(null)
    const id = problemId ?? selectedId ?? (await openFolder())
    if (!id) return
    const base64 = await blobToBase64(image)
    const nextProblems = await window.proofStudio.addSource(id, base64, image.type)
    setProblems(nextProblems)
    setSelectedId(id)
    setSelectedFile('source')
    setLoadTick((tick) => tick + 1)
  }

  async function transcribe(id: string) {
    ++saveGen.current
    setBusy('transcribe')
    setError(null)
    try {
      const nextProblems = await window.proofStudio.transcribe(id)
      setProblems(nextProblems)
      setLoadTick((tick) => tick + 1)
    } catch (cause) {
      setError(messageOf(cause))
      const nextProblems = await window.proofStudio.listProblems()
      setProblems(nextProblems)
      const tex = fileByKey(nextProblems.find((problem) => problem.id === id)?.files ?? [], 'problemText')
      if (tex && tex.state !== 'empty') setSelectedFile('problemText')
      setLoadTick((tick) => tick + 1)
    } finally {
      setBusy(null)
    }
  }

  async function formalize(id: string) {
    setBusy('formalize')
    setFormalizeProgress(null)
    setFormalizeRounds([])
    setError(null)
    try {
      if (draft !== loaded.current) {
        const saved = await window.proofStudio.writeText(id, draft)
        loaded.current = draft
        setProblems(saved)
      }
      const nextProblems = await window.proofStudio.formalize(id)
      setProblems(nextProblems)
      setSelectedFile('leanStub')
      setLoadTick((tick) => tick + 1)
    } catch (cause) {
      setError(messageOf(cause))
      setProblems(await window.proofStudio.listProblems())
    } finally {
      setBusy(null)
      setFormalizeProgress(null)
    }
  }

  async function prove(id: string) {
    let count: number
    try {
      count = proofAttemptCount(attempts)
    } catch (cause) {
      setError(messageOf(cause))
      return
    }
    setBusy('prove')
    setProveProgress(null)
    setProveRounds([])
    setError(null)
    try {
      const nextProblems = await window.proofStudio.prove(id, count)
      setProblems(nextProblems)
      setSelectedFile('leanProof')
      setLoadTick((tick) => tick + 1)
    } catch (cause) {
      setError(messageOf(cause))
      setProblems(await window.proofStudio.listProblems())
    } finally {
      setBusy(null)
      setProveProgress(null)
    }
  }

  async function explain(id: string) {
    setBusy('explain')
    setExplainProgress(null)
    setExplainRounds([])
    setError(null)
    try {
      const nextProblems = await window.proofStudio.explain(id)
      setProblems(nextProblems)
      setSelectedFile('solutionPdf')
      setLoadTick((tick) => tick + 1)
    } catch (cause) {
      setError(messageOf(cause))
      setProblems(await window.proofStudio.listProblems())
      setLoadTick((tick) => tick + 1)
    } finally {
      setBusy(null)
      setExplainProgress(null)
    }
  }

  async function saveKey(event: React.FormEvent) {
    event.preventDefault()
    try {
      await window.proofStudio.setApiKey(keyDraft)
      setKeyDraft('')
      setKeySet(true)
      setKeyOpen(false)
      const pending = pendingAfterKey.current
      pendingAfterKey.current = null
      if (pending === 'transcribe' && selected) await transcribe(selected.id)
      if (pending === 'formalize' && selected) await formalize(selected.id)
      if (pending === 'prove' && selected) await prove(selected.id)
      if (pending === 'explain' && selected) await explain(selected.id)
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  async function makePdf(texKey: TexSourceKey) {
    if (!selected || busy) return
    setBusy('pdf')
    setError(null)
    try {
      if (texKey === 'problemText' && draft !== loaded.current) {
        const saved = await window.proofStudio.writeText(selected.id, draft)
        loaded.current = draft
        setProblems(saved)
      }
      const nextProblems = await window.proofStudio.compilePdf(selected.id, texKey)
      setProblems(nextProblems)
      setSelectedFile(pdfKeyFor(texKey))
      setLoadTick((tick) => tick + 1)
    } catch (cause) {
      setError(messageOf(cause))
      setProblems(await window.proofStudio.listProblems())
    } finally {
      setBusy(null)
    }
  }

  async function runAction() {
    if (!selected || !pair || busy) return
    if (pair.action === 'generate-tex') {
      const source = fileByKey(selected.files, 'source')
      if (!source || source.state === 'empty' || source.state === 'failed') {
        fileInput.current?.click()
        return
      }
      if (!(await window.proofStudio.hasApiKey())) {
        pendingAfterKey.current = 'transcribe'
        setKeyOpen(true)
        return
      }
      await transcribe(selected.id)
      return
    }
    if (pair.action === 'generate-lean') {
      const tex = fileByKey(selected.files, 'problemText')
      if (!tex || (tex.state !== 'current' && tex.state !== 'stale')) return
      if (!(await window.proofStudio.hasApiKey())) {
        pendingAfterKey.current = 'formalize'
        setKeyOpen(true)
        return
      }
      await formalize(selected.id)
      return
    }
    if (pair.action === 'generate-proof') {
      const stub = fileByKey(selected.files, 'leanStub')
      if (!stub || (stub.state !== 'current' && stub.state !== 'stale')) return
      if (!(await window.proofStudio.hasApiKey())) {
        pendingAfterKey.current = 'prove'
        setKeyOpen(true)
        return
      }
      await prove(selected.id)
      return
    }
    if (pair.action === 'generate-solution') {
      const proof = fileByKey(selected.files, 'leanProof')
      if (!proof || (proof.state !== 'current' && proof.state !== 'stale')) return
      if (!(await window.proofStudio.hasApiKey())) {
        pendingAfterKey.current = 'explain'
        setKeyOpen(true)
        return
      }
      await explain(selected.id)
      return
    }
    if (pair.action === 'generate-pdf' && pair.texKey) await makePdf(pair.texKey)
  }

  const action =
    selected && pair ? actionFor(pair, selected.files, busy, formalizeProgress, proveProgress, explainProgress) : null

  return (
    <div
      className="app"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const image = [...event.dataTransfer.files].find((item) => ACCEPTED.has(item.type))
        if (image) void attachImage(image)
      }}
    >
      <aside className="sidebar">
        <div className="drag" />
        <div className="brand">
          <Logo />
          ProofStudio
        </div>
        <button className="new-problem" type="button" onClick={() => void openFolder()}>
          <Icon name="plus" />
          Open folder
        </button>
        <div className="section-label">Problems</div>
        <div className="problems">
          {problems.length === 0 && <p className="hint">Open a folder to start a problem.</p>}
          {problems.map((problem) => (
            <section key={problem.id} className={problem.id === selectedId ? 'problem open' : 'problem'}>
              <div className="problem-row">
                <button
                  type="button"
                  className="problem-title"
                  onClick={() => {
                    setSelectedId(problem.id)
                    setSelectedFile('source')
                  }}
                >
                  <Icon name="folder" />
                  <span>{problem.title}</span>
                </button>
                <button
                  className="delete-problem"
                  type="button"
                  aria-label={`Delete ${problem.title}`}
                  onClick={() => setPendingDelete(problem)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              {problem.id === selectedId && pair && (
                <div className="files">
                  {problem.files.filter((item) => isListedFile(item.key)).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={item.key === pair.left || item.key === pair.right ? 'file linked' : 'file'}
                      aria-current={item.key === selectedFile}
                      onClick={() => setSelectedFile(item.key)}
                    >
                      <span className="file-dot" data-state={item.state} />
                      <span className="file-name">{item.filename}</span>
                      <span className="file-state" data-state={item.state}>
                        {STATE_LABEL[item.state]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
        <div className="environment">
          <div className="section-label">Environment</div>
          {tools?.map((tool) =>
            tool.ready ? (
              <div key={tool.id} className="env-row" title={tool.detail}>
                <span>{tool.label}</span>
                <span className="env-state" data-ready="true">
                  Ready
                </span>
              </div>
            ) : (
              <button
                key={tool.id}
                className="env-row missing"
                type="button"
                title={tool.hint}
                onClick={() => void window.proofStudio.openInstall(tool.id)}
              >
                <span>{tool.label}</span>
                <span className="env-state" data-ready="false">
                  Install
                </span>
              </button>
            )
          )}
          {tools?.some((tool) => !tool.ready) && (
            <p className="env-hint">{tools.filter((tool) => !tool.ready).map((tool) => tool.hint).join(' ')}</p>
          )}
          <button className="env-check" type="button" disabled={checkingTools} onClick={() => void refreshTools()}>
            {checkingTools ? 'Checking…' : 'Check again'}
          </button>
        </div>
        <button
          className="key-button"
          type="button"
          onClick={() => {
            pendingAfterKey.current = null
            setKeyOpen(true)
          }}
        >
          <Icon name="key" />
          {keySet ? 'API key set' : 'API key'}
          <span className="key-status" data-set={keySet} />
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              {selected && <Icon name="folder" size={13} />}
              {selected?.title ?? 'No problem selected'}
            </div>
            <h1>{pair?.title ?? 'ProofStudio'}</h1>
            {pair && (
              <div className="filename">
                <span className="chip">{fileName(selected, pair.left)}</span>
                <Icon name="arrow" size={13} />
                <span className="chip">{fileName(selected, pair.right)}</span>
              </div>
            )}
          </div>
          {(action || pair?.action === 'generate-proof') && (
          <div className="top-actions">
            {pair?.action === 'generate-proof' && (
              <label className="attempt-field">
                Attempts
                <input
                  type="number"
                  min={1}
                  max={PROOF_ATTEMPT_MAX}
                  value={attempts}
                  disabled={busy === 'prove'}
                  onChange={(event) => setAttempts(event.target.value)}
                />
              </label>
            )}
            {action && (
              <button
                className="next"
                type="button"
                disabled={!action.enabled}
                onClick={() => void runAction()}
              >
                <Icon name={actionIcon(pair, selected)} size={15} />
                {action.label}
              </button>
            )}
          </div>
          )}
          {!selected && (
            <button className="next" type="button" onClick={() => void openFolder()}>
              <Icon name="plus" size={15} />
              Open folder
            </button>
          )}
        </header>
        {pair?.action === 'generate-lean' && (formalizeProgress || formalizeRounds.length > 0) && (
          <StatusLog
            waiting={
              formalizeProgress?.phase === 'setup'
                ? 'Preparing Lean…'
                : formalizeProgress?.phase === 'attempt' && formalizeRounds.length < formalizeProgress.attempt
                  ? `Waiting for statement ${formalizeProgress.statement}…`
                  : null
            }
            rounds={formalizeRounds.map((round) => ({
              key: String(round.attempt),
              index: String(round.attempt),
              ok: round.ok,
              detail: round.detail
            }))}
          />
        )}
        {pair?.action === 'generate-solution' && (explainProgress || explainRounds.length > 0) && (
          <StatusLog
            waiting={
              explainProgress?.phase === 'attempt' && explainRounds.length < explainProgress.attempt
                ? `Waiting for solution TeX, attempt ${explainProgress.attempt} of ${explainProgress.total}…`
                : null
            }
            rounds={explainRounds.map((round) => ({
              key: String(round.attempt),
              index: String(round.attempt),
              ok: round.ok,
              detail: round.detail
            }))}
          />
        )}
        {pair?.action === 'generate-proof' && (proveProgress || proveRounds.length > 0) && (
          <StatusLog
            waiting={proveActivity(proveProgress)}
            rounds={proveRounds.map((round) => ({
              key: `${round.statement}-${round.attempt}`,
              index: `${round.statement}.${round.attempt}`,
              ok: round.ok,
              detail: round.detail
            }))}
          />
        )}
        {error && (
          <p className="banner" role="alert">
            <Icon name="alert" size={15} />
            {error}
          </p>
        )}
        {selected && pair ? (
          <div className="sheet">
            <Pane
              file={fileByKey(selected.files, pair.left)}
              content={leftContent}
              draft={draft}
              onDraft={setDraft}
              onAddScreenshot={() => fileInput.current?.click()}
            />
            <Pane
              file={fileByKey(selected.files, pair.right)}
              content={rightContent}
              draft={draft}
              onDraft={setDraft}
              onAddScreenshot={() => fileInput.current?.click()}
            />
          </div>
        ) : (
          <div className="empty">
            <span className="empty-icon">
              <Icon name="folder" size={18} />
            </span>
            <p>Open a folder. Its name is the problem name.</p>
          </div>
        )}
      </main>
      <input
        ref={fileInput}
        className="hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const image = event.target.files?.[0]
          event.target.value = ''
          if (image) void attachImage(image)
        }}
      />
      {pendingDelete && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault()
              void removeProblem(pendingDelete)
            }}
          >
            <h2>Delete {pendingDelete.title}?</h2>
            <p>Are you sure?</p>
            <div className="modal-actions">
              <button className="secondary" type="button" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button className="danger" type="submit">
                Delete
              </button>
            </div>
          </form>
        </div>
      )}
      {keyOpen && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={(event) => void saveKey(event)}>
            <h2>API key</h2>
            <p>Enter your Meta Model API key. It stays in memory until you quit ProofStudio.</p>
            <input
              autoFocus
              type="password"
              value={keyDraft}
              placeholder="API key"
              onChange={(event) => setKeyDraft(event.target.value)}
            />
            <div className="modal-actions">
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  pendingAfterKey.current = null
                  setKeyOpen(false)
                  setKeyDraft('')
                }}
              >
                Cancel
              </button>
              <button className="next" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Pane({
  file,
  content,
  draft,
  onDraft,
  onAddScreenshot
}: {
  file: ProblemFileView | undefined
  content: FileContent | null
  draft: string
  onDraft: (value: string) => void
  onAddScreenshot: () => void
}) {
  if (!file) return null
  const editable = file.key === 'problemText' && content?.kind === 'text'
  return (
    <section className="pane">
      <header className="pane-bar">
        <Icon name={file.key === 'source' ? 'image' : 'file'} size={14} />
        <span className="file-name">{file.filename}</span>
        <span className="file-state" data-state={file.state}>
          {STATE_LABEL[file.state]}
        </span>
      </header>
      <div className="pane-body">
        {content?.kind === 'image' && <img className="preview" src={content.dataUrl} alt="Problem screenshot" />}
        {content?.kind === 'pdf' && <embed className="pdf" type="application/pdf" src={content.dataUrl} />}
        {editable && (
          <textarea
            className="editor"
            spellCheck={false}
            value={draft}
            aria-label={file.label}
            onChange={(event) => onDraft(event.target.value)}
          />
        )}
        {content?.kind === 'text' && !editable && <pre className="editor readonly">{content.text}</pre>}
        {content?.kind === 'empty' && (
          <div
            className={file.key === 'source' ? 'empty droppable' : 'empty'}
            onClick={() => file.key === 'source' && onAddScreenshot()}
          >
            <span className="empty-icon">
              <Icon name={file.key === 'source' ? 'upload' : 'file'} size={18} />
            </span>
            <p>{emptyCopy(file.key)}</p>
            {content.error && <p className="empty-error">{content.error}</p>}
          </div>
        )}
      </div>
    </section>
  )
}

const ICONS = {
  plus: 'M8 3.5v9M3.5 8h9',
  folder: 'M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5',
  key: 'M7 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0M7.9 8.1 3 13M4.5 11.5 6 13',
  sparkle: 'M7 2.5l1.2 3.3 3.3 1.2-3.3 1.2L7 11.5 5.8 8.2 2.5 7l3.3-1.2zM12.5 10.5v3M11 12h3',
  file: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3',
  image: 'M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12zM2.5 11l3-3 3 3 2-2 3 3M10.5 5.75v.01',
  upload: 'M8 10.5V3M5 6l3-3 3 3M3 10.5V12a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12v-1.5',
  arrow: 'M3 8h10M9 4l4 4-4 4',
  alert: 'M8 2.5 14 13H2zM8 6.5v3M8 11.5v.01'
} as const

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="4" width="2.6" height="16" rx="1.3" fill="currentColor" />
        <rect x="3.5" y="10.7" width="10.2" height="2.6" rx="1.3" fill="currentColor" />
        <rect x="15.4" y="8.2" width="5.4" height="5.4" rx="0.8" fill="currentColor" />
      </svg>
    </span>
  )
}

function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

function actionIcon(pair: FilePair | null, problem: ProblemSummary | null): keyof typeof ICONS {
  if (pair?.action !== 'generate-tex' || !problem) return 'sparkle'
  const source = fileByKey(problem.files, 'source')
  return !source || source.state === 'empty' || source.state === 'failed' ? 'upload' : 'sparkle'
}

function StatusLog(props: {
  waiting: string | null
  rounds: { key: string; index: string; ok: boolean; detail: string }[]
}) {
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = log.current
    if (node) node.scrollTop = node.scrollHeight
  }, [props.waiting, props.rounds.length])
  return (
    <div className="status-bar" aria-live="polite" ref={log}>
      {props.waiting && <p className="status-wait">{props.waiting}</p>}
      {props.rounds.map((round) => (
        <article key={round.key} className="status-round">
          <div className="status-meta">
            <span className="status-index">{round.index}</span>
            <span className="status-state" data-ok={round.ok}>
              {round.ok ? 'Compiled' : 'Failed'}
            </span>
          </div>
          {round.detail && <pre className="status-detail">{round.detail}</pre>}
        </article>
      ))}
    </div>
  )
}

function pairFor(key: FileKey, files: ProblemFileView[]): FilePair {
  const tex = fileByKey(files, 'problemText')
  const texReady = Boolean(tex && tex.state !== 'empty' && tex.state !== 'failed')
  if (key === 'source' || ((key === 'problemText' || key === 'problemPdf') && !texReady)) {
    return {
      left: 'source',
      right: 'problemPdf',
      title: 'Screenshot to TeX',
      action: 'generate-tex',
      label: 'Generate TeX problem',
      busyLabel: 'Generating TeX…'
    }
  }
  if (key === 'problemText' || key === 'problemPdf') {
    return {
      left: 'problemText',
      right: 'problemPdf',
      title: 'Problem TeX',
      action: 'none',
      label: '',
      busyLabel: ''
    }
  }
  if (key === 'leanStub') {
    return {
      left: 'problemText',
      right: 'leanStub',
      title: 'TeX to Lean stub',
      action: 'generate-lean',
      label: 'Generate Lean stub',
      busyLabel: 'Generating Lean stub…'
    }
  }
  if (key === 'leanProof') {
    return {
      left: 'leanStub',
      right: 'leanProof',
      title: 'Lean stub to proof',
      action: 'generate-proof',
      label: 'Generate Lean proof',
      busyLabel: 'Generating Lean proof…'
    }
  }
  if (key === 'solutionTex') {
    return {
      left: 'leanProof',
      right: 'solutionTex',
      title: 'Lean to solution TeX',
      action: 'generate-solution',
      label: 'Generate solution TeX',
      busyLabel: 'Generating solution TeX…'
    }
  }
  return {
    left: 'leanProof',
    right: 'solutionPdf',
    title: 'Lean and solution PDF',
    action: 'generate-pdf',
    label: 'Generate PDF',
    busyLabel: 'Generating PDF…',
    texKey: 'solutionTex'
  }
}

function actionFor(
  pair: FilePair,
  files: ProblemFileView[],
  busy: Busy,
  progress: FormalizeProgress | null,
  proveProgress: ProveProgress | null,
  explainProgress: ExplainProgress | null
): { label: string; enabled: boolean } | null {
  if (pair.action === 'none') return null
  if (pair.action === 'generate-tex') {
    const source = fileByKey(files, 'source')
    if (!source || source.state === 'empty' || source.state === 'failed') {
      return { label: 'Add screenshot', enabled: !busy }
    }
    return { label: busy === 'transcribe' ? pair.busyLabel : pair.label, enabled: !busy }
  }
  if (pair.action === 'generate-lean') {
    const tex = fileByKey(files, 'problemText')
    const ready = Boolean(tex && (tex.state === 'current' || tex.state === 'stale'))
    return { label: busy === 'formalize' ? formalizeLabel(progress, pair.busyLabel) : pair.label, enabled: ready && !busy }
  }
  if (pair.action === 'generate-proof') {
    const stub = fileByKey(files, 'leanStub')
    const ready = Boolean(stub && (stub.state === 'current' || stub.state === 'stale'))
    return { label: busy === 'prove' ? proveLabel(proveProgress, pair.busyLabel) : pair.label, enabled: ready && !busy }
  }
  if (pair.action === 'generate-solution') {
    const proof = fileByKey(files, 'leanProof')
    const ready = Boolean(proof && (proof.state === 'current' || proof.state === 'stale'))
    return { label: busy === 'explain' ? explainLabel(explainProgress, pair.busyLabel) : pair.label, enabled: ready && !busy }
  }
  const tex = pair.texKey ? fileByKey(files, pair.texKey) : undefined
  const ready = Boolean(tex && (tex.state === 'current' || tex.state === 'stale'))
  return { label: busy === 'pdf' ? pair.busyLabel : pair.label, enabled: ready && !busy }
}

function formalizeLabel(progress: FormalizeProgress | null, fallback: string): string {
  if (progress?.phase === 'setup') return 'Preparing Lean…'
  if (progress?.phase === 'attempt') return `Generating statement ${progress.statement} of ${progress.total}…`
  return fallback
}

function explainLabel(progress: ExplainProgress | null, fallback: string): string {
  if (progress?.phase === 'attempt') return `Generating solution TeX, attempt ${progress.attempt} of ${progress.total}…`
  return fallback
}

function proveLabel(progress: ProveProgress | null, fallback: string): string {
  return proveActivity(progress) ?? fallback
}

function proveActivity(progress: ProveProgress | null): string | null {
  if (!progress) return null
  if (progress.phase === 'setup') return 'Preparing Lean…'
  const running = progress.running?.filter((item) => item.attempt > 0) ?? []
  if (running.length === 0) {
    if (progress.phase !== 'attempt' || progress.attempt <= 0) return null
    return `Proving statement ${progress.statement}, attempt ${progress.attempt} of ${progress.total}…`
  }
  const text = running.map((item) => `statement ${item.statement}, attempt ${item.attempt} of ${progress.total}`).join(' and ')
  return `Proving ${text}…`
}

function fileName(problem: ProblemSummary | null, key: FileKey): string {
  return fileByKey(problem?.files ?? [], key)?.filename ?? key
}

function emptyCopy(key: FileKey): string {
  switch (key) {
    case 'source':
      return 'Drop a screenshot here, or paste with Cmd+V.'
    case 'problemText':
      return 'problem.tex is created when you generate the TeX problem from the screenshot.'
    case 'problemPdf':
      return 'This PDF is compiled when the TeX problem is generated.'
    case 'leanStub':
      return 'stub.lean is created from problem.tex and saved in the problem folder, with its own Lean project. Muse writes two Lean statements of the problem. Each proof is sorry, and Lake checks the file against Mathlib.'
    case 'leanProof':
      return 'proof.lean is written into the solution folder, separate from the problem project. Muse proves one statement from stub.lean. Set how many attempts each statement gets. If the first compiles, the second is left alone.'
    case 'solutionTex':
      return 'solution.tex is written from solution/proof.lean. Muse writes a LaTeX proof that follows the Lean proof, then pdflatex compiles solution.pdf. A document that does not compile is tried again, up to 3 times.'
    case 'solutionPdf':
      return 'solution.pdf is compiled from solution.tex and shown beside the Lean proof.'
  }
}

function imageFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null
  const fromFiles = [...data.files].find((item) => ACCEPTED.has(item.type))
  if (fromFiles) return fromFiles
  const item = [...data.items].find((entry) => ACCEPTED.has(entry.type))
  return item?.getAsFile() ?? null
}

function blobToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the screenshot.'))
    reader.readAsDataURL(file)
  })
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.'
}
