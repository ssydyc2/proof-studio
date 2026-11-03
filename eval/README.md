# Eval

Everything for evaluation lives in this folder.

- `dataset/` holds 50 exercises from the [ProofNet informal benchmark](https://github.com/zhangir-azerbayev/ProofNet/tree/main/benchmark/benchmark_to_publish/informal). Each problem folder has `source.png` and `meta.json`. `render_dataset.py` rebuilds the screenshots.
- `meta_key` is the Meta API key used for transcription. `glm_key` is the GLM API key used for comparison. Neither is committed.
- One script per step, run from the repo root. A folder name limits the run to one problem.
- Screenshot transcription stays in the app, because generating TeX uses it. `glm.ts` calls GLM for the comparison only.
- `results/` holds each step's output and is not committed. Generated `problem.tex` and `problem.pdf` stay in the problem folder and are not committed. Generated Lean files go in `lean/` and are not committed.

## Transcribe

`npm run eval:transcribe` turns every `source.png` into `problem.tex` and `problem.pdf`, using the app's transcription and compile path. The outcome is `results/transcribe.json`.

```
npm run eval:transcribe -- 01-putnam-2020-b5
```

## Compare

`npm run eval:compare` asks GLM (`glm-5.3-flash`) whether `source.png` and `problem.pdf` state the same problem. It reads `eval/glm_key`. The outcome is `results/compare.json`.

```
npm run eval:compare -- 01-putnam-2020-b5
```

## Formalize

`npm run eval:formalize` writes two Lean statements with the app's formalize path. Each problem gets `lean/<folder>/stub.lean`. A file that does not contain two compiled statements is a failure. GLM then checks the two statements against `source.png`. The outcome is `results/formalize.json`.

```
npm run eval:formalize -- 01-putnam-2020-b5
```

## Results

### Transcribe

All 50 screenshots compiled to `problem.pdf`.

### Compare

GLM 5.3 Flash judged 49 of 50 as the same problem. It marked 31 (Herstein 2.2.5) inconsistent, reading \((ab)^5 = a^5 b^5\) as \((ab)^6 = a^5 b^5\). The screenshot and `problem.tex` both have exponent 5, so that mark is a false positive.

### Formalize

35 of 50 produced two compiled statements that GLM judged correct.

- Could not produce two statements (10): 02, 10, 22, 24, 28, 29, 32, 34, 46, 50.
- Did not compile (4): 05, 17, 25, 44.
- Did not match the problem (1): 08. The second statement adds the condition that the radicand is positive.
