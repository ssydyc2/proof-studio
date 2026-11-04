import Mathlib.Algebra.Polynomial.Derivative
import Mathlib.Algebra.Polynomial.Roots
import Mathlib.Algebra.Polynomial.Splits
import Mathlib.Analysis.Complex.Polynomial.Basic
import Mathlib.Data.Complex.Basic
import Mathlib.Data.Finset.Card
import Mathlib.FieldTheory.IsAlgClosed.Basic

theorem statement2 (p : Polynomial ℂ) (m : ℕ) (hp_ne : p ≠ 0)
    (hp_deg : p.natDegree = m)
    (h_no_common : ∀ z : ℂ, ¬ (p.IsRoot z ∧ (Polynomial.derivative p).IsRoot z)) :
    ∃ S : Finset ℂ, S.card = m ∧ ∀ z ∈ S, p.IsRoot z := by
  have hsplits : Polynomial.Splits p := IsAlgClosed.splits p
  have hnodup : Multiset.Nodup p.roots := by
    rw [Multiset.nodup_iff_count_le_one]
    intro a
    by_contra h_not_le
    push_neg at h_not_le
    have hcount : Multiset.count a p.roots = p.rootMultiplicity a := by
      first
        | exact Polynomial.count_roots a hp_ne
        | exact Polynomial.count_roots a hsplits
        | exact Polynomial.count_roots hp_ne a
        | exact Polynomial.count_roots hsplits a
        | exact Polynomial.count_roots hp_ne
        | exact Polynomial.count_roots hsplits
        | exact Polynomial.count_roots p a hp_ne
        | exact Polynomial.count_roots p hp_ne a
        | exact Polynomial.count_roots p a hsplits
        | exact Polynomial.count_roots p hsplits a
        | exact Polynomial.Splits.count_roots hsplits a
        | exact Polynomial.Splits.count_roots a hsplits
        | exact hsplits.count_roots a
        | apply Polynomial.count_roots <;> assumption
        | apply Polynomial.Splits.count_roots <;> assumption
        | simp only [Polynomial.count_roots hp_ne]
        | simp only [Polynomial.count_roots hsplits]
        | simp only [Polynomial.count_roots]
    have h_two : 2 ≤ p.rootMultiplicity a := by omega
    have hdvd : (Polynomial.X - Polynomial.C a) ^ 2 ∣ p :=
      dvd_trans (pow_dvd_pow _ h_two) (Polynomial.pow_rootMultiplicity_dvd p a)
    obtain ⟨q, hq⟩ := hdvd
    have ha_mem : a ∈ p.roots := Multiset.count_pos.mp (by omega)
    have ha_root : p.IsRoot a := (Polynomial.mem_roots hp_ne).mp ha_mem
    have ha_deriv : (Polynomial.derivative p).IsRoot a := by
      have hev : (Polynomial.derivative p).eval a = 0 := by
        rw [hq]
        simp [Polynomial.derivative_mul, Polynomial.derivative_pow]
      exact hev
    exact h_no_common a ⟨ha_root, ha_deriv⟩
  have hcard_roots : Multiset.card p.roots = p.natDegree := by
    have h := hsplits.natDegree_eq_card_roots
    simpa using h.symm
  refine ⟨p.roots.toFinset, ?_, ?_⟩
  · rw [Multiset.toFinset_card_of_nodup hnodup, hcard_roots, hp_deg]
  · intro z hz
    have hz_roots : z ∈ p.roots := Multiset.mem_toFinset.mp hz
    exact (Polynomial.mem_roots hp_ne).mp hz_roots
