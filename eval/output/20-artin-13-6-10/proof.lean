import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Algebra.Field.Basic
import Mathlib.Data.Fintype.Basic

theorem statement2 (K : Type*) [Field K] [Fintype K] [DecidableEq K] :
    (∏ x : { x : K // x ≠ 0 }, x.val) = -1 := by
  have key : ∀ x : K, x ≠ 0 → x⁻¹ = x → x = 1 ∨ x = -1 := by
    intro x hx hinv
    have hsq : x ^ 2 = 1 := by
      have h1 : x⁻¹ * x = 1 := inv_mul_cancel₀ hx
      rw [hinv] at h1
      rw [pow_two]
      exact h1
    have hfactor : (x + 1) * (x - 1) = 0 := by
      have h2 : x ^ 2 - (1 : K) ^ 2 = 0 := by
        rw [hsq]
        simp
      rw [sq_sub_sq] at h2
      exact h2
    rcases mul_eq_zero.mp hfactor with h | h
    · right
      exact eq_neg_of_add_eq_zero_left h
    · left
      exact sub_eq_zero.mp h
  by_cases hneg : (-1 : K) = 1
  · have hprod : (∏ x : { x : K // x ≠ 0 }, x.val) = 1 := by
      refine Finset.prod_involution
        (g := fun (x : { x : K // x ≠ 0 }) _ =>
          ⟨x.val⁻¹, inv_ne_zero x.property⟩) ?_ ?_ ?_ ?_
      · intro x _
        show x.val * x.val⁻¹ = 1
        exact mul_inv_cancel₀ x.property
      · intro x _ hx_ne hg
        have hv : x.val⁻¹ = x.val := congrArg Subtype.val hg
        rcases key x.val x.property hv with h | h
        · exact hx_ne h
        · exact hx_ne (h.trans hneg)
      · intro x _
        exact Finset.mem_univ _
      · intro x _
        apply Subtype.ext
        show (x.val⁻¹)⁻¹ = x.val
        exact inv_inv x.val
    rw [hprod]
    exact hneg.symm
  · set a : { x : K // x ≠ 0 } := ⟨1, one_ne_zero⟩ with ha_def
    set b : { x : K // x ≠ 0 } :=
      ⟨-1, neg_ne_zero.mpr one_ne_zero⟩ with hb_def
    have ha_val : a.val = 1 := by rw [ha_def]
    have hb_val : b.val = -1 := by rw [hb_def]
    have hab : b ≠ a := by
      intro h
      apply hneg
      have hv := congrArg Subtype.val h
      rw [hb_val, ha_val] at hv
      exact hv
    have hprod_s :
        (∏ x ∈ (Finset.univ.erase a).erase b, x.val) = 1 := by
      refine Finset.prod_involution
        (g := fun (x : { x : K // x ≠ 0 }) _ =>
          ⟨x.val⁻¹, inv_ne_zero x.property⟩) ?_ ?_ ?_ ?_
      · intro x _
        show x.val * x.val⁻¹ = 1
        exact mul_inv_cancel₀ x.property
      · intro x hx hx_ne hg
        have hv : x.val⁻¹ = x.val := congrArg Subtype.val hg
        rcases key x.val x.property hv with h | h
        · exact hx_ne h
        · have hxb : x ≠ b := (Finset.mem_erase.mp hx).1
          apply hxb
          apply Subtype.ext
          show x.val = b.val
          rw [hb_val]
          exact h
      · intro x hx
        have hxb : x ≠ b := (Finset.mem_erase.mp hx).1
        have hxa : x ≠ a :=
          (Finset.mem_erase.mp (Finset.mem_erase.mp hx).2).1
        apply Finset.mem_erase.mpr
        constructor
        · intro hgb
          apply hxb
          have hv : x.val⁻¹ = b.val := congrArg Subtype.val hgb
          rw [hb_val] at hv
          have hxval : x.val = -1 := by
            have h2 := congrArg (fun y : K => y⁻¹) hv
            simpa using h2
          apply Subtype.ext
          show x.val = b.val
          rw [hb_val]
          exact hxval
        · apply Finset.mem_erase.mpr
          constructor
          · intro hga
            apply hxa
            have hv : x.val⁻¹ = a.val := congrArg Subtype.val hga
            rw [ha_val] at hv
            have hxval : x.val = 1 := by
              have h2 := congrArg (fun y : K => y⁻¹) hv
              simpa using h2
            apply Subtype.ext
            show x.val = a.val
            rw [ha_val]
            exact hxval
          · exact Finset.mem_univ _
      · intro x _
        apply Subtype.ext
        show (x.val⁻¹)⁻¹ = x.val
        exact inv_inv x.val
    have hmem_b : b ∈ Finset.univ.erase a :=
      Finset.mem_erase.mpr ⟨hab, Finset.mem_univ b⟩
    have step1 : a.val * (∏ x ∈ Finset.univ.erase a, x.val) =
        (∏ x : { x : K // x ≠ 0 }, x.val) :=
      Finset.mul_prod_erase Finset.univ
        (fun x : { x : K // x ≠ 0 } => x.val) (Finset.mem_univ a)
    have step2 : b.val * (∏ x ∈ (Finset.univ.erase a).erase b, x.val) =
        (∏ x ∈ Finset.univ.erase a, x.val) :=
      Finset.mul_prod_erase (Finset.univ.erase a)
        (fun x : { x : K // x ≠ 0 } => x.val) hmem_b
    calc (∏ x : { x : K // x ≠ 0 }, x.val)
        = a.val * (b.val * (∏ x ∈ (Finset.univ.erase a).erase b, x.val)) := by
          rw [← step1, ← step2]
      _ = -1 := by
          rw [hprod_s, ha_val, hb_val]
          simp
