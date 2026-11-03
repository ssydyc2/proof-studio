import assert from 'node:assert/strict'
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

const fixture = fileURLToPath(new URL('../fixtures/infinitely-many-primes.png', import.meta.url))
const image = fs.readFileSync(fixture)

const { ensureLatexDocument, titleFromProblemText } = await import('../src/shared/problem')
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
assert.equal(withSource.files.find((file) => file.key === 'source')?.state, 'current')
assert.equal(withSource.files.find((file) => file.key === 'source')?.filename, 'source.png')
assert.equal(withSource.files.find((file) => file.key === 'problemText')?.filename, 'problem.tex')
assert.equal(withSource.files.find((file) => file.key === 'problemText')?.state, 'empty')
assert.equal(withSource.files.find((file) => file.key === 'problemPdf')?.filename, 'problem.pdf')
assert.equal(withSource.files.find((file) => file.key === 'readable')?.filename, 'readable.tex')
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
assert.equal(written.files.find((file) => file.key === 'problemText')?.state, 'current')
assert.equal(written.nextStep, 'formalize')

await compileTex(written.id, 'problemText')
const compiled = (await import('../src/main/workspace')).listProblems()[0]
const pdf = compiled.files.find((file) => file.key === 'problemPdf')
assert.equal(pdf?.state, 'current')
const pdfBytes = fs.readFileSync(path.join(folder, 'problem.pdf'))
assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-')

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
assert.equal((await import('../src/main/workspace')).listProblems().length, 0)

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

const { findExecutable } = await import('../src/main/toolchain')
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-studio-bin-'))
fs.writeFileSync(path.join(bin, 'pdflatex'), '')
assert.equal(findExecutable('pdflatex', [bin]), path.join(bin, 'pdflatex'))
assert.equal(findExecutable('not-a-proof-studio-tool', [bin]), null)

console.log(`workspace check passed in ${root}`)
