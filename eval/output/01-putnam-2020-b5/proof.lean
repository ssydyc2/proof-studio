import Mathlib.Analysis.Complex.Basic

theorem statement1 (z1 z2 z3 z4 : ℂ)
    (h1 : ‖z1‖ = 1) (h2 : ‖z2‖ = 1) (h3 : ‖z3‖ = 1) (h4 : ‖z4‖ = 1)
    (hne1 : z1 ≠ 1) (hne2 : z2 ≠ 1) (hne3 : z3 ≠ 1) (hne4 : z4 ≠ 1) :
    3 - z1 - z2 - z3 - z4 + z1 * z2 * z3 * z4 ≠ 0 := by
  intro hE
  have hre : ∀ z : ℂ, ‖z‖ = 1 → z ≠ 1 → ((1 - z)⁻¹).re = 1 / 2 := by
    intro z hz hzne
    have hz10 : (1 : ℂ) - z ≠ 0 := sub_ne_zero.mpr (Ne.symm hzne)
    have hnormSq : Complex.normSq z = 1 := by
      rw [Complex.normSq_eq_norm_sq, hz, one_pow]
    have hzexp : z.re * z.re + z.im * z.im = 1 := by
      have h := hnormSq
      rw [Complex.normSq_apply] at h
      linear_combination h
    have hnormSq1z : Complex.normSq (1 - z) = 2 - 2 * z.re := by
      rw [Complex.normSq_apply]
      simp only [Complex.sub_re, Complex.one_re, Complex.sub_im, Complex.one_im]
      linear_combination hzexp
    have hdenne : (2 : ℝ) - 2 * z.re ≠ 0 := by
      rw [← hnormSq1z, ne_eq, Complex.normSq_eq_zero]
      exact hz10
    rw [Complex.inv_re, Complex.sub_re, Complex.one_re, hnormSq1z,
      div_eq_iff hdenne]
    ring
  have ha1 : (1 : ℂ) - z1 ≠ 0 := sub_ne_zero.mpr (Ne.symm hne1)
  have ha2 : (1 : ℂ) - z2 ≠ 0 := sub_ne_zero.mpr (Ne.symm hne2)
  have ha3 : (1 : ℂ) - z3 ≠ 0 := sub_ne_zero.mpr (Ne.symm hne3)
  have ha4 : (1 : ℂ) - z4 ≠ 0 := sub_ne_zero.mpr (Ne.symm hne4)
  have hid : (3 - z1 - z2 - z3 - z4 + z1 * z2 * z3 * z4) =
      ((1 - z1) * (1 - z2) * (1 - z3) * (1 - z4)) *
        (1 - (1 - z1)⁻¹ - (1 - z2)⁻¹ - (1 - z3)⁻¹ - (1 - z4)⁻¹
          + (1 - z1)⁻¹ * (1 - z2)⁻¹ + (1 - z1)⁻¹ * (1 - z3)⁻¹
          + (1 - z1)⁻¹ * (1 - z4)⁻¹ + (1 - z2)⁻¹ * (1 - z3)⁻¹
          + (1 - z2)⁻¹ * (1 - z4)⁻¹ + (1 - z3)⁻¹ * (1 - z4)⁻¹) := by
    field_simp
    ring
  have hprod_ne : (1 - z1) * (1 - z2) * (1 - z3) * (1 - z4) ≠ 0 :=
    mul_ne_zero (mul_ne_zero (mul_ne_zero ha1 ha2) ha3) ha4
  have hF : (1 - (1 - z1)⁻¹ - (1 - z2)⁻¹ - (1 - z3)⁻¹ - (1 - z4)⁻¹
      + (1 - z1)⁻¹ * (1 - z2)⁻¹ + (1 - z1)⁻¹ * (1 - z3)⁻¹
      + (1 - z1)⁻¹ * (1 - z4)⁻¹ + (1 - z2)⁻¹ * (1 - z3)⁻¹
      + (1 - z2)⁻¹ * (1 - z4)⁻¹ + (1 - z3)⁻¹ * (1 - z4)⁻¹) = 0 := by
    have hzero : ((1 - z1) * (1 - z2) * (1 - z3) * (1 - z4)) *
        (1 - (1 - z1)⁻¹ - (1 - z2)⁻¹ - (1 - z3)⁻¹ - (1 - z4)⁻¹
          + (1 - z1)⁻¹ * (1 - z2)⁻¹ + (1 - z1)⁻¹ * (1 - z3)⁻¹
          + (1 - z1)⁻¹ * (1 - z4)⁻¹ + (1 - z2)⁻¹ * (1 - z3)⁻¹
          + (1 - z2)⁻¹ * (1 - z4)⁻¹ + (1 - z3)⁻¹ * (1 - z4)⁻¹) = 0 := by
      rw [← hid]
      exact hE
    exact (mul_eq_zero.mp hzero).resolve_left hprod_ne
  set w1 := (1 - z1)⁻¹ with hw1_def
  set w2 := (1 - z2)⁻¹ with hw2_def
  set w3 := (1 - z3)⁻¹ with hw3_def
  set w4 := (1 - z4)⁻¹ with hw4_def
  have hw1re : w1.re = 1 / 2 := by
    rw [hw1_def]
    exact hre z1 h1 hne1
  have hw2re : w2.re = 1 / 2 := by
    rw [hw2_def]
    exact hre z2 h2 hne2
  have hw3re : w3.re = 1 / 2 := by
    rw [hw3_def]
    exact hre z3 h3 hne3
  have hw4re : w4.re = 1 / 2 := by
    rw [hw4_def]
    exact hre z4 h4 hne4
  have him := congrArg Complex.im hF
  have hrr := congrArg Complex.re hF
  simp only [Complex.zero_im] at him
  simp only [Complex.zero_re] at hrr
  simp only [Complex.sub_im, Complex.add_im, Complex.mul_im, Complex.one_im,
    hw1re, hw2re, hw3re, hw4re] at him
  simp only [Complex.sub_re, Complex.add_re, Complex.mul_re, Complex.one_re,
    hw1re, hw2re, hw3re, hw4re] at hrr
  set t1 := w1.im with ht1_def
  set t2 := w2.im with ht2_def
  set t3 := w3.im with ht3_def
  set t4 := w4.im with ht4_def
  have him_clean : (t1 + t2 + t3 + t4) / 2 = 0 := by
    linear_combination him
  have hrr_clean : (1 : ℝ) / 2 -
      (t1 * t2 + t1 * t3 + t1 * t4 + t2 * t3 + t2 * t4 + t3 * t4) = 0 := by
    linear_combination hrr
  have hT : t1 + t2 + t3 + t4 = 0 := by
    linarith [him_clean]
  have hpair : t1 * t2 + t1 * t3 + t1 * t4 + t2 * t3 + t2 * t4 + t3 * t4 = 1 / 2 := by
    linarith [hrr_clean]
  have hsq_eq : (t1 + t2 + t3 + t4) ^ 2 =
      (t1 ^ 2 + t2 ^ 2 + t3 ^ 2 + t4 ^ 2) +
        2 * (t1 * t2 + t1 * t3 + t1 * t4 + t2 * t3 + t2 * t4 + t3 * t4) := by
    ring
  rw [hT, hpair] at hsq_eq
  have hnonneg : 0 ≤ t1 ^ 2 + t2 ^ 2 + t3 ^ 2 + t4 ^ 2 := by
    positivity
  linarith [hsq_eq, hnonneg]
