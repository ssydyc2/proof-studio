import Mathlib.Analysis.PSeries
import Mathlib.Analysis.SpecialFunctions.Sqrt
import Mathlib.Topology.Algebra.InfiniteSum.Basic
import Mathlib.Topology.Algebra.InfiniteSum.Order

theorem statement1 {a : ℕ → ℝ} (ha_nonneg : ∀ n, 0 ≤ a n) (ha_summable : Summable a) :
    Summable fun n : ℕ => Real.sqrt (a n) / (n : ℝ) := by
  have h_sq : Summable fun n : ℕ => (1 : ℝ) / (n : ℝ) ^ 2 := by
    first
      | exact summable_one_div_nat_pow.mpr (by norm_num)
      | exact Real.summable_one_div_nat_pow.mpr (by norm_num)
      | simpa using Real.summable_one_div_nat_rpow.mpr (show (1 : ℝ) < 2 by norm_num)
  have hf : Summable fun n : ℕ => (a n + 1 / (n : ℝ) ^ 2) / 2 := by
    first
      | exact (ha_summable.add h_sq).div_const 2
      | exact summable_div_const.mpr (ha_summable.add h_sq)
  have hnonneg : ∀ n : ℕ, 0 ≤ Real.sqrt (a n) / (n : ℝ) := by
    intro n
    apply div_nonneg
    · exact Real.sqrt_nonneg _
    · positivity
  have hbound : ∀ n : ℕ, Real.sqrt (a n) / (n : ℝ) ≤ (a n + 1 / (n : ℝ) ^ 2) / 2 := by
    intro n
    have hs : (Real.sqrt (a n)) ^ 2 = a n := Real.sq_sqrt (ha_nonneg n)
    have ht : (1 / (n : ℝ)) ^ 2 = 1 / (n : ℝ) ^ 2 := by
      rw [div_pow, one_pow]
    have h_expand : (Real.sqrt (a n) - 1 / (n : ℝ)) ^ 2 =
        a n + 1 / (n : ℝ) ^ 2 - 2 * Real.sqrt (a n) * (1 / (n : ℝ)) := by
      calc (Real.sqrt (a n) - 1 / (n : ℝ)) ^ 2 =
            (Real.sqrt (a n)) ^ 2 + (1 / (n : ℝ)) ^ 2 -
              2 * Real.sqrt (a n) * (1 / (n : ℝ)) := by ring
        _ = a n + 1 / (n : ℝ) ^ 2 - 2 * Real.sqrt (a n) * (1 / (n : ℝ)) := by
              rw [hs, ht]
    have h0 : 0 ≤ (Real.sqrt (a n) - 1 / (n : ℝ)) ^ 2 := sq_nonneg _
    have h2 : 2 * Real.sqrt (a n) * (1 / (n : ℝ)) ≤ a n + 1 / (n : ℝ) ^ 2 := by
      linarith
    rw [div_eq_mul_one_div]
    linarith
  first
    | exact Summable.of_nonneg_of_le hnonneg hbound hf
    | exact summable_of_nonneg_of_le hnonneg hbound hf
    | exact hf.of_nonneg_of_le hnonneg hbound
