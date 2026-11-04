import Mathlib.Data.Nat.Prime.Basic
import Mathlib.Data.Set.Finite.Basic
import Mathlib.Data.Nat.Factorial.Basic
import Mathlib.Tactic.Ring

theorem statement2 : ∀ N : ℕ, ∃ p : ℕ, N < p ∧ Nat.Prime p ∧ ∃ n : ℕ, p = 3 * n + 2 := by
  have key_bound : ∀ B M : ℕ, M ≤ B → M % 3 = 2 →
      ∃ p : ℕ, Nat.Prime p ∧ p ∣ M ∧ p % 3 = 2 := by
    intro B
    induction B with
    | zero =>
      intro M hle hM
      exfalso
      have hM0 : M = 0 := by omega
      omega
    | succ B IH =>
      intro M hle hM
      by_cases hleB : M ≤ B
      · exact IH M hleB hM
      · have hMne1 : M ≠ 1 := by omega
        obtain ⟨p, hp, hpdvd⟩ := Nat.exists_prime_and_dvd hMne1
        by_cases hpmod : p % 3 = 2
        · exact ⟨p, hp, hpdvd, hpmod⟩
        · have hpmod_ne0 : p % 3 ≠ 0 := by
            intro h0
            have h3p : 3 ∣ p := Nat.dvd_of_mod_eq_zero h0
            have h3M : 3 ∣ M := dvd_trans h3p hpdvd
            obtain ⟨t, ht⟩ := h3M
            omega
          have hpmod1 : p % 3 = 1 := by
            have hlt : p % 3 < 3 := by omega
            omega
          obtain ⟨k, hk⟩ := hpdvd
          have hkmod : k % 3 = 2 := by
            have h1 : (p * k) % 3 = 2 := by
              rw [← hk]
              exact hM
            rw [Nat.mul_mod, hpmod1] at h1
            have hklt3 : k % 3 < 3 := by omega
            omega
          have hk_pos : 0 < k := by
            rcases Nat.eq_zero_or_pos k with hk0 | hkpos
            · exfalso
              rw [hk0, mul_zero] at hk
              omega
            · exact hkpos
          have hk_lt : k < M := by
            have hp2 : 2 ≤ p := hp.two_le
            have hr_ex : ∃ r : ℕ, p = r + 2 := ⟨p - 2, by omega⟩
            obtain ⟨r, hr⟩ := hr_ex
            rw [hk, hr]
            have hexp : (r + 2) * k = r * k + 2 * k := by ring
            rw [hexp]
            omega
          have hk_le : k ≤ B := by omega
          have hkdvdM : k ∣ M := ⟨p, by rw [hk]; exact mul_comm p k⟩
          obtain ⟨q, hq, hqdvdk, hqmod⟩ := IH k hk_le hkmod
          exact ⟨q, hq, dvd_trans hqdvdk hkdvdM, hqmod⟩
  have key : ∀ M : ℕ, M % 3 = 2 → ∃ p : ℕ, Nat.Prime p ∧ p ∣ M ∧ p % 3 = 2 :=
    fun M hM => key_bound M M (Nat.le_refl M) hM
  intro N
  have hFpos : 0 < Nat.factorial (N + 1) := Nat.factorial_pos (N + 1)
  have hMmod : (3 * Nat.factorial (N + 1) - 1) % 3 = 2 := by omega
  obtain ⟨p, hp, hpdvd, hpmod⟩ := key _ hMmod
  have hpgt : N < p := by
    refine lt_of_not_ge ?_
    intro hle
    have hpdvdF : p ∣ Nat.factorial (N + 1) := Nat.dvd_factorial hp.pos (by omega)
    have hpdvd3F : p ∣ 3 * Nat.factorial (N + 1) :=
      dvd_trans hpdvdF (dvd_mul_left _ 3)
    obtain ⟨a, ha⟩ := hpdvd3F
    obtain ⟨b, hb⟩ := hpdvd
    have hp2 : 2 ≤ p := hp.two_le
    have hEq : p * a = p * b + 1 := by omega
    have hab : b < a := by
      by_contra hnot
      have hale : a ≤ b := by omega
      obtain ⟨d, hd⟩ := Nat.exists_eq_add_of_le hale
      rw [hd] at hEq
      have hexp : p * (a + d) = p * a + p * d := by ring
      rw [hexp] at hEq
      omega
    obtain ⟨d, hd⟩ := Nat.exists_eq_add_of_le hab.le
    have hdpos : 0 < d := by omega
    have he_ex : ∃ e : ℕ, d = e + 1 := ⟨d - 1, by omega⟩
    obtain ⟨e, he⟩ := he_ex
    rw [hd, he] at hEq
    have hexp2 : p * (b + (e + 1)) = p * b + p * e + p := by ring
    rw [hexp2] at hEq
    omega
  exact ⟨p, hpgt, hp, ⟨p / 3, by omega⟩⟩
