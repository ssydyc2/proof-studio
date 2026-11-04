import Mathlib.NumberTheory.Zsqrtd.GaussianInt

theorem statement2 (I : Ideal GaussianInt) (hI : I ≠ ⊥) :
    ∃ n : ℕ, 0 < n ∧ (n : GaussianInt) ∈ I := by
  obtain ⟨⟨a, b⟩, hxI, hx0⟩ : ∃ x ∈ I, x ≠ 0 := by
    by_contra h
    apply hI
    ext y
    simp only [Ideal.mem_bot]
    constructor
    · intro hy
      by_contra hy0
      exact h ⟨y, hy, hy0⟩
    · intro hy
      rw [hy]
      exact I.zero_mem
  have hab : a ≠ 0 ∨ b ≠ 0 := by
    by_contra h
    have ha : a = 0 := by
      simpa using (not_or.mp h).1
    have hb : b = 0 := by
      simpa using (not_or.mp h).2
    apply hx0
    ext <;> simp [ha, hb]
  have hpos : (0 : ℤ) < a ^ 2 + b ^ 2 := by
    rcases hab with ha | hb
    · have ha2 : (0 : ℤ) < a ^ 2 := sq_pos_of_ne_zero ha
      have hb2 : (0 : ℤ) ≤ b ^ 2 := sq_nonneg b
      linarith
    · have ha2 : (0 : ℤ) ≤ a ^ 2 := sq_nonneg a
      have hb2 : (0 : ℤ) < b ^ 2 := sq_pos_of_ne_zero hb
      linarith
  have hcast : (((a ^ 2 + b ^ 2).natAbs : ℤ)) = a ^ 2 + b ^ 2 :=
    Int.natAbs_of_nonneg (le_of_lt hpos)
  refine ⟨(a ^ 2 + b ^ 2).natAbs, Int.natAbs_pos.mpr (ne_of_gt hpos), ?_⟩
  have h_eq : (((a ^ 2 + b ^ 2).natAbs : GaussianInt)) =
      (⟨a, b⟩ : GaussianInt) * ⟨a, -b⟩ := by
    apply Zsqrtd.ext
    · show (((a ^ 2 + b ^ 2).natAbs : ℤ)) =
        a * a + (-1 : ℤ) * b * (-b)
      rw [hcast]
      ring
    · show (0 : ℤ) = a * (-b) + b * a
      ring
  rw [h_eq]
  exact I.mul_mem_right _ hxI
