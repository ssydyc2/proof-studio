# Eval set

`dataset/` holds 50 exercises from the [ProofNet informal benchmark](https://github.com/zhangir-azerbayev/ProofNet/tree/main/benchmark/benchmark_to_publish/informal). They are contest problems and textbook exercises, not named theorems.

Sources: Putnam, Cambridge Tripos, Ireland–Rosen, Artin, Axler, Dummit–Foote, Herstein, Munkres, Pugh, Rudin, and Stein–Shakarchi. Fields include number theory, algebra, analysis, and topology.

Each folder contains:

- `source.png`, a screenshot of the problem statement only
- `meta.json`, the field, the book, the exercise number, and the ProofNet source file

The screenshot does not include the proof. `dataset/manifest.json` lists every problem.

`render_dataset.py` rebuilds the screenshots from the statements in that file.

## Transcribe

`npm run eval:transcribe` reads the API key from `eval/meta_key` and runs the app's screenshot transcription on every `source.png`. It writes `problem.tex` and `problem.pdf` in that problem's folder, and records the outcome in `eval/transcribe-results.json`. Pass a folder name to run one problem, for example `npm run eval:transcribe -- 01-putnam-2020-b5`.

`npm run eval:compare` asks the same model whether `source.png` and `problem.pdf` state the same problem. It writes `eval/compare-results.json`. A folder name limits the run the same way.

All 50 screenshots transcribed to TeX and compiled to PDF. The comparison judged 49 of 50 as the same problem. It marked Ireland–Rosen 1.30 inconsistent, reading the final denominator as \(\pi\) instead of \(n\). The screenshot and `problem.tex` both say \(\frac{1}{2}+\frac{1}{3}+\cdots+\frac{1}{n}\), so that mark is a false positive.
