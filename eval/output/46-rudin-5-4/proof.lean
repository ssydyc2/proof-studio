import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Data.Real.Basic
import Mathlib.Analysis.Calculus.MeanValue
import Mathlib.Analysis.Calculus.Deriv.MeanValue
import Mathlib.Analysis.Calculus.Deriv.Add
import Mathlib.Analysis.Calculus.Deriv.Mul
import Mathlib.Analysis.Calculus.Deriv.Pow

theorem statement1 (n : ℕ) (C : ℕ → ℝ)
    (h : (∑ k ∈ Finset.range (n + 1), C k / ((k : ℝ) + 1)) = 0) :
    ∃ x : ℝ, 0 < x ∧ x < 1 ∧
      (∑ k ∈ Finset.range (n + 1), C k * x ^ k) = 0 := by
  have hterm : ∀ k : ℕ, ∀ x : ℝ,
      HasDerivAt (fun y : ℝ => C k * y ^ (k + 1) / ((k : ℝ) + 1))
        (C k * x ^ k) x := by
    intro k x
    have hk : ((k : ℝ) + 1) ≠ 0 :=
      ne_of_gt (add_pos_of_nonneg_of_pos (Nat.cast_nonneg k) zero_lt_one)
    have hpow : HasDerivAt (fun y : ℝ => y ^ (k + 1))
        (((k : ℝ) + 1) * x ^ k) x := by
      have hpow' := hasDerivAt_pow (k + 1) x
      simpa using hpow'
    have hmul := (hpow.const_mul (C k)).div_const ((k : ℝ) + 1)
    have heq : C k * (((k : ℝ) + 1) * x ^ k) / ((k : ℝ) + 1)
        = C k * x ^ k := by
      rw [div_eq_iff hk]
      ring
    rwa [heq] at hmul
  have hderiv_aux : ∀ s : Finset ℕ, ∀ x : ℝ,
      HasDerivAt
        (fun y : ℝ => ∑ k ∈ s, C k * y ^ (k + 1) / ((k : ℝ) + 1))
        (∑ k ∈ s, C k * x ^ k) x := by
    intro s
    refine Finset.induction_on s ?_ ?_
    · intro x
      simpa using hasDerivAt_const x (0 : ℝ)
    · intro a s ha ih x
      have hadd := (hterm a x).add (ih x)
      have hfun : (fun y : ℝ => ∑ k ∈ insert a s,
            C k * y ^ (k + 1) / ((k : ℝ) + 1))
          = (fun y : ℝ => C a * y ^ (a + 1) / ((a : ℝ) + 1))
            + (fun y : ℝ => ∑ k ∈ s, C k * y ^ (k + 1) / ((k : ℝ) + 1)) := by
        funext y
        simp only [Pi.add_apply]
        exact Finset.sum_insert ha
      have hval : (∑ k ∈ insert a s, C k * x ^ k)
          = C a * x ^ a + ∑ k ∈ s, C k * x ^ k :=
        Finset.sum_insert ha
      rw [hfun, hval]
      exact hadd
  have hderiv : ∀ x : ℝ,
      HasDerivAt
        (fun y : ℝ => ∑ k ∈ Finset.range (n + 1),
          C k * y ^ (k + 1) / ((k : ℝ) + 1))
        (∑ k ∈ Finset.range (n + 1), C k * x ^ k) x :=
    fun x => hderiv_aux (Finset.range (n + 1)) x
  have hcont : ContinuousOn
      (fun y : ℝ => ∑ k ∈ Finset.range (n + 1),
        C k * y ^ (k + 1) / ((k : ℝ) + 1))
      (Set.Icc (0 : ℝ) 1) := by
    intro x _
    exact (hderiv x).continuousAt.continuousWithinAt
  have hF0 : (fun y : ℝ => ∑ k ∈ Finset.range (n + 1),
      C k * y ^ (k + 1) / ((k : ℝ) + 1)) 0 = 0 := by
    show (∑ k ∈ Finset.range (n + 1),
      C k * (0 : ℝ) ^ (k + 1) / ((k : ℝ) + 1)) = 0
    apply Finset.sum_eq_zero
    intro k _
    have hz : (0 : ℝ) ^ (k + 1) = 0 := zero_pow (by omega)
    simp [hz]
  have hF1 : (fun y : ℝ => ∑ k ∈ Finset.range (n + 1),
      C k * y ^ (k + 1) / ((k : ℝ) + 1)) 1 = 0 := by
    have hsum : (∑ k ∈ Finset.range (n + 1),
        C k * (1 : ℝ) ^ (k + 1) / ((k : ℝ) + 1))
        = ∑ k ∈ Finset.range (n + 1), C k / ((k : ℝ) + 1) := by
      apply Finset.sum_congr rfl
      intro k _
      simp
    show (∑ k ∈ Finset.range (n + 1),
      C k * (1 : ℝ) ^ (k + 1) / ((k : ℝ) + 1)) = 0
    rw [hsum]
    exact h
  obtain ⟨c, hc, hc_eq⟩ := exists_hasDerivAt_eq_zero
    (show (0 : ℝ) < 1 from zero_lt_one) hcont (hF0.trans hF1.symm)
    (fun x _ => hderiv x)
  have hc01 : 0 < c ∧ c < 1 := Set.mem_Ioo.mp hc
  exact ⟨c, hc01.1, hc01.2, hc_eq⟩
