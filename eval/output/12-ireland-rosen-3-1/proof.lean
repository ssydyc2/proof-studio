import Mathlib.Data.Nat.Prime.Basic
import Mathlib.Data.Set.Finite.Basic
import Mathlib.Data.Nat.Factorial.Basic

theorem statement2 : ∀ n : ℕ, ∃ p : ℕ, n < p ∧ p.Prime ∧ p % 6 = 5 := by
  have key_aux : ∀ k : ℕ, ∀ N : ℕ, N ≤ k → N % 6 = 5 →
      ∃ p : ℕ, p.Prime ∧ p ∣ N ∧ p % 6 = 5 := by
    intro k
    induction k with
    | zero =>
        intro N hle hN
        have hN0 : N = 0 := by omega
        subst hN0
        exfalso
        omega
    | succ k ih =>
        intro N hle hN
        have hNne : N ≠ 1 := by omega
        obtain ⟨p, hp_prime, hp_dvd⟩ := Nat.exists_prime_and_dvd hNne
        have hp_ne_two : p ≠ 2 := by
          rintro rfl
          omega
        have hp_ne_three : p ≠ 3 := by
          rintro rfl
          omega
        have hp_not_dvd_two : ¬ (2 : ℕ) ∣ p := by
          intro hd
          rcases hp_prime.eq_one_or_self_of_dvd 2 hd with h | h
          · omega
          · exact hp_ne_two h.symm
        have hp_not_dvd_three : ¬ (3 : ℕ) ∣ p := by
          intro hd
          rcases hp_prime.eq_one_or_self_of_dvd 3 hd with h | h
          · omega
          · exact hp_ne_three h.symm
        have hp_mod : p % 6 = 1 ∨ p % 6 = 5 := by
          have hlt : p % 6 < 6 := Nat.mod_lt _ (by omega)
          rcases (by omega :
              p % 6 = 0 ∨ p % 6 = 1 ∨ p % 6 = 2 ∨ p % 6 = 3 ∨ p % 6 = 4 ∨ p % 6 = 5)
            with h | h | h | h | h | h
          · exfalso
            exact hp_not_dvd_two (by omega)
          · exact Or.inl h
          · exfalso
            exact hp_not_dvd_two (by omega)
          · exfalso
            exact hp_not_dvd_three (by omega)
          · exfalso
            exact hp_not_dvd_two (by omega)
          · exact Or.inr h
        rcases hp_mod with hp1 | hp5
        · obtain ⟨m, hm⟩ := hp_dvd
          have hm_mod : m % 6 = 5 := by
            have hmul : (p * m) % 6 = 5 := by
              rw [← hm]
              exact hN
            have hmod : (p * m) % 6 = m % 6 := by
              rw [Nat.mul_mod, hp1]
              simp
            rw [hmod] at hmul
            exact hmul
          have hm_pos : 0 < m := by
            rcases Nat.eq_zero_or_pos m with h0 | hpos
            · exfalso
              subst h0
              simp at hm
              omega
            · exact hpos
          have hm_lt : m < N := by
            rw [hm]
            have h2 : 2 ≤ p := hp_prime.two_le
            obtain ⟨t, ht⟩ : ∃ t, p = t + 2 := ⟨p - 2, by omega⟩
            rw [ht, add_mul]
            omega
          obtain ⟨q, hq_prime, hq_dvd_m, hq_mod⟩ := ih m (by omega) hm_mod
          exact ⟨q, hq_prime,
            dvd_trans hq_dvd_m ⟨p, by rw [hm]; exact Nat.mul_comm p m⟩, hq_mod⟩
        · exact ⟨p, hp_prime, hp_dvd, hp5⟩
  have key : ∀ N : ℕ, N % 6 = 5 → ∃ p : ℕ, p.Prime ∧ p ∣ N ∧ p % 6 = 5 := by
    intro N hN
    exact key_aux N N (Nat.le_refl N) hN
  intro n
  have hfact : 0 < Nat.factorial (n + 1) := Nat.factorial_pos (n + 1)
  obtain ⟨p, hp_prime, hp_dvd, hp_mod⟩ :=
    key (6 * Nat.factorial (n + 1) - 1) (by omega)
  refine ⟨p, ?_, hp_prime, hp_mod⟩
  by_contra hgt
  have hle : p ≤ n := by omega
  have hp_dvd_fact : p ∣ Nat.factorial (n + 1) :=
    Nat.dvd_factorial hp_prime.pos (by omega)
  have hp_dvd_sixfact : p ∣ 6 * Nat.factorial (n + 1) :=
    dvd_mul_of_dvd_right hp_dvd_fact 6
  have hp_dvd_one : p ∣ 1 := by
    obtain ⟨a, ha⟩ := hp_dvd_sixfact
    obtain ⟨b, hb⟩ := hp_dvd
    have hEq : p * a = p * b + 1 := by omega
    rcases (show b ≤ a ∨ a < b by omega) with hle | hlt
    · refine ⟨a - b, ?_⟩
      have hmul : p * a = p * b + p * (a - b) := by
        have htmp : p * a = p * (b + (a - b)) := by
          rw [show b + (a - b) = a by omega]
        rwa [mul_add] at htmp
      omega
    · exfalso
      have hmul : p * b = p * a + p * (b - a) := by
        have htmp : p * b = p * (a + (b - a)) := by
          rw [show a + (b - a) = b by omega]
        rwa [mul_add] at htmp
      omega
  have hp_le_one : p ≤ 1 := Nat.le_of_dvd (by omega) hp_dvd_one
  have hp_ge_two : 2 ≤ p := hp_prime.two_le
  omega
