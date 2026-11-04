import Mathlib.Data.Nat.Prime.Basic
import Mathlib.Data.ZMod.Basic
import Mathlib.Data.Nat.Totient
import Mathlib.FieldTheory.Finite.Basic
import Mathlib.GroupTheory.OrderOfElement
import Mathlib.Tactic.IntervalCases
import Mathlib.Tactic.FinCases

theorem statement1 (x : ℤ) (p : ℕ) (hp : Nat.Prime p)
    (h : (p : ℤ) ∣ x ^ 4 - x ^ 2 + 1) : p % 12 = 1 := by
  have ha0 : (x : ZMod p) ^ 4 - (x : ZMod p) ^ 2 + 1 = 0 := by
    obtain ⟨k, hk⟩ := h
    have h0 : ((x ^ 4 - x ^ 2 + 1 : ℤ) : ZMod p) = 0 := by
      rw [hk]
      push_cast
      simp
    push_cast at h0
    exact h0
  have hp_ne_two : p ≠ 2 := by
    rintro rfl
    generalize (x : ZMod 2) = a at ha0
    fin_cases a <;> first
      | (revert ha0; decide)
      | simp at ha0
      | norm_num at ha0
  have hp_ne_three : p ≠ 3 := by
    rintro rfl
    generalize (x : ZMod 3) = a at ha0
    fin_cases a <;> first
      | (revert ha0; decide)
      | simp at ha0
      | norm_num at ha0
  haveI : Fact p.Prime := ⟨hp⟩
  haveI : NeZero p := ⟨hp.ne_zero⟩
  have ha_ne : (x : ZMod p) ≠ 0 := by
    intro hx
    rw [hx] at ha0
    simp at ha0
  have h6 : (x : ZMod p) ^ 6 = -1 := by
    have hid : ((x : ZMod p) ^ 2 + 1) *
        ((x : ZMod p) ^ 4 - (x : ZMod p) ^ 2 + 1) = (x : ZMod p) ^ 6 + 1 := by
      ring
    rw [ha0, mul_zero] at hid
    exact eq_neg_of_add_eq_zero_left hid.symm
  have h12 : (x : ZMod p) ^ 12 = 1 := by
    have hpow : (x : ZMod p) ^ 12 = ((x : ZMod p) ^ 6) ^ 2 := by ring
    rw [hpow, h6]
    ring
  have ha6_ne : (x : ZMod p) ^ 6 ≠ 1 := by
    intro h61
    rw [h6] at h61
    have h2cast : (2 : ZMod p) = 0 := by
      have hsum : (-1 : ZMod p) + 1 = 1 + 1 := by rw [h61]
      simp only [neg_add_cancel] at hsum
      have htwo : (2 : ZMod p) = 1 + 1 := by ring
      rw [htwo]
      exact hsum.symm
    have hdvd : p ∣ 2 := by
      have h2nat : ((2 : ℕ) : ZMod p) = 0 := by
        rw [Nat.cast_ofNat]
        exact h2cast
      exact (CharP.cast_eq_zero_iff (ZMod p) p 2).mp h2nat
    rcases (Nat.dvd_prime Nat.prime_two).mp hdvd with hcase | hcase
    · exact hp.ne_one hcase
    · exact hp_ne_two hcase
  have ha4_ne : (x : ZMod p) ^ 4 ≠ 1 := by
    intro h41
    have ha2_neg : (x : ZMod p) ^ 2 = -1 := by
      have h6copy := h6
      have hpow : (x : ZMod p) ^ 6 = (x : ZMod p) ^ 4 * (x : ZMod p) ^ 2 := by ring
      rw [h41, one_mul] at hpow
      rw [hpow] at h6copy
      exact h6copy
    have ha2_two : (x : ZMod p) ^ 2 = 2 := by
      have h0 := ha0
      rw [h41] at h0
      have hsub : (2 : ZMod p) - (x : ZMod p) ^ 2 = 0 := by
        have hrw : (2 : ZMod p) - (x : ZMod p) ^ 2 = 1 - (x : ZMod p) ^ 2 + 1 := by ring
        rw [hrw]
        exact h0
      exact (sub_eq_zero.mp hsub).symm
    have hneg : (-1 : ZMod p) = 2 := ha2_neg.symm.trans ha2_two
    have h3cast : (3 : ZMod p) = 0 := by
      have hsum : (-1 : ZMod p) + 1 = 2 + 1 := by rw [hneg]
      simp only [neg_add_cancel] at hsum
      have hthree : (3 : ZMod p) = 2 + 1 := by ring
      rw [hthree]
      exact hsum.symm
    have hdvd : p ∣ 3 := by
      have h3nat : ((3 : ℕ) : ZMod p) = 0 := by
        rw [Nat.cast_ofNat]
        exact h3cast
      exact (CharP.cast_eq_zero_iff (ZMod p) p 3).mp h3nat
    rcases (Nat.dvd_prime Nat.prime_three).mp hdvd with hcase | hcase
    · exact hp.ne_one hcase
    · exact hp_ne_three hcase
  set u : (ZMod p)ˣ := Units.mk0 (x : ZMod p) ha_ne with hu_def
  have hu12 : u ^ 12 = 1 := by
    apply Units.ext
    rw [hu_def]
    simpa using h12
  have hu6 : u ^ 6 ≠ 1 := by
    intro hcon
    apply ha6_ne
    have hval := congrArg Units.val hcon
    simpa [hu_def] using hval
  have hu4 : u ^ 4 ≠ 1 := by
    intro hcon
    apply ha4_ne
    have hval := congrArg Units.val hcon
    simpa [hu_def] using hval
  have hdvd12 : orderOf u ∣ 12 := (orderOf_dvd_iff_pow_eq_one).mpr hu12
  have hnot6 : ¬ orderOf u ∣ 6 := by
    intro hd
    exact hu6 ((orderOf_dvd_iff_pow_eq_one).mp hd)
  have hnot4 : ¬ orderOf u ∣ 4 := by
    intro hd
    exact hu4 ((orderOf_dvd_iff_pow_eq_one).mp hd)
  have key : ∀ d : ℕ, d ∣ 12 → ¬ d ∣ 6 → ¬ d ∣ 4 → d = 12 := by
    intro d hd12 hd6 hd4
    have hdle : d ≤ 12 := Nat.le_of_dvd (by norm_num) hd12
    interval_cases d <;> revert hd12 hd6 hd4 <;> decide
  have horder : orderOf u = 12 := key (orderOf u) hdvd12 hnot6 hnot4
  have hu_pow : u ^ (p - 1) = 1 := by
    have hpow := ZMod.pow_totient u
    rwa [Nat.totient_prime hp] at hpow
  have hdvd_pm1 : 12 ∣ p - 1 := by
    rw [← horder]
    exact (orderOf_dvd_iff_pow_eq_one).mpr hu_pow
  have hp_ge : 2 ≤ p := hp.two_le
  omega
