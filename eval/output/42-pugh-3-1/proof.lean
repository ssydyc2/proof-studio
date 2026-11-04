import Mathlib.Data.Real.Basic
import Mathlib.Data.Real.Archimedean
import Mathlib.Algebra.Order.Archimedean.Basic
import Mathlib.Algebra.Order.Field.Basic
import Mathlib.Tactic.Common

theorem statement2 (f : ℝ → ℝ) (h : ∀ t x : ℝ, |f t - f x| ≤ |t - x| ^ 2) :
    ∀ a b : ℝ, f a = f b := by
  have key : ∀ (n : ℕ) (a b : ℝ), (2 : ℝ) ^ n * |f a - f b| ≤ |b - a| ^ 2 := by
    intro n
    induction n with
    | zero =>
        intro a b
        simp only [pow_zero, one_mul]
        have hab := h a b
        rwa [abs_sub_comm a b] at hab
    | succ n ih =>
        intro a b
        have htri : |f a - f b| ≤
            |f a - f ((a + b) / 2)| + |f ((a + b) / 2) - f b| := by
          have heq : f a - f b =
              (f a - f ((a + b) / 2)) + (f ((a + b) / 2) - f b) := by ring
          rw [heq]
          exact abs_add_le _ _
        have h1 := ih a ((a + b) / 2)
        have h2 := ih ((a + b) / 2) b
        have hbound : (2 : ℝ) ^ (n + 1) * |f a - f b| ≤
            2 * |((a + b) / 2) - a| ^ 2 + 2 * |b - ((a + b) / 2)| ^ 2 := by
          have step1 : (2 : ℝ) ^ (n + 1) * |f a - f b| ≤
              (2 : ℝ) ^ (n + 1) *
                (|f a - f ((a + b) / 2)| + |f ((a + b) / 2) - f b|) :=
            mul_le_mul_of_nonneg_left htri (pow_nonneg (by norm_num) (n + 1))
          have step2 : (2 : ℝ) ^ (n + 1) *
                (|f a - f ((a + b) / 2)| + |f ((a + b) / 2) - f b|) =
              2 * ((2 : ℝ) ^ n * |f a - f ((a + b) / 2)|) +
                2 * ((2 : ℝ) ^ n * |f ((a + b) / 2) - f b|) := by
            rw [pow_succ]
            ring
          have step3 : 2 * ((2 : ℝ) ^ n * |f a - f ((a + b) / 2)|) +
                2 * ((2 : ℝ) ^ n * |f ((a + b) / 2) - f b|) ≤
              2 * |((a + b) / 2) - a| ^ 2 + 2 * |b - ((a + b) / 2)| ^ 2 :=
            add_le_add (mul_le_mul_of_nonneg_left h1 (by norm_num))
              (mul_le_mul_of_nonneg_left h2 (by norm_num))
          rw [step2] at step1
          exact le_trans step1 step3
        have heq : 2 * |((a + b) / 2) - a| ^ 2 + 2 * |b - ((a + b) / 2)| ^ 2 =
            |b - a| ^ 2 := by
          have hm1 : ((a + b) / 2) - a = (b - a) / 2 := by ring
          have hm2 : b - ((a + b) / 2) = (b - a) / 2 := by ring
          rw [hm1, hm2]
          have habs : |(b - a) / 2| = |b - a| / 2 := by
            rw [abs_div, abs_of_pos (show (0 : ℝ) < 2 by norm_num)]
          rw [habs]
          ring
        rw [heq] at hbound
        exact hbound
  intro a b
  have h_eq : |f a - f b| = 0 := by
    refine le_antisymm ?_ (abs_nonneg _)
    by_contra hnot
    have hpos : (0 : ℝ) < |f a - f b| := not_le.mp hnot
    obtain ⟨n, hn⟩ := pow_unbounded_of_one_lt (|b - a| ^ 2 / |f a - f b|)
      (show (1 : ℝ) < 2 by norm_num)
    have hn2 : |b - a| ^ 2 < (2 : ℝ) ^ n * |f a - f b| := (div_lt_iff₀ hpos).mp hn
    have hle := key n a b
    exact (not_lt_of_ge hle) hn2
  have hzero : f a - f b = 0 := abs_eq_zero.mp h_eq
  exact sub_eq_zero.mp hzero
