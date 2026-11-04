import Mathlib.Data.Int.Basic
import Mathlib.Data.ZMod.Basic

theorem statement2 : ∀ x y : ℤ, 7 * x ^ 3 + 2 ≠ y ^ 3 := by
  intro x y h
  have key : ∀ z : ZMod 7, z ^ 3 ≠ 2 := by decide
  have h2 : ((y ^ 3 : ℤ) : ZMod 7) = 2 := by
    rw [← h]
    simp only [Int.cast_add, Int.cast_mul, Int.cast_pow, Int.cast_ofNat]
    have h7 : (7 : ZMod 7) = 0 := by decide
    rw [h7, zero_mul, zero_add]
  simp only [Int.cast_pow] at h2
  exact key _ h2
