import Mathlib.Data.Nat.Prime.Basic
import Mathlib.Data.Set.Finite.Basic
import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Algebra.Order.BigOperators.Group.Finset
import Mathlib.Tactic.Ring

theorem statement1 : Set.Infinite {p : ℕ | Nat.Prime p ∧ p % 4 = 3} := by
  have key_aux : ∀ k n : ℕ, n ≤ k → n % 4 = 3 →
      ∃ p, Nat.Prime p ∧ p ∣ n ∧ p % 4 = 3 := by
    intro k
    induction k with
    | zero =>
        intro n hn hnmod
        omega
    | succ k ih =>
        intro n hnle hnmod
        obtain ⟨p, hpprime, hpdvd⟩ : ∃ p, Nat.Prime p ∧ p ∣ n :=
          ⟨n.minFac, Nat.minFac_prime (show n ≠ 1 by omega), Nat.minFac_dvd n⟩
        have hpne2 : p ≠ 2 := by
          intro hp2
          subst hp2
          obtain ⟨t, ht⟩ := hpdvd
          omega
        have hpmod : p % 4 = 1 ∨ p % 4 = 3 := by
          obtain ⟨t, ht⟩ := hpprime.odd_of_ne_two hpne2
          have hlt : p % 4 < 4 := Nat.mod_lt _ (by omega)
          omega
        rcases hpmod with hpmod1 | hpmod3
        · have hqlt : n / p < n :=
            Nat.div_lt_self (by omega)
              (by have h2le := hpprime.two_le; omega)
          have hqmod : (n / p) % 4 = 3 := by
            have hprod : p * (n / p) = n := Nat.mul_div_cancel' hpdvd
            have h1 : (p * (n / p)) % 4 = 3 := by
              rw [hprod]
              exact hnmod
            have h2 : (p * (n / p)) % 4 = (n / p) % 4 := by
              rw [Nat.mul_mod, hpmod1]
              simp
            rw [h2] at h1
            exact h1
          obtain ⟨q, hqprime, hqdvd, hqmod3⟩ := ih (n / p) (by omega) hqmod
          exact ⟨q, hqprime, dvd_trans hqdvd ⟨p, (Nat.div_mul_cancel hpdvd).symm⟩, hqmod3⟩
        · exact ⟨p, hpprime, hpdvd, hpmod3⟩
  have key : ∀ n : ℕ, n % 4 = 3 → ∃ p, Nat.Prime p ∧ p ∣ n ∧ p % 4 = 3 := by
    intro n hn
    exact key_aux n n (by omega) hn
  intro hfin
  have hFmem : ∀ p : ℕ, p ∈ hfin.toFinset ↔ Nat.Prime p ∧ p % 4 = 3 := by
    intro p
    exact Set.Finite.mem_toFinset hfin
  have aux_pos : ∀ s : Finset ℕ, (∀ p ∈ s, 0 < p) → 0 < ∏ p ∈ s, p := by
    intro s
    induction s using Finset.induction with
    | empty =>
        intro _
        simp
    | insert a s ha ih =>
        intro h
        rw [Finset.prod_insert ha]
        apply mul_pos
        · exact h a (Finset.mem_insert_self a s)
        · apply ih
          intro p hp
          exact h p (Finset.mem_insert_of_mem hp)
  have aux_dvd : ∀ s : Finset ℕ, ∀ q : ℕ, q ∈ s → q ∣ ∏ p ∈ s, p := by
    intro s
    induction s using Finset.induction with
    | empty =>
        intro q hq
        simp at hq
    | insert a s ha ih =>
        intro q hq
        rw [Finset.prod_insert ha]
        rcases Finset.mem_insert.mp hq with rfl | hqs
        · exact dvd_mul_right _ _
        · obtain ⟨c, hc⟩ := ih q hqs
          exact ⟨a * c, by rw [hc]; ring⟩
  set M : ℕ := ∏ p ∈ hfin.toFinset, p with hMdef
  have hMpos : 0 < M := by
    rw [hMdef]
    apply aux_pos
    intro p hp
    exact ((hFmem p).mp hp).1.pos
  obtain ⟨q, hqprime, hqdvdN, hqmod⟩ := key (4 * M - 1) (by omega)
  have hqF : q ∈ hfin.toFinset := (hFmem q).mpr ⟨hqprime, hqmod⟩
  have hqdvdM : q ∣ M := by
    rw [hMdef]
    exact aux_dvd _ q hqF
  have hqdvd4M : q ∣ 4 * M := dvd_trans hqdvdM (dvd_mul_left M 4)
  obtain ⟨a, ha⟩ := hqdvd4M
  obtain ⟨b, hb⟩ := hqdvdN
  have hba : b < a := by
    by_contra hnot
    have hab : a ≤ b := not_lt.mp hnot
    have hle : q * a ≤ q * b := Nat.mul_le_mul le_rfl hab
    omega
  obtain ⟨d, hd⟩ := Nat.exists_eq_add_of_le (le_of_lt hba)
  have h_expand : q * a = q * b + q * d := by
    rw [hd, mul_add]
  have hqd_eq : q * d = 1 := by omega
  have hq1 : q = 1 := Nat.dvd_one.mp ⟨d, hqd_eq.symm⟩
  have hq2le : 2 ≤ q := hqprime.two_le
  omega
