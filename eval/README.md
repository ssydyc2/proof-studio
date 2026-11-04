# Eval

Everything for evaluation lives in this folder.

- `dataset/` holds 50 exercises from the [ProofNet informal benchmark](https://github.com/zhangir-azerbayev/ProofNet/tree/main/benchmark/benchmark_to_publish/informal). Each problem folder has `source.png` and `meta.json`. `render_dataset.py` rebuilds the screenshots.
- `meta_key` is the Meta API key used for transcription. `glm_key` is the GLM API key used for comparison. Neither is committed.
- One script per step, run from the repo root. A folder name limits the run to one problem.
- Screenshot transcription stays in the app, because generating TeX uses it. `glm.ts` calls GLM for the comparison only.
- `results/` holds each step's output and is not committed. Generated `problem.tex` and `problem.pdf` stay in the problem folder and are not committed. Generated Lean statements go in `lean/` and generated proofs go in `proofs/`. Neither is committed.

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

`npm run eval:formalize` writes two Lean statements with the app's formalize path. Each problem gets `lean/<folder>/stub.lean`. GLM checks a file that contains two statements against `source.png`. The outcome is `results/formalize.json`. A single compiled statement is still a usable formalization. The two attempts are shared, so both can be spent producing the first statement, and a second wording is not always available.

```
npm run eval:formalize -- 01-putnam-2020-b5
```

## Prove

`npm run eval:prove` proves the 45 problems that formalized. It skips 05, 08, 17, 25, and 44. Each statement gets 4 attempts, using the app's prove path, and five problems run at once. Each Muse request may run for 15 minutes. A timeout fails that problem. A reply that does not compile uses another attempt. A proof is written to `proofs/<folder>/proof.lean` when Lean accepts it. The outcome is `results/prove.json`.

```
npm run eval:prove -- 13-ireland-rosen-3-4
```

## Results

### Transcribe

All 50 screenshots compiled to `problem.pdf`.

### Compare

GLM 5.3 Flash judged 49 of 50 as the same problem. It marked 31 (Herstein 2.2.5) inconsistent, reading \((ab)^5 = a^5 b^5\) as \((ab)^6 = a^5 b^5\). The screenshot and `problem.tex` both have exponent 5, so that mark is a false positive.

### Formalize

45 of 50 produced a compiled statement. The 10 that stopped at one statement are counted here: 02, 10, 22, 24, 28, 29, 32, 34, 46, 50. The two attempts are shared, so a failed first try spends the second attempt on that same statement. A second wording is also not always available.

4 did not compile: 05, 17, 25, 44.

08 compiled two statements. GLM marked the second one different because it requires the expression under the square root to be positive. That call is debatable.

### Prove

Stopped early. 27 of 45 produced a compiled proof. The run skips 05, 08, 17, 25, and 44. Each Muse request may run for 15 minutes. A timeout fails that problem.

3 used all 4 attempts and Lean still rejected the proof: 22, 24, 26. 22 failed because a Mathlib object file was missing.

15 were timed out: 02, 04, 06, 27, 28, 30, 33, 34, 36, 37, 41, 47, 48, 49, 50. `npm run eval:prove` resumes from `results/prove.json` and skips finished problems.
