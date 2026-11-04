import Mathlib.Algebra.BigOperators.Intervals
import Mathlib.Data.Real.Basic
import Mathlib.Analysis.MeanInequalities

theorem statement2 (n : ℕ) (a b : ℕ → ℝ) :
    (∑ j ∈ Finset.range n, a (j + 1) * b (j + 1)) ^ 2 ≤
      (∑ j ∈ Finset.range n, ((j : ℝ) + 1) * a (j + 1) ^ 2) *
        (∑ j ∈ Finset.range n, b (j + 1) ^ 2 / ((j : ℝ) + 1)) := by
  have hpos : ∀ j : ℕ, (0 : ℝ) < (j : ℝ) + 1 := by
    intro j
    have hj : (0 : ℝ) ≤ (j : ℝ) := Nat.cast_nonneg j
    linarith
  have e1 : (∑ j ∈ Finset.range n, (Real.sqrt ((j : ℝ) + 1) * a (j + 1)) *
        (b (j + 1) / Real.sqrt ((j : ℝ) + 1))) =
      ∑ j ∈ Finset.range n, a (j + 1) * b (j + 1) := by
    apply Finset.sum_congr rfl
    intro j _
    have hs : Real.sqrt ((j : ℝ) + 1) ≠ 0 := (Real.sqrt_pos.mpr (hpos j)).ne'
    calc (Real.sqrt ((j : ℝ) + 1) * a (j + 1)) *
          (b (j + 1) / Real.sqrt ((j : ℝ) + 1))
        = a (j + 1) * b (j + 1) *
            (Real.sqrt ((j : ℝ) + 1) / Real.sqrt ((j : ℝ) + 1)) := by ring
      _ = a (j + 1) * b (j + 1) := by rw [div_self hs, mul_one]
  have e2 : (∑ j ∈ Finset.range n, (Real.sqrt ((j : ℝ) + 1) * a (j + 1)) ^ 2) =
      ∑ j ∈ Finset.range n, ((j : ℝ) + 1) * a (j + 1) ^ 2 := by
    apply Finset.sum_congr rfl
    intro j _
    rw [mul_pow, Real.sq_sqrt (hpos j).le]
  have e3 : (∑ j ∈ Finset.range n, (b (j + 1) / Real.sqrt ((j : ℝ) + 1)) ^ 2) =
      ∑ j ∈ Finset.range n, b (j + 1) ^ 2 / ((j : ℝ) + 1) := by
    apply Finset.sum_congr rfl
    intro j _
    rw [div_pow, Real.sq_sqrt (hpos j).le]
  rw [← e1, ← e2, ← e3]
  exact Finset.sum_mul_sq_le_sq_mul_sq (Finset.range n)
    (fun j => Real.sqrt ((j : ℝ) + 1) * a (j + 1))
    (fun j => b (j + 1) / Real.sqrt ((j : ℝ) + 1))
