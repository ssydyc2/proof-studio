import Mathlib.Data.Set.Finite.Basic
import Mathlib.Tactic

theorem statement2 :
    ∀ N : ℤ, ∃ n : ℤ, N < n ∧ (∃ a b : ℤ, n = a ^ 2 + b ^ 2) ∧ (∃ c d : ℤ, n + 1 = c ^ 2 + d ^ 2) ∧ (∃ e f : ℤ, n + 2 = e ^ 2 + f ^ 2) := by
  intro N
  set t : ℤ := |N| + 1 with ht_def
  have ht1 : 1 ≤ t := by
    rw [ht_def]
    have h0 : 0 ≤ |N| := abs_nonneg N
    linarith
  have hNt : N < t := by
    rw [ht_def]
    have h0 : N ≤ |N| := le_abs_self N
    linarith
  have ht_le : t ≤ (2 * t) ^ 2 := by
    nlinarith [mul_nonneg (show (0 : ℤ) ≤ t by linarith)
      (show (0 : ℤ) ≤ 4 * t - 1 by linarith)]
  have hle_n : (2 * t) ^ 2 ≤ (2 * t ^ 2) ^ 2 + (2 * t) ^ 2 := by
    have hnon : 0 ≤ (2 * t ^ 2) ^ 2 := by positivity
    linarith
  have hNn : N < (2 * t ^ 2) ^ 2 + (2 * t) ^ 2 :=
    lt_of_lt_of_le hNt (le_trans ht_le hle_n)
  refine ⟨(2 * t ^ 2) ^ 2 + (2 * t) ^ 2, hNn, ⟨2 * t ^ 2, 2 * t, rfl⟩,
    ⟨2 * t ^ 2 + 1, 0, by ring⟩, ⟨2 * t ^ 2 + 1, 1, by ring⟩⟩
