# Eval

Everything for evaluation lives in this folder.

- `dataset/` holds 50 exercises from the [ProofNet informal benchmark](https://github.com/zhangir-azerbayev/ProofNet/tree/main/benchmark/benchmark_to_publish/informal). Each problem folder has `source.png` and `meta.json`. `render_dataset.py` rebuilds the screenshots.
- `meta_key` is the Meta API key. It is not committed.
- One script per step, run from the repo root. A folder name limits the run to one problem.
- `results/` holds each step's output and is not committed. Generated `problem.tex` and `problem.pdf` stay in the problem folder and are not committed.

## Transcribe

`npm run eval:transcribe` turns every `source.png` into `problem.tex` and `problem.pdf`, using the app's transcription and compile path. The outcome is `results/transcribe.json`.

```
npm run eval:transcribe -- 01-putnam-2020-b5
```

## Compare

`npm run eval:compare` asks the same model whether `source.png` and `problem.pdf` state the same problem. The outcome is `results/compare.json`.

```
npm run eval:compare -- 01-putnam-2020-b5
```

All 50 screenshots transcribed and compiled. The comparison judged 49 of 50 as the same problem. It marked Ireland–Rosen 1.30 inconsistent, reading the final denominator as \(\pi\) instead of \(n\). The screenshot and `problem.tex` both say \(\frac{1}{2}+\frac{1}{3}+\cdots+\frac{1}{n}\), so that mark is a false positive.
