import assert from 'node:assert/strict'
import { parseLeanRanges } from '../src/shared/locate'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-studio-'))
process.env.PROOF_STUDIO_REGISTRY = path.join(root, 'folders.json')
process.env.PROOF_STUDIO_LEGACY = path.join(root, 'legacy')
fs.mkdirSync(process.env.PROOF_STUDIO_LEGACY)
const folder = path.join(root, 'Infinitely many primes')
fs.mkdirSync(folder)

assert.deepEqual(parseLeanRanges('{"ranges":[{"start":2,"end":4},{"start":3,"end":6}]}', 8), [
  { start: 2, end: 6 }
])
assert.deepEqual(parseLeanRanges('```json\n{"start":1,"end":2}\n```', 5), [{ start: 1, end: 2 }])
assert.deepEqual(parseLeanRanges('{"ranges":[{"start":0,"end":2},{"start":9,"end":10},{"start":4,"end":3}]}', 4), [])
assert.deepEqual(parseLeanRanges('{"ranges":[]}', 3), [])
assert.throws(() => parseLeanRanges('no line numbers', 3), /line numbers/)

const fixture = fileURLToPath(new URL('../fixtures/infinitely-many-primes.png', import.meta.url))
const image = fs.readFileSync(fixture)

const { ensureLatexDocument, isListedFile, titleFromProblemText } = await import('../src/shared/problem')
const { addSource, openProblemFolder, readFile } = await import('../src/main/workspace')
const { compileTex } = await import('../src/main/latex')

const sentence = 'Prove that there are infinitely many primes.'
const tex = ensureLatexDocument(sentence)
assert.equal(titleFromProblemText(tex), sentence)
assert.match(tex, /\\documentclass\{article\}/)
assert.match(tex, /\\begin\{document\}/)

const problem = openProblemFolder(folder)
assert.equal(problem.title, 'Infinitely many primes')
addSource(problem.id, image, 'image/png')
const withSource = (await import('../src/main/workspace')).listProblems()[0]
assert.equal(withSource.files.find((file) => file.key === 'source')?.state, 'completed')
assert.equal(withSource.files.find((file) => file.key === 'source')?.filename, 'source.png')
assert.equal(withSource.files.find((file) => file.key === 'problemText')?.filename, 'problem.tex')
assert.equal(withSource.files.find((file) => file.key === 'problemText')?.state, 'empty')
assert.equal(withSource.files.find((file) => file.key === 'problemPdf')?.filename, 'problem.pdf')
assert.equal(isListedFile('problemPdf'), false)
assert.equal(isListedFile('solutionPdf'), true)
assert.equal(withSource.files.find((file) => file.key === 'solutionTex')?.filename, 'solution.tex')
assert.equal(withSource.files.find((file) => file.key === 'solutionPdf')?.filename, 'solution.pdf')
assert.equal(withSource.nextStep, 'transcribe')

const saved = image
const stored = readFile(withSource.id, 'source')
assert.equal(stored.kind, 'image')
if (stored.kind === 'image') {
  const bytes = Buffer.from(stored.dataUrl.split(',')[1] ?? '', 'base64')
  assert.deepEqual(bytes, saved)
}

const { writeProblemText } = await import('../src/main/workspace')
const written = writeProblemText(withSource.id, tex)
assert.equal(written.title, 'Infinitely many primes')
assert.equal(written.files.find((file) => file.key === 'problemText')?.state, 'completed')
assert.equal(written.nextStep, 'formalize')

await compileTex(written.id, 'problemText')
const compiled = (await import('../src/main/workspace')).listProblems()[0]
const pdf = compiled.files.find((file) => file.key === 'problemPdf')
assert.equal(pdf?.state, 'completed')
const pdfBytes = fs.readFileSync(path.join(folder, 'problem.pdf'))
assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-')

const { writeSolutionText } = await import('../src/main/workspace')
writeSolutionText(written.id, ensureLatexDocument('There are infinitely many primes.'))
await compileTex(written.id, 'solutionTex')
const solutionPdfBytes = fs.readFileSync(path.join(folder, 'solution.pdf'))
assert.equal(solutionPdfBytes.subarray(0, 5).toString(), '%PDF-')

const { writeLeanStub } = await import('../src/main/workspace')
const stubSource = `import Mathlib.Data.Nat.Prime.Defs

theorem statement1 : Nat.Prime 2 := by
  sorry

theorem statement2 : Nat.Prime (0 + 2) := by
  sorry
`
const withStub = writeLeanStub(compiled.id, stubSource)
assert.equal(withStub.files.find((file) => file.key === 'leanStub')?.state, 'completed')
assert.equal(withStub.nextStep, 'prove')
assert.equal(fs.existsSync(path.join(folder, 'stub.lean')), false)
assert.equal(fs.readFileSync(path.join(folder, 'problem', 'stub.lean'), 'utf8'), stubSource)
assert.equal(withStub.files.find((file) => file.key === 'leanStub')?.filename, 'problem/stub.lean')

const proofSource = `import Mathlib.Data.Nat.Prime.Defs

theorem statement1 : Nat.Prime 2 := by
  decide
`
const { writeLeanProof } = await import('../src/main/workspace')
const withProof = writeLeanProof(compiled.id, proofSource)
assert.equal(withProof.files.find((file) => file.key === 'leanProof')?.state, 'completed')
assert.equal(withProof.nextStep, 'explain')
assert.equal(fs.existsSync(path.join(folder, 'proof.lean')), false)
assert.equal(fs.readFileSync(path.join(folder, 'solution', 'proof.lean'), 'utf8'), proofSource)
assert.equal(withProof.files.find((file) => file.key === 'leanProof')?.filename, 'solution/proof.lean')
assert.equal(fs.existsSync(path.join(folder, 'problem', 'proof.lean')), false)
assert.equal(fs.existsSync(path.join(folder, 'solution', 'stub.lean')), false)

const { compileLeanSource, installLeanProject } = await import('../src/main/lean')
await installLeanProject(path.join(folder, 'problem'))
await installLeanProject(path.join(folder, 'solution'))
assert.equal(fs.existsSync(path.join(folder, 'lakefile.toml')), false)
assert.match(fs.readFileSync(path.join(folder, 'problem', 'lakefile.toml'), 'utf8'), /mathlib/)
assert.match(fs.readFileSync(path.join(folder, 'solution', 'lakefile.toml'), 'utf8'), /mathlib/)
assert.match(fs.readFileSync(path.join(folder, 'problem', 'lean-toolchain'), 'utf8'), /leanprover\/lean4:v/)
assert.match(fs.readFileSync(path.join(folder, 'solution', 'lean-toolchain'), 'utf8'), /leanprover\/lean4:v/)
assert.equal(fs.existsSync(path.join(folder, 'problem', 'lake-manifest.json')), true)
assert.equal(fs.existsSync(path.join(folder, 'solution', 'lake-manifest.json')), true)
const sharedPackages = fs.readlinkSync(path.join(folder, 'problem', '.lake', 'packages'))
assert.equal(fs.readlinkSync(path.join(folder, 'solution', '.lake', 'packages')), sharedPackages)
assert.equal(fs.existsSync(sharedPackages), true)
const lakeResult = await compileLeanSource(stubSource)
assert.equal(lakeResult.ok, true)

const sourcePath = path.join(folder, 'source.png')
const later = new Date(Date.now() + 2000)
fs.utimesSync(sourcePath, later, later)
const stale = (await import('../src/main/workspace')).listProblems()[0]
assert.equal(stale.files.find((file) => file.key === 'problemText')?.state, 'stale')
assert.equal(stale.nextStep, 'transcribe')

fs.writeFileSync(path.join(folder, 'notes.txt'), 'keep me')
const { deleteProblem } = await import('../src/main/workspace')
deleteProblem(written.id)
assert.equal(fs.existsSync(path.join(folder, 'notes.txt')), true)
assert.equal(fs.existsSync(path.join(folder, 'problem.json')), false)
assert.equal(fs.existsSync(path.join(folder, 'problem.tex')), false)
assert.equal(fs.existsSync(path.join(folder, 'stub.lean')), false)
assert.equal(fs.existsSync(path.join(folder, 'lean')), false)
assert.equal(fs.existsSync(path.join(folder, 'problem')), false)
assert.equal(fs.existsSync(path.join(folder, 'solution')), false)
assert.equal(fs.existsSync(path.join(folder, 'lakefile.toml')), false)
assert.equal(fs.existsSync(path.join(folder, '.lake')), false)
assert.equal(fs.existsSync(sharedPackages), true)
assert.equal((await import('../src/main/workspace')).listProblems().length, 0)

const legacyDir = path.join(root, 'Legacy layout')
fs.mkdirSync(path.join(legacyDir, 'lean'), { recursive: true })
fs.writeFileSync(path.join(legacyDir, 'lean', 'stub.lean'), stubSource)
fs.writeFileSync(path.join(legacyDir, 'lean', 'proof.lean'), proofSource)
fs.writeFileSync(path.join(legacyDir, 'lean', 'lean-toolchain'), 'leanprover/lean4:v4.31.0\n')
const legacy = (await import('../src/main/workspace')).openProblemFolder(legacyDir)
assert.equal(fs.readFileSync(path.join(legacyDir, 'problem', 'stub.lean'), 'utf8'), stubSource)
assert.equal(fs.readFileSync(path.join(legacyDir, 'solution', 'proof.lean'), 'utf8'), proofSource)
assert.equal(fs.readFileSync(path.join(legacyDir, 'problem', 'lean-toolchain'), 'utf8'), 'leanprover/lean4:v4.31.0\n')
assert.equal(fs.readFileSync(path.join(legacyDir, 'solution', 'lean-toolchain'), 'utf8'), 'leanprover/lean4:v4.31.0\n')
assert.equal(fs.existsSync(path.join(legacyDir, 'lean', 'stub.lean')), false)
assert.equal(fs.existsSync(path.join(legacyDir, 'lean', 'proof.lean')), false)
assert.equal(legacy.files.find((file) => file.key === 'leanStub')?.state, 'completed')
assert.equal(legacy.files.find((file) => file.key === 'leanProof')?.state, 'completed')
deleteProblem(legacy.id)

const solutionDir = path.join(root, 'Old solution')
fs.mkdirSync(solutionDir)
fs.writeFileSync(path.join(solutionDir, 'readable.tex'), 'old\n')
fs.writeFileSync(path.join(solutionDir, 'writeup.pdf'), '%PDF-')
const renamed = (await import('../src/main/workspace')).openProblemFolder(solutionDir)
assert.equal(fs.readFileSync(path.join(solutionDir, 'solution.tex'), 'utf8'), 'old\n')
assert.equal(fs.existsSync(path.join(solutionDir, 'readable.tex')), false)
assert.equal(fs.existsSync(path.join(solutionDir, 'writeup.pdf')), false)
assert.equal(renamed.files.find((file) => file.key === 'solutionTex')?.state, 'completed')
assert.equal(renamed.files.find((file) => file.key === 'solutionPdf')?.state, 'completed')
deleteProblem(renamed.id)

const removable = path.join(root, 'Empty problem')
fs.mkdirSync(removable)
const empty = (await import('../src/main/workspace')).openProblemFolder(removable)
deleteProblem(empty.id)
assert.equal(fs.existsSync(removable), false)

const untitledDir = path.join(process.env.PROOF_STUDIO_LEGACY, 'problem-abc123')
fs.mkdirSync(untitledDir)
fs.writeFileSync(
  path.join(untitledDir, 'problem.json'),
  `${JSON.stringify({ id: 'problem-abc123', title: 'Untitled problem', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })}\n`
)
const listed = (await import('../src/main/workspace')).listProblems()
assert.equal(listed.some((problem) => problem.title === 'Untitled problem' && problem.id === 'problem-abc123'), true)
deleteProblem('problem-abc123')
assert.equal(fs.existsSync(untitledDir), false)
assert.equal((await import('../src/main/workspace')).listProblems().some((problem) => problem.id === 'problem-abc123'), false)

const { findExecutable, installedLeanRelease, toolchainStatus } = await import('../src/main/toolchain')
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-studio-bin-'))
fs.writeFileSync(path.join(bin, 'pdflatex'), '')
assert.equal(findExecutable('pdflatex', [bin]), path.join(bin, 'pdflatex'))
assert.equal(findExecutable('not-a-proof-studio-tool', [bin]), null)
const toolchainRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-studio-toolchains-'))
fs.mkdirSync(path.join(toolchainRoot, 'leanprover--lean4---v4.9.0'))
fs.mkdirSync(path.join(toolchainRoot, 'leanprover--lean4---v4.31.0'))
fs.writeFileSync(path.join(toolchainRoot, 'leanprover--lean4---v4.35.lock'), '1')
assert.equal(installedLeanRelease(toolchainRoot)?.toolchain, 'leanprover/lean4:v4.31.0')
const leanStatus = (await toolchainStatus()).find((tool) => tool.id === 'lean')
assert.equal(leanStatus?.ready, true)
assert.match(leanStatus?.detail ?? '', /Lean \(version \d+\.\d+\.\d+/)

const { compilerFeedback, extractLean, formalizeSource, nextFormulation, summarizeLeanFailure } = await import(
  '../src/main/formalize'
)
const fenced = 'Here is the file.\n```lean\nimport A\n\ntheorem t : True := by\n  sorry\n```\n'
assert.equal(extractLean(fenced), 'import A\n\ntheorem t : True := by\n  sorry')
const diagnostic = 'stub.lean:3:8: error: unknown identifier `Foo`\n  Foo\n'
assert.match(summarizeLeanFailure(diagnostic), /unknown identifier/)
assert.match(compilerFeedback(diagnostic), /unknown identifier/)

const formulation1 = `import Mathlib.Data.Nat.Prime.Defs

theorem statement1 : Nat.Prime 2 := by
  sorry
`
const appended = nextFormulation(formulation1.trim(), 'theorem statement2 : Nat.Prime (0 + 2) := by sorry')
assert.equal(appended.ok, true)
if (appended.ok) {
  assert.match(appended.source, /statement1/)
  assert.match(appended.source, /statement2/)
  assert.doesNotMatch(appended.source, /iff/)
}
const iffReply = `${formulation1}
theorem statement1_iff_statement2 : statement1 ↔ statement2 := by
  sorry
`
assert.equal(nextFormulation(formulation1.trim(), iffReply).ok, false)

let asks = 0
const prompts: string[] = []
const recovered = await formalizeSource({
  tex: 'Prove that 2 is prime.',
  toolchain: 'leanprover/lean4:v4.31.0',
  ask: async (prompt) => {
    prompts.push(prompt)
    asks += 1
    if (asks === 1) return formulation1
    return 'theorem statement2 : Nat.Prime (0 + 2) := by sorry'
  },
  compile: async (source) => {
    assert.match(source, /\bsorry\b/)
    assert.doesNotMatch(source, /iff/)
    return { ok: true }
  }
})
assert.equal(asks, 2)
assert.match(recovered, /statement1/)
assert.match(recovered, /statement2/)
assert.match(prompts[1], /Append theorem statement2/)
assert.match(prompts[1], /Lean file so far/)

let retryAsks = 0
const retryPrompts: string[] = []
const retried = await formalizeSource({
  tex: 'Prove that 2 is prime.',
  toolchain: 'leanprover/lean4:v4.31.0',
  ask: async (prompt) => {
    retryPrompts.push(prompt)
    retryAsks += 1
    return formulation1
  },
  compile: async () => {
    if (retryAsks === 1) return { ok: false, output: 'stub.lean:1:16: error: unknown identifier `NotAType`' }
    return { ok: true }
  }
})
assert.equal(retryAsks, 2)
assert.match(retried, /statement1/)
assert.doesNotMatch(retried, /statement2/)
assert.match(retryPrompts[1], /statement1/)
assert.match(retryPrompts[1], /Write statement1 again/)
assert.doesNotMatch(retryPrompts[1], /statement2/)

let iffAsks = 0
const kept = await formalizeSource({
  tex: 'Prove that 2 is prime.',
  toolchain: 'leanprover/lean4:v4.31.0',
  ask: async () => {
    iffAsks += 1
    if (iffAsks === 1) return formulation1
    return 'theorem statement1_iff_statement2 : statement1 ↔ statement2 := by sorry'
  },
  compile: async (source) => {
    assert.doesNotMatch(source, /iff/)
    return { ok: true }
  }
})
assert.match(kept, /statement1/)
assert.doesNotMatch(kept, /iff/)

let failures = 0
let failureAsks = 0
await assert.rejects(
  formalizeSource({
    tex: 'Prove that 2 is prime.',
    toolchain: 'leanprover/lean4:v4.31.0',
    ask: async () => {
      failureAsks += 1
      return `theorem statement1 : NotAType := by sorry`
    },
    compile: async () => {
      failures += 1
      return { ok: false, output: 'stub.lean:1:16: error: unknown identifier `NotAType`' }
    }
  }),
  /after 2 attempts/
)
assert.equal(failureAsks, 2)
assert.equal(failures, 2)

const { explainSource } = await import('../src/main/explain')
const solutionDoc = '\\documentclass{article}\n\\begin{document}\nA proof.\n\\end{document}'
let explainAsks = 0
const explainPrompts: string[] = []
const explained = await explainSource({
  lean: 'theorem statement1 : Nat.Prime 2 := by decide',
  problem: 'Prove that 2 is prime.',
  ask: async (prompt) => {
    explainPrompts.push(prompt)
    explainAsks += 1
    if (explainAsks < 3) return 'not latex'
    return `\`\`\`latex\n${solutionDoc}\n\`\`\``
  },
  compile: async (tex) => {
    if (tex.includes('not latex')) return { ok: false, message: 'Emergency stop.' }
    return { ok: true }
  }
})
assert.equal(explainAsks, 3)
assert.match(explained, /A proof/)
assert.match(explainPrompts[0], /Lean proof/)
assert.match(explainPrompts[0], /Prove that 2 is prime/)
assert.match(explainPrompts[2], /did not compile/)
assert.match(explainPrompts[2], /Emergency stop/)

await assert.rejects(
  explainSource({
    lean: 'theorem statement1 : True := by trivial',
    problem: '',
    ask: async () => solutionDoc,
    compile: async () => ({ ok: false, message: 'Undefined control sequence.' })
  }),
  /after 3 attempts/
)

const { proofError, proveSource, statementsOf } = await import('../src/main/prove')
const two = `import Mathlib.Data.Nat.Prime.Defs

theorem statement1 : Nat.Prime 2 := by
  sorry

theorem statement2 : Nat.Prime (0 + 2) := by
  sorry
`
const split = statementsOf(two)
assert.equal(split.length, 2)
assert.match(split[0].file, /theorem statement1/)
assert.doesNotMatch(split[0].file, /theorem statement2/)
assert.match(split[1].file, /theorem statement2/)
assert.doesNotMatch(split[1].file, /theorem statement1/)
assert.match(split[0].file, /import Mathlib.Data.Nat.Prime.Defs/)
assert.match(split[1].file, /import Mathlib.Data.Nat.Prime.Defs/)

const proved1 = `import Mathlib.Data.Nat.Prime.Defs

theorem statement1 : Nat.Prime 2 := by
  decide
`
let releaseSecond: () => void = () => {}
const holdSecond = new Promise<void>((resolve) => {
  releaseSecond = resolve
})
let secondStarted = 0
const provePrompts: string[] = []
let proveCompiles = 0
const firstProof = await proveSource({
  stub: two,
  toolchain: 'leanprover/lean4:v4.31.0',
  ask: async (prompt) => {
    provePrompts.push(prompt)
    if (prompt.includes('Prove only statement2')) {
      secondStarted += 1
      await holdSecond
      return split[1].file
    }
    if (prompt.includes('Earlier attempts failed')) return proved1
    return split[0].file
  },
  compile: async (source) => {
    proveCompiles += 1
    assert.equal(source, proved1.trim())
    assert.doesNotMatch(source, /\bsorry\b/)
    setTimeout(releaseSecond, 0)
    return { ok: true }
  }
})
assert.equal(secondStarted, 1)
assert.equal(proveCompiles, 1)
assert.equal(firstProof, proved1.trim())
const statement1Prompts = provePrompts.filter((prompt) => prompt.includes('Prove only statement1'))
assert.equal(statement1Prompts.length, 2)
assert.doesNotMatch(statement1Prompts[0], /theorem statement2/)
assert.match(statement1Prompts[1], /must not contain sorry/)
assert.doesNotMatch(statement1Prompts[1], /theorem statement2/)

const proved2 = `import Mathlib.Data.Nat.Prime.Defs

theorem statement2 : Nat.Prime (0 + 2) := by
  decide
`
const historyPrompts: string[] = []
await assert.rejects(
  proveSource({
    stub: two,
    toolchain: 'leanprover/lean4:v4.31.0',
    ask: async (prompt) => {
      if (prompt.includes('Prove only statement2')) return split[1].file
      historyPrompts.push(prompt)
      if (historyPrompts.length === 1) return 'theorem statement1 : Nat.Prime 2 := by\n  exact True'
      if (historyPrompts.length === 2) return 'theorem statement1 : Nat.Prime 2 := by\n  exact False'
      return 'theorem statement1 : Nat.Prime 2 := by\n  exact Nat'
    },
    compile: async () => ({ ok: false, output: 'stub.lean:3:2: error: type mismatch' })
  }),
  /statement1 failed after 3 attempts/
)
assert.equal(historyPrompts.length, 3)
assert.match(historyPrompts[1], /exact True/)
assert.doesNotMatch(historyPrompts[1], /exact False/)
assert.match(historyPrompts[2], /Prove statement1 again/)
assert.match(historyPrompts[2], /Attempt 1/)
assert.match(historyPrompts[2], /exact True/)
assert.match(historyPrompts[2], /Attempt 2/)
assert.match(historyPrompts[2], /exact False/)

let releaseFirst: () => void = () => {}
const holdFirst = new Promise<void>((resolve) => {
  releaseFirst = resolve
})
let firstStarted = 0
const raced = await proveSource({
  stub: two,
  toolchain: 'leanprover/lean4:v4.31.0',
  ask: async (prompt) => {
    if (prompt.includes('Prove only statement1')) {
      firstStarted += 1
      await holdFirst
      return 'theorem statement1 : Nat.Prime 2 := by\n  exact True'
    }
    return proved2
  },
  compile: async (source) => {
    if (source === proved2.trim()) {
      setTimeout(releaseFirst, 0)
      return { ok: true }
    }
    return { ok: false, output: 'stub.lean:3:2: error: type mismatch' }
  }
})
assert.equal(raced, proved2.trim())
assert.equal(firstStarted, 1)

let changedCompiles = 0
await assert.rejects(
  proveSource({
    stub: split[0].file,
    toolchain: 'leanprover/lean4:v4.31.0',
    ask: async () => 'theorem statement1 : True := by\n  trivial',
    compile: async () => {
      changedCompiles += 1
      return { ok: true }
    }
  }),
  /statement1 failed after 3 attempts/
)
assert.equal(changedCompiles, 0)
assert.match(proofError('theorem statement1 : True := by trivial\n', split[0]), /Do not change the statement/)

let bothAsks = 0
await assert.rejects(
  proveSource({
    stub: two,
    toolchain: 'leanprover/lean4:v4.31.0',
    ask: async (prompt) => {
      bothAsks += 1
      return prompt.includes('Prove only statement2') ? split[1].file : split[0].file
    },
    compile: async () => {
      throw new Error('sorry must not be compiled')
    }
  }),
  /statement1 failed after 3 attempts\. statement2 failed after 3 attempts/
)
assert.equal(bothAsks, 6)

let oneAsk = 0
await assert.rejects(
  proveSource({
    stub: split[0].file,
    toolchain: 'leanprover/lean4:v4.31.0',
    attempts: 1,
    ask: async () => {
      oneAsk += 1
      return 'theorem statement1 : Nat.Prime 2 := by\n  exact True'
    },
    compile: async () => ({ ok: false, output: 'stub.lean:3:2: error: type mismatch\n  exact True' })
  }),
  /statement1 failed after 1 attempt/
)
assert.equal(oneAsk, 1)

await assert.rejects(
  proveSource({
    stub: split[0].file,
    toolchain: 'leanprover/lean4:v4.31.0',
    attempts: 0,
    ask: async () => split[0].file,
    compile: async () => ({ ok: true })
  }),
  /from 1 to 10/
)

console.log(`workspace check passed in ${root}`)
