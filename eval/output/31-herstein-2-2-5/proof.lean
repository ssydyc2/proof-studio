import Mathlib.Algebra.Group.Basic

theorem statement2 (G : Type*) [Group G]
    (h3 : ∀ a b : G, (a * b) ^ 3 = a ^ 3 * b ^ 3)
    (h5 : ∀ a b : G, (a * b) ^ 5 = a ^ 5 * b ^ 5) :
    ∀ a b : G, Commute a b := by
  intro a b
  have e2 : ∀ z : G, z ^ 2 = z * z := by
    intro z
    show z ^ (1 + 1) = z * z
    rw [pow_succ, pow_one]
  have e3 : ∀ z : G, z ^ 3 = z * z * z := by
    intro z
    show z ^ (2 + 1) = z * z * z
    rw [pow_succ, e2]
  have e4 : ∀ z : G, z ^ 4 = z * z * z * z := by
    intro z
    show z ^ (3 + 1) = z * z * z * z
    rw [pow_succ, e3]
  have e5 : ∀ z : G, z ^ 5 = z * z * z * z * z := by
    intro z
    show z ^ (4 + 1) = z * z * z * z * z
    rw [pow_succ, e4]
  have sq_eq : ∀ x y : G, (y * x) ^ 2 = x ^ 2 * y ^ 2 := by
    intro x y
    have h : x * (y * x) ^ 2 * y = x * (x ^ 2 * y ^ 2) * y := by
      calc x * (y * x) ^ 2 * y = (x * y) ^ 3 := by simp only [e2, e3, mul_assoc]
        _ = x ^ 3 * y ^ 3 := h3 x y
        _ = x * (x ^ 2 * y ^ 2) * y := by simp only [e2, e3, mul_assoc]
    exact mul_left_cancel (mul_right_cancel h)
  have four_eq : ∀ x y : G, (y * x) ^ 4 = x ^ 4 * y ^ 4 := by
    intro x y
    have h : x * (y * x) ^ 4 * y = x * (x ^ 4 * y ^ 4) * y := by
      calc x * (y * x) ^ 4 * y = (x * y) ^ 5 := by simp only [e4, e5, mul_assoc]
        _ = x ^ 5 * y ^ 5 := h5 x y
        _ = x * (x ^ 4 * y ^ 4) * y := by simp only [e4, e5, mul_assoc]
    exact mul_left_cancel (mul_right_cancel h)
  have h4 : (a ^ 2 * b ^ 2) ^ 2 = a ^ 4 * b ^ 4 := by
    calc (a ^ 2 * b ^ 2) ^ 2 = ((b * a) ^ 2) ^ 2 := by rw [← sq_eq a b]
      _ = (b * a) ^ 4 := by simp only [e2, e4, mul_assoc]
      _ = a ^ 4 * b ^ 4 := four_eq a b
  have sq_comm : b ^ 2 * a ^ 2 = a ^ 2 * b ^ 2 := by
    have h : a ^ 2 * (b ^ 2 * a ^ 2) * b ^ 2 = a ^ 2 * (a ^ 2 * b ^ 2) * b ^ 2 := by
      calc a ^ 2 * (b ^ 2 * a ^ 2) * b ^ 2 = (a ^ 2 * b ^ 2) ^ 2 := by
            simp only [e2, mul_assoc]
        _ = a ^ 4 * b ^ 4 := h4
        _ = a ^ 2 * (a ^ 2 * b ^ 2) * b ^ 2 := by simp only [e2, e4, mul_assoc]
    exact mul_left_cancel (mul_right_cancel h)
  have hab : (a * b) ^ 2 = a ^ 2 * b ^ 2 := by
    calc (a * b) ^ 2 = b ^ 2 * a ^ 2 := sq_eq b a
      _ = a ^ 2 * b ^ 2 := sq_comm
  have hfinal : a * (b * a) * b = a * (a * b) * b := by
    calc a * (b * a) * b = (a * b) ^ 2 := by simp only [e2, mul_assoc]
      _ = a ^ 2 * b ^ 2 := hab
      _ = a * (a * b) * b := by simp only [e2, mul_assoc]
  have hba : b * a = a * b := mul_left_cancel (mul_right_cancel hfinal)
  show a * b = b * a
  exact hba.symm
