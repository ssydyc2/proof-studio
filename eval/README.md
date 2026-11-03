# Eval set

`dataset/` holds 50 exercises from the [ProofNet informal benchmark](https://github.com/zhangir-azerbayev/ProofNet/tree/main/benchmark/benchmark_to_publish/informal). They are contest problems and textbook exercises, not named theorems.

Sources: Putnam, Cambridge Tripos, Ireland–Rosen, Artin, Axler, Dummit–Foote, Herstein, Munkres, Pugh, Rudin, and Stein–Shakarchi. Fields include number theory, algebra, analysis, and topology.

Each folder contains:

- `source.png`, a screenshot of the problem statement only
- `meta.json`, the field, the book, the exercise number, and the ProofNet source file

The screenshot does not include the proof. `dataset/manifest.json` lists every problem.

`render_dataset.py` rebuilds the screenshots from the statements in that file.
