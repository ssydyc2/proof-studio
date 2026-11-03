# ProofStudio

ProofStudio is a macOS app for working on a math proof, one step at a time.

You open a folder. The folder name is the problem name. The app keeps the files for that problem inside the folder and shows whether each one is empty, current, stale, or failed. You choose the next step. The app does not run the whole pipeline for you.

The steps are:

1. Add a screenshot and turn it into `problem.tex`.
2. Turn that statement into a Lean problem whose proof is `sorry`.
3. Generate the Lean proof.
4. Write a human-readable proof.

Only step 1 is available. When `problem.tex` exists, you can also compile it to `problem.pdf` with the `pdflatex` on this Mac. Later steps stay visible so you can see the files they will use, and their buttons stay off.

A Meta Muse API key is entered in the app and kept in memory until you quit. It is not saved to disk.

## Run the app

You need Node.js and npm. PDF generation also needs MacTeX, which provides `/Library/TeX/texbin/pdflatex`. The app still opens without it.

```bash
npm install
npm run dev
```

`npm run dev` installs nothing extra and opens the Electron app against the local dev server.

## Build the app

```bash
npm install
npm run build
npx electron .
```

`npm run build` writes the production bundle to `out/`. `npx electron .` opens that bundle. This does not produce a `.dmg`.

## Changes

Do not commit directly to `main`. Open a pull request for each change.
