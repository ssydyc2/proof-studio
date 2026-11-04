import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Data.Rat.Cast.Order
import Mathlib.Order.Interval.Finset.Nat
import Mathlib.NumberTheory.Bertrand

theorem statement2 (n : ℕ) (hn : 2 ≤ n) (m : ℤ) :
    (∑ k ∈ Finset.Ioc 1 n, (1 : ℚ) / (k : ℚ)) ≠ (m : ℚ) := by
  intro h
  obtain ⟨p, h1, h2, h3⟩ := Nat.bertrand (n / 2) (by omega)
  have hp_prime : Nat.Prime p := by assumption
  have hp_gt : n / 2 < p := by omega
  have hp_le : p ≤ 2 * (n / 2) := by omega
  have hp_le_n : p ≤ n := by omega
  have hp_gt_one : 1 < p := by omega
  have hp_two_p_gt : n < 2 * p := by omega
  have hp_mem : p ∈ Finset.Ioc 1 n := by
    rw [Finset.mem_Ioc]
    exact ⟨hp_gt_one, hp_le_n⟩
  have hpk_not : ∀ k ∈ (Finset.Ioc 1 n).erase p, ¬ p ∣ k := by
    intro k hk hdiv
    obtain ⟨hk_ne, hk_mem⟩ := Finset.mem_erase.mp hk
    obtain ⟨hk_gt, hk_le⟩ := Finset.mem_Ioc.mp hk_mem
    obtain ⟨c, hc⟩ := hdiv
    have hc_pos : 0 < c := by
      by_contra hnot
      push_neg at hnot
      have hc0 : c = 0 := by omega
      rw [hc0, mul_zero] at hc
      omega
    have hc_lt : c < 2 := by
      by_contra hnot
      push_neg at hnot
      have hle : p * 2 ≤ p * c := Nat.mul_le_mul le_rfl hnot
      omega
    have hc_one : c = 1 := by omega
    have hkp : k = p := by
      rw [hc, hc_one, mul_one]
    exact hk_ne hkp
  have hgen : ∀ s : Finset ℕ, (∀ k ∈ s, ¬ p ∣ k) → ¬ p ∣ ∏ k ∈ s, k := by
    intro s
    induction s using Finset.induction with
    | empty =>
        intro _ hdvd
        simp only [Finset.prod_empty] at hdvd
        have hle : p ≤ 1 := Nat.le_of_dvd (by norm_num) hdvd
        omega
    | @insert a s ha ih =>
        intro hs hdvd
        rw [Finset.prod_insert ha] at hdvd
        rcases (hp_prime.dvd_mul).mp hdvd with hda | hds
        · exact hs a (Finset.mem_insert_self a s) hda
        · exact ih (fun k hk => hs k (Finset.mem_insert_of_mem hk)) hds
  set M : ℕ := ∏ k ∈ (Finset.Ioc 1 n).erase p, k with hM_def
  have hp_not_dvd_M : ¬ p ∣ M := by
    rw [hM_def]
    exact hgen _ hpk_not
  set S : ℕ := ∑ k ∈ (Finset.Ioc 1 n).erase p, M / k with hS_def
  have hS_eq :
      (S : ℚ) = ∑ k ∈ (Finset.Ioc 1 n).erase p, ((1 : ℚ) / (k : ℚ) * (M : ℚ)) := by
    rw [hS_def]
    simp only [Nat.cast_sum]
    apply Finset.sum_congr rfl
    intro k hk
    have hk_dvd : k ∣ M := by
      rw [hM_def]
      exact Finset.dvd_prod_of_mem (fun x => x) hk
    have hk_pos : 0 < k := by
      obtain ⟨-, hk_mem⟩ := Finset.mem_erase.mp hk
      obtain ⟨hk_gt, -⟩ := Finset.mem_Ioc.mp hk_mem
      omega
    have hk_ne : (k : ℚ) ≠ 0 := by exact_mod_cast hk_pos.ne'
    show ((M / k : ℕ) : ℚ) = (1 : ℚ) / (k : ℚ) * (M : ℚ)
    rw [Nat.cast_div hk_dvd hk_ne, div_eq_inv_mul, one_div]
  have h_key :
      (1 : ℚ) / (p : ℚ) * (M : ℚ) + (S : ℚ) = (m : ℚ) * (M : ℚ) := by
    calc (1 : ℚ) / (p : ℚ) * (M : ℚ) + (S : ℚ)
        = (1 : ℚ) / (p : ℚ) * (M : ℚ) +
            ∑ k ∈ (Finset.Ioc 1 n).erase p, ((1 : ℚ) / (k : ℚ) * (M : ℚ)) := by
          rw [hS_eq]
      _ = ∑ k ∈ Finset.Ioc 1 n, ((1 : ℚ) / (k : ℚ) * (M : ℚ)) :=
          Finset.add_sum_erase (Finset.Ioc 1 n)
            (fun k => (1 : ℚ) / (k : ℚ) * (M : ℚ)) hp_mem
      _ = (∑ k ∈ Finset.Ioc 1 n, (1 : ℚ) / (k : ℚ)) * (M : ℚ) := by
          rw [Finset.sum_mul]
      _ = (m : ℚ) * (M : ℚ) := by rw [h]
  set z : ℤ := m * (M : ℤ) - (S : ℤ) with hz_def
  have hz_cast : (z : ℚ) = (m : ℚ) * (M : ℚ) - (S : ℚ) := by
    rw [hz_def, Int.cast_sub, Int.cast_mul, Int.cast_natCast, Int.cast_natCast]
  have hp_eq : (1 : ℚ) / (p : ℚ) * (M : ℚ) = (z : ℚ) := by
    rw [hz_cast]
    exact eq_sub_of_add_eq h_key
  have hp_ne : (p : ℚ) ≠ 0 := by
    exact_mod_cast (show p ≠ 0 by omega)
  have hM_eq : (M : ℚ) = (z : ℚ) * (p : ℚ) := by
    rw [← hp_eq, one_div, mul_comm ((p : ℚ)⁻¹) (M : ℚ), mul_assoc,
      inv_mul_cancel₀ hp_ne, mul_one]
  have hM_int : (M : ℤ) = z * (p : ℤ) := by
    have hcast : ((M : ℤ) : ℚ) = ((z * (p : ℤ) : ℤ) : ℚ) := by
      push_cast
      exact hM_eq
    exact_mod_cast hcast
  have hdvd_nat : p ∣ M := by
    have hdvd_int : (p : ℤ) ∣ (M : ℤ) := ⟨z, by rw [hM_int, mul_comm]⟩
    exact_mod_cast hdvd_int
  exact hp_not_dvd_M hdvd_nat
