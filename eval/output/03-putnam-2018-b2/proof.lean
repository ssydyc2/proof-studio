import Mathlib.Data.Complex.Basic
import Mathlib.Analysis.Complex.Basic
import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Ring

theorem statement2 (n : ℕ) (hn : 0 < n) :
    ¬ ∃ z : ℂ, ‖z‖ ≤ 1 ∧ (∑ k ∈ Finset.range n, ((n - k : ℕ) : ℂ) * z ^ k) = 0 := by
  rintro ⟨z, hz, hsum⟩
  have hgeom : ∀ m : ℕ, ∀ w : ℂ,
      (1 - w) * (∑ k ∈ Finset.range m, w ^ k) = 1 - w ^ m := by
    intro m
    induction m with
    | zero =>
        intro w
        simp
    | succ m ih =>
        intro w
        rw [Finset.sum_range_succ, mul_add, ih w, pow_succ]
        ring
  have hSsucc : ∀ m : ℕ, ∀ w : ℂ,
      (∑ k ∈ Finset.range (m + 1), ((m + 1 - k : ℕ) : ℂ) * w ^ k) =
        (∑ k ∈ Finset.range m, ((m - k : ℕ) : ℂ) * w ^ k) +
          ∑ k ∈ Finset.range (m + 1), w ^ k := by
    intro m w
    have hterm : ∀ k ∈ Finset.range (m + 1),
        ((m + 1 - k : ℕ) : ℂ) * w ^ k = ((m - k : ℕ) : ℂ) * w ^ k + w ^ k := by
      intro k hk
      have hklt : k < m + 1 := Finset.mem_range.mp hk
      have hcast : ((m + 1 - k : ℕ) : ℂ) = ((m - k : ℕ) : ℂ) + 1 := by
        have hnat : m + 1 - k = (m - k) + 1 := by omega
        rw [hnat, Nat.cast_add, Nat.cast_one]
      rw [hcast]
      ring
    have h1 : (∑ k ∈ Finset.range (m + 1), ((m + 1 - k : ℕ) : ℂ) * w ^ k) =
        ∑ k ∈ Finset.range (m + 1), (((m - k : ℕ) : ℂ) * w ^ k + w ^ k) :=
      Finset.sum_congr rfl hterm
    have hfirst : (∑ k ∈ Finset.range (m + 1), ((m - k : ℕ) : ℂ) * w ^ k) =
        ∑ k ∈ Finset.range m, ((m - k : ℕ) : ℂ) * w ^ k := by
      rw [Finset.sum_range_succ]
      simp
    rw [h1, Finset.sum_add_distrib, hfirst]
  have hident : ∀ m : ℕ, ∀ w : ℂ,
      (1 - w) * (∑ k ∈ Finset.range m, ((m - k : ℕ) : ℂ) * w ^ k) =
        (m : ℂ) - ∑ k ∈ Finset.range m, w ^ (k + 1) := by
    intro m
    induction m with
    | zero =>
        intro w
        simp
    | succ m ih =>
        intro w
        have hlast : (∑ k ∈ Finset.range (m + 1), w ^ (k + 1)) =
            (∑ k ∈ Finset.range m, w ^ (k + 1)) + w ^ (m + 1) :=
          Finset.sum_range_succ _ _
        rw [hSsucc m w, mul_add, ih w, hgeom (m + 1) w, hlast,
          Nat.cast_add, Nat.cast_one]
        ring
  have h_eq : (n : ℂ) = ∑ k ∈ Finset.range n, z ^ (k + 1) := by
    have hid := hident n z
    rw [hsum, mul_zero] at hid
    exact sub_eq_zero.mp hid.symm
  have hre_sum : ∀ (s : Finset ℕ) (f : ℕ → ℂ),
      (∑ k ∈ s, f k).re = ∑ k ∈ s, (f k).re := by
    intro s f
    induction s using Finset.induction with
    | empty => simp
    | insert a s ha ih =>
        rw [Finset.sum_insert ha, Finset.sum_insert ha, Complex.add_re, ih]
  have hreal : (n : ℝ) = ∑ k ∈ Finset.range n, (z ^ (k + 1)).re := by
    have hre_eq := congrArg Complex.re h_eq
    rw [hre_sum] at hre_eq
    simpa using hre_eq
  have hle : ∀ k ∈ Finset.range n, (z ^ (k + 1)).re ≤ 1 := by
    intro k _
    calc (z ^ (k + 1)).re ≤ ‖z ^ (k + 1)‖ := Complex.re_le_norm _
      _ = ‖z‖ ^ (k + 1) := norm_pow z (k + 1)
      _ ≤ (1 : ℝ) ^ (k + 1) := pow_le_pow_left₀ (norm_nonneg z) hz (k + 1)
      _ = 1 := one_pow _
  have hzero : ∑ k ∈ Finset.range n, (1 - (z ^ (k + 1)).re) = 0 := by
    have hcalc : ∑ k ∈ Finset.range n, (1 - (z ^ (k + 1)).re) =
        (n : ℝ) - ∑ k ∈ Finset.range n, (z ^ (k + 1)).re := by
      rw [Finset.sum_sub_distrib, Finset.sum_const, Finset.card_range]
      simp
    rw [hcalc, ← hreal, sub_self]
  have hall : ∀ k ∈ Finset.range n, 1 - (z ^ (k + 1)).re = 0 := by
    have hnonneg : ∀ k ∈ Finset.range n, 0 ≤ 1 - (z ^ (k + 1)).re := by
      intro k hk
      linarith [hle k hk]
    exact (Finset.sum_eq_zero_iff_of_nonneg hnonneg).mp hzero
  have hre : z.re = 1 := by
    have h0 := hall 0 (Finset.mem_range.mpr hn)
    simp only [zero_add, pow_one] at h0
    linarith
  have him : z.im = 0 := by
    have hnorm_le : z.re ^ 2 + z.im ^ 2 ≤ 1 := by
      have hpow : ‖z‖ ^ 2 ≤ (1 : ℝ) ^ 2 :=
        pow_le_pow_left₀ (norm_nonneg z) hz 2
      have hnorm_eq : ‖z‖ ^ 2 = z.re ^ 2 + z.im ^ 2 := by
        rw [← Complex.normSq_eq_norm_sq, Complex.normSq_apply]
        ring
      rw [hnorm_eq] at hpow
      simpa using hpow
    rw [hre] at hnorm_le
    simp only [one_pow] at hnorm_le
    have himsq : z.im ^ 2 = 0 := by
      have hnonneg : 0 ≤ z.im ^ 2 := sq_nonneg z.im
      linarith
    exact (pow_eq_zero_iff (show (2 : ℕ) ≠ 0 by decide)).mp himsq
  have hz1 : z = 1 := by
    apply Complex.ext <;> simp [hre, him]
  rw [hz1] at hsum
  have hpos : 0 < ∑ k ∈ Finset.range n, (n - k) := by
    apply Finset.sum_pos'
    · intro i _
      exact Nat.zero_le (n - i)
    · exact ⟨0, Finset.mem_range.mpr hn, by simpa using hn⟩
  have hcast : (∑ k ∈ Finset.range n, ((n - k : ℕ) : ℂ) * (1 : ℂ) ^ k) =
      ((∑ k ∈ Finset.range n, (n - k) : ℕ) : ℂ) := by
    simp
  rw [hcast] at hsum
  exact (Nat.cast_ne_zero.mpr (ne_of_gt hpos)) hsum
