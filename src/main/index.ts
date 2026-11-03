import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import path from 'node:path'
import { compileTex } from './latex'
import { formalizeProblem, hasApiKey, proveProblem, setApiKey, transcribeProblem } from './muse'
import { installUrl, toolchainStatus } from './toolchain'
import { addSource, deleteProblem, listProblems, openProblemFolder, readFile, writeProblemText } from './workspace'
import { PROBLEM_FILES, type FileKey, type TexSourceKey } from '../shared/problem'
import type { ToolId } from '../shared/toolchain'

const FILE_KEYS = new Set<FileKey>(PROBLEM_FILES.map((file) => file.key))

app.setName('ProofStudio')

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 620,
    title: 'ProofStudio',
    backgroundColor: '#f4f6fa',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('problems:list', () => listProblems())
  ipcMain.handle('problems:open-folder', async () => {
    const parent = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Open a problem folder',
      buttonLabel: 'Open',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    const problem = openProblemFolder(result.filePaths[0])
    return { problems: listProblems(), id: problem.id }
  })
  ipcMain.handle('problems:delete', (_event, id: string) => {
    deleteProblem(id)
    return listProblems()
  })
  ipcMain.handle('problems:add-source', (_event, id: string, base64: string, mime: string) => {
    addSource(id, Buffer.from(base64, 'base64'), mime)
    return listProblems()
  })
  ipcMain.handle('problems:read', (_event, id: string, key: FileKey) => {
    if (!FILE_KEYS.has(key)) throw new Error('Unknown file.')
    return readFile(id, key)
  })
  ipcMain.handle('problems:write-text', (_event, id: string, text: string) => {
    writeProblemText(id, text)
    return listProblems()
  })
  ipcMain.handle('api-key:has', () => hasApiKey())
  ipcMain.handle('api-key:set', (_event, key: string) => {
    setApiKey(key)
  })
  ipcMain.handle('problems:transcribe', async (_event, id: string) => {
    await transcribeProblem(id)
    return listProblems()
  })
  ipcMain.handle('problems:formalize', async (event, id: string) => {
    await formalizeProblem(id, (progress) => {
      event.sender.send('formalize:progress', progress)
    })
    return listProblems()
  })
  ipcMain.handle('problems:prove', async (event, id: string, attempts: number) => {
    await proveProblem(id, attempts, (progress) => {
      event.sender.send('prove:progress', progress)
    })
    return listProblems()
  })
  ipcMain.handle('problems:compile', async (_event, id: string, sourceKey: TexSourceKey) => {
    if (sourceKey !== 'problemText' && sourceKey !== 'readable') throw new Error('Unknown file.')
    await compileTex(id, sourceKey)
    return listProblems()
  })
  ipcMain.handle('environment:status', () => toolchainStatus())
  ipcMain.handle('environment:open', (_event, id: ToolId) => {
    if (id !== 'tex' && id !== 'lean') throw new Error('Unknown tool.')
    return shell.openExternal(installUrl(id))
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
