import Mathlib.Data.Int.Basic
import Mathlib.Tactic.Ring

theorem statement2 : ∀ x y : ℤ, 3 * x ^ 2 + 2 ≠ y ^ 2 := by
  intro x y h
  have hmod : y % 3 = 0 ∨ y % 3 = 1 ∨ y % 3 = 2 := by omega
  have hy : y ^ 2 = y * y := by ring
  have hcalc : y ^ 2 % 3 = (y % 3) * (y % 3) % 3 := by
    rw [hy]
    exact Int.mul_emod y y 3
  have hsq : y ^ 2 % 3 = 0 ∨ y ^ 2 % 3 = 1 := by
    rcases hmod with hr | hr | hr
    · left
      rw [hcalc, hr]
      decide
    · right
      rw [hcalc, hr]
      decide
    · right
      rw [hcalc, hr]
      decide
  have heq : y ^ 2 % 3 = 2 := by
    rw [← h]
    omega
  rcases hsq with h0 | h1
  · omega
  · omega
