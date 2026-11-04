import Mathlib.NumberTheory.Real.Irrational
import Mathlib.Analysis.SpecialFunctions.Pow.Real

theorem statement1 : Irrational ((2 : ℝ) ^ (1 / 3 : ℝ) + (3 : ℝ) ^ (1 / 3 : ℝ)) := by
  set a : ℝ := (2 : ℝ) ^ (1 / 3 : ℝ) with ha_def
  set b : ℝ := (3 : ℝ) ^ (1 / 3 : ℝ) with hb_def
  set w : ℝ := (6 : ℝ) ^ (1 / 3 : ℝ) with hw_def
  have cube_rpow : ∀ x : ℝ, 0 ≤ x → (x ^ (1 / 3 : ℝ)) ^ 3 = x := by
    intro x hx
    have h : x ^ ((1 / 3 : ℝ) * ((3 : ℕ) : ℝ)) =
        (x ^ (1 / 3 : ℝ)) ^ ((3 : ℕ) : ℝ) :=
      Real.rpow_mul hx _ _
    rw [Real.rpow_natCast] at h
    have e : (1 / 3 : ℝ) * ((3 : ℕ) : ℝ) = 1 := by norm_num
    rw [e, Real.rpow_one] at h
    exact h.symm
  have ha_pos : 0 < a := by
    rw [ha_def]
    exact Real.rpow_pos_of_pos (by norm_num) _
  have hb_pos : 0 < b := by
    rw [hb_def]
    exact Real.rpow_pos_of_pos (by norm_num) _
  have hw_pos : 0 < w := by
    rw [hw_def]
    exact Real.rpow_pos_of_pos (by norm_num) _
  have ha3 : a ^ 3 = 2 := by
    rw [ha_def]
    exact cube_rpow 2 (by norm_num)
  have hb3 : b ^ 3 = 3 := by
    rw [hb_def]
    exact cube_rpow 3 (by norm_num)
  have hw3 : w ^ 3 = 6 := by
    rw [hw_def]
    exact cube_rpow 6 (by norm_num)
  have hab : a * b = w := by
    rw [ha_def, hb_def, hw_def]
    have h : ((2 : ℝ) * (3 : ℝ)) ^ (1 / 3 : ℝ) =
        (2 : ℝ) ^ (1 / 3 : ℝ) * (3 : ℝ) ^ (1 / 3 : ℝ) :=
      Real.mul_rpow (by norm_num) (by norm_num)
    have h23 : (2 : ℝ) * (3 : ℝ) = 6 := by norm_num
    rw [h23] at h
    exact h.symm
  have hs3 : (a + b) ^ 3 = 5 + 3 * w * (a + b) := by
    calc
      (a + b) ^ 3 = a ^ 3 + b ^ 3 + 3 * (a * b) * (a + b) := by ring
      _ = 5 + 3 * w * (a + b) := by
        rw [ha3, hb3, hab]
        ring
  have hw_irr : Irrational w := by
    show w ∉ Set.range ((↑) : ℚ → ℝ)
    rintro ⟨q, hq⟩
    have hq3 : q ^ 3 = 6 := by
      have h : (q : ℝ) ^ 3 = 6 := by
        rw [hq]
        exact hw3
      exact_mod_cast h
    have hden_q : (q.den : ℚ) ≠ 0 := by
      exact_mod_cast q.den_nz
    have hint : q.num ^ 3 = 6 * (q.den : ℤ) ^ 3 := by
      have h : ((q.num : ℚ) / (q.den : ℚ)) ^ 3 = 6 := by
        rw [Rat.num_div_den]
        exact hq3
      rw [div_pow] at h
      have h2 := (div_eq_iff (pow_ne_zero 3 hden_q)).mp h
      exact_mod_cast h2
    have hnat : q.num.natAbs ^ 3 = 6 * q.den ^ 3 := by
      have h := congrArg Int.natAbs hint
      rw [Int.natAbs_pow, Int.natAbs_mul, Int.natAbs_pow] at h
      simpa using h
    have hcop : Nat.Coprime q.num.natAbs q.den := q.reduced
    have dvd_cube : ∀ x : ℕ, (2 : ℕ) ∣ x ^ 3 → (2 : ℕ) ∣ x := by
      intro x hx
      have hprod : (2 : ℕ) ∣ x * x * x := by
        have hx' := hx
        rwa [show x ^ 3 = x * x * x by ring] at hx'
      rcases (Nat.prime_two.dvd_mul.mp hprod) with h | h
      · rcases (Nat.prime_two.dvd_mul.mp h) with h' | h'
        · exact h'
        · exact h'
      · exact h
    have h2A : (2 : ℕ) ∣ q.num.natAbs := by
      apply dvd_cube
      use 3 * q.den ^ 3
      rw [hnat]
      ring
    obtain ⟨a1, ha1⟩ := h2A
    have h8 : 8 * a1 ^ 3 = 6 * q.den ^ 3 := by
      calc
        8 * a1 ^ 3 = (2 * a1) ^ 3 := by ring
        _ = 6 * q.den ^ 3 := by
          rw [← ha1]
          exact hnat
    have hEq : 4 * a1 ^ 3 = 3 * q.den ^ 3 := by omega
    have h2B : (2 : ℕ) ∣ q.den := by
      apply dvd_cube
      have h2mul : (2 : ℕ) ∣ 3 * q.den ^ 3 := by
        use 2 * a1 ^ 3
        omega
      rcases (Nat.prime_two.dvd_mul.mp h2mul) with h | h
      · norm_num at h
      · exact h
    have h2gcd : (2 : ℕ) ∣ Nat.gcd q.num.natAbs q.den :=
      Nat.dvd_gcd ⟨a1, ha1⟩ h2B
    have hgcd : Nat.gcd q.num.natAbs q.den = 1 := hcop
    rw [hgcd] at h2gcd
    norm_num at h2gcd
  have hs_pos : 0 < a + b := by linarith
  have hs_ne : a + b ≠ 0 := ne_of_gt hs_pos
  have hw_eq : ((a + b) ^ 3 - 5) / (3 * (a + b)) = w := by
    have hden : (3 : ℝ) * (a + b) ≠ 0 :=
      mul_ne_zero (by norm_num) hs_ne
    rw [hs3, div_eq_iff hden]
    ring
  show (a + b) ∉ Set.range ((↑) : ℚ → ℝ)
  intro hrat
  obtain ⟨q, hq⟩ := hrat
  have hw_rat : w ∈ Set.range ((↑) : ℚ → ℝ) := by
    refine ⟨(q ^ 3 - 5) / (3 * q), ?_⟩
    push_cast
    rw [hq]
    exact hw_eq
  exact hw_irr hw_rat
