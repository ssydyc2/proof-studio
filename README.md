# ProofStudio

ProofStudio is a macOS app for working on a math proof, one step at a time.

You open a folder. The folder name is the problem name. The app keeps the files for that problem inside the folder and shows whether each one is empty, current, stale, or failed. You choose the next step. The app does not run the whole pipeline for you.

The steps are:

1. Add a screenshot and turn it into `problem.tex`.
2. Turn that statement into a Lean problem whose proof is `sorry`.
3. Generate the Lean proof.
4. Write a human-readable proof.

Steps 1, 2, and 3 are available. Step 2 turns `problem.tex` into `problem/stub.lean`. That folder is its own Lake project (`lean-toolchain`, `lakefile.toml`, `lake-manifest.json`). Step 3 writes `solution/proof.lean` in a separate Lake project. The two projects link their Mathlib packages to one shared build. The app lists `problem/stub.lean` and `solution/proof.lean` only. Muse writes two Lean statements, each proved by `sorry`. If the first does not compile, the next question asks for it again. If it compiles, the next question appends a second statement and does not add an iff theorem. Each file is checked with `lake env lean`, because a bare `lean` command cannot see Mathlib. A statement that already compiled is kept. Muse is asked to prove only the first statement. The attempt count is the number next to Generate Lean proof, from 1 to 10, and it starts at 3. A reply that still contains `sorry` is rejected. If it compiles, the second statement is not sent. If every attempt fails and a second statement exists, that statement gets the same number of attempts. The Lean errors from every earlier attempt on that statement stay on that step’s page and are sent with the next attempt. Switching to another file hides them, and switching back shows them again. When `problem.tex` exists, you can also compile it to `problem.pdf` with the `pdflatex` on this Mac. The readable-proof step stays visible, and its button stays off.

A Meta Muse API key is entered in the app and kept in memory until you quit. It is not saved to disk.

## Run the app

You need Node.js and npm. PDF generation needs MacTeX, which provides `/Library/TeX/texbin/pdflatex`. The Lean stub needs Lean 4, installed with elan. The first stub also downloads Mathlib for that Lean version. The app still opens without them.

```bash
npm install
npm start
```

`npm start` builds the app and opens it in Electron on this Mac. The window loads those built files. It does not open a browser.

`npm run dev` is for editing. It also opens Electron, and refreshes that window from a local server while files change. macOS calls both of these processes Electron. `npm run app` writes `ProofStudio.app`, which uses the ProofStudio Dock name.

## Generate the app

```bash
npm install
npm run app
open dist/mac-arm64/ProofStudio.app
```

`npm run app` writes `dist/mac-arm64/ProofStudio.app`. The Dock and the menu name are ProofStudio.

`out/` is the compiled JavaScript, not the app. `npm start` and `npm run dev` launch Electron's own shell, so macOS calls that process Electron.

## Generate a DMG

```bash
npm run dmg
open dist/ProofStudio-0.1.0-arm64.dmg
```

`npm run dmg` writes `dist/ProofStudio-0.1.0-arm64.dmg`. The version in the file name comes from `package.json`. Opening the disk image shows `ProofStudio.app`, which you can drag into Applications.

## Changes

Do not commit directly to `main`. Open a pull request for each change.
