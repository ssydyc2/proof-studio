import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addSource, openProblemFolder } from '../src/main/workspace'

const folder = path.join(os.homedir(), 'Documents', 'Proof Studio', 'Infinitely many primes')
fs.mkdirSync(folder, { recursive: true })
const problem = openProblemFolder(folder)
const bytes = fs.readFileSync(fileURLToPath(new URL('../fixtures/infinitely-many-primes.png', import.meta.url)))
addSource(problem.id, bytes, 'image/png')
console.log(problem.title)
