import Mathlib.Algebra.MvPolynomial.Basic
import Mathlib.Algebra.MvPolynomial.Eval
import Mathlib.Algebra.Polynomial.AlgebraMap
import Mathlib.Algebra.Polynomial.Degree.Domain
import Mathlib.Data.Fin.VecNotation
import Mathlib.Data.Rat.Defs
import Mathlib.RingTheory.Ideal.Span
import Mathlib.Tactic.FinCases

theorem statement1 :
    ¬ ∃ f : MvPolynomial (Fin 2) ℚ,
      Ideal.span {f} =
        Ideal.span {MvPolynomial.X (0 : Fin 2), MvPolynomial.X (1 : Fin 2)} := by
  rintro ⟨f, hf⟩
  set phi0 : MvPolynomial (Fin 2) ℚ →ₐ[ℚ] Polynomial ℚ :=
    MvPolynomial.aeval ![Polynomial.X, 0] with hphi0
  set phi1 : MvPolynomial (Fin 2) ℚ →ₐ[ℚ] Polynomial ℚ :=
    MvPolynomial.aeval ![0, Polynomial.X] with hphi1
  set eps : MvPolynomial (Fin 2) ℚ →ₐ[ℚ] ℚ :=
    MvPolynomial.aeval (fun _ : Fin 2 => (0 : ℚ)) with heps
  have hX0mem : MvPolynomial.X (0 : Fin 2) ∈ Ideal.span {f} := by
    rw [hf]
    exact Ideal.subset_span (by simp)
  have hX1mem : MvPolynomial.X (1 : Fin 2) ∈ Ideal.span {f} := by
    rw [hf]
    exact Ideal.subset_span (by simp)
  rw [Ideal.mem_span_singleton] at hX0mem hX1mem
  obtain ⟨a, ha⟩ := hX0mem
  obtain ⟨b, hb⟩ := hX1mem
  have hfmem : f ∈
      Ideal.span {MvPolynomial.X (0 : Fin 2), MvPolynomial.X (1 : Fin 2)} := by
    rw [← hf]
    exact Ideal.subset_span (by simp)
  rw [Ideal.mem_span_pair] at hfmem
  obtain ⟨y, z, hyz⟩ := hfmem
  have hfeval : eps f = 0 := by
    rw [← hyz]
    simp [heps]
  have hprod0 : phi0 f * phi0 a = Polynomial.X := by
    have h := congrArg phi0 ha
    simpa [hphi0] using h.symm
  have hprod1 : phi1 f * phi1 b = Polynomial.X := by
    have h := congrArg phi1 hb
    simpa [hphi1] using h.symm
  have hcrossProd : phi1 f * phi1 a = 0 := by
    have h := congrArg phi1 ha
    simpa [hphi1] using h.symm
  have hf0_ne : phi0 f ≠ 0 := by
    intro hzero
    rw [hzero, zero_mul] at hprod0
    exact Polynomial.X_ne_zero hprod0.symm
  have ha0_ne : phi0 a ≠ 0 := by
    intro hzero
    rw [hzero, mul_zero] at hprod0
    exact Polynomial.X_ne_zero hprod0.symm
  have hf1_ne : phi1 f ≠ 0 := by
    intro hzero
    rw [hzero, zero_mul] at hprod1
    exact Polynomial.X_ne_zero hprod1.symm
  have ha1_eq : phi1 a = 0 := by
    rcases mul_eq_zero.mp hcrossProd with h | h
    · exact absurd h hf1_ne
    · exact h
  have eval_phi0 : ∀ p : MvPolynomial (Fin 2) ℚ,
      Polynomial.eval 0 (phi0 p) = eps p := by
    intro p
    have hhom : (Polynomial.aeval (0 : ℚ)).comp phi0 = eps := by
      apply MvPolynomial.algHom_ext
      intro i
      fin_cases i <;> simp [hphi0, heps]
    have hp : ((Polynomial.aeval (0 : ℚ)).comp phi0) p = eps p := by
      rw [hhom]
    simpa [Polynomial.coe_aeval_eq_eval] using hp
  have eval_phi1 : ∀ p : MvPolynomial (Fin 2) ℚ,
      Polynomial.eval 0 (phi1 p) = eps p := by
    intro p
    have hhom : (Polynomial.aeval (0 : ℚ)).comp phi1 = eps := by
      apply MvPolynomial.algHom_ext
      intro i
      fin_cases i <;> simp [hphi1, heps]
    have hp : ((Polynomial.aeval (0 : ℚ)).comp phi1) p = eps p := by
      rw [hhom]
    simpa [Polynomial.coe_aeval_eq_eval] using hp
  have hcoeff_f0 : (phi0 f).coeff 0 = 0 := by
    rw [Polynomial.coeff_zero_eq_eval_zero, eval_phi0]
    exact hfeval
  have hdeg : (phi0 f).natDegree + (phi0 a).natDegree = 1 := by
    have h := congrArg Polynomial.natDegree hprod0
    rwa [Polynomial.natDegree_mul hf0_ne ha0_ne, Polynomial.natDegree_X] at h
  have hfdeg_pos : 0 < (phi0 f).natDegree := by
    rcases Nat.eq_zero_or_pos (phi0 f).natDegree with hdeg0 | hpos
    · exfalso
      have hC := Polynomial.eq_C_of_natDegree_eq_zero hdeg0
      rw [hcoeff_f0, Polynomial.C_0] at hC
      exact hf0_ne hC
    · exact hpos
  have hadeg0 : (phi0 a).natDegree = 0 := by omega
  have ha0_coeff_ne : (phi0 a).coeff 0 ≠ 0 := by
    intro hc
    have hC := Polynomial.eq_C_of_natDegree_eq_zero hadeg0
    rw [hc, Polynomial.C_0] at hC
    exact ha0_ne hC
  have hepsa : eps a = 0 := by
    have h := eval_phi1 a
    rw [ha1_eq] at h
    simpa using h.symm
  exact ha0_coeff_ne (by
    rw [Polynomial.coeff_zero_eq_eval_zero, eval_phi0]
    exact hepsa)
