import Mathlib.Algebra.Group.Equiv.Defs
import Mathlib.Data.Fintype.Card
import Mathlib.Data.Set.Card
import Mathlib.Algebra.Group.Basic
import Mathlib.Data.Finset.Card
import Mathlib.Data.Finset.Image

theorem statement1 (G : Type*) [Group G] [Fintype G] (φ : MulAut G)
    (h : 3 * Fintype.card G < 4 * ({x : G | ⇑φ x = x⁻¹} : Set G).ncard) :
    (∀ y : G, ⇑φ y = y⁻¹) ∧ ∀ a b : G, a * b = b * a := by
  classical
  set T : Finset G := Finset.univ.filter (fun x => ⇑φ x = x⁻¹) with hTdef
  have memT : ∀ a : G, a ∈ T ↔ ⇑φ a = a⁻¹ := by
    intro a
    rw [hTdef]
    simp
  have hset : ({x : G | ⇑φ x = x⁻¹} : Set G) = (T : Set G) := by
    ext a
    simp only [Set.mem_setOf_eq, Finset.mem_coe]
    exact (memT a).symm
  have hcardT : T.card = ({x : G | ⇑φ x = x⁻¹} : Set G).ncard := by
    rw [hset]
    simp
  have hTineq : 3 * Fintype.card G < 4 * T.card := by
    rw [hcardT]
    exact h
  have inter_nonempty_of_card_eq :
      ∀ {A B : Finset G} {c : ℕ},
        Fintype.card G < 2 * c → A.card = c → B.card = c → (A ∩ B).Nonempty := by
    intro A B c hc hA hB
    have hunion : (A ∪ B).card ≤ Fintype.card G := by
      calc (A ∪ B).card ≤ Finset.univ.card :=
            Finset.card_le_card (Finset.subset_univ _)
        _ = Fintype.card G := Finset.card_univ
    have hsum : (A ∪ B).card + (A ∩ B).card = A.card + B.card :=
      Finset.card_union_add_card_inter A B
    have hpos : 0 < (A ∩ B).card := by omega
    exact Finset.card_pos.mp hpos
  have hcentral : ∀ x : G, x ∈ T → ∀ g : G, x * g = g * x := by
    intro x hx g
    have hx_eq : ⇑φ x = x⁻¹ := (memT x).mp hx
    set A : Finset G := Finset.image (fun y : G => x * y) T with hAdef
    have hinjx : Function.Injective (fun y : G => x * y) := by
      intro a b hab
      exact mul_left_cancel hab
    have hAcard : A.card = T.card := by
      rw [hAdef]
      exact Finset.card_image_of_injective T hinjx
    have hUgt : Fintype.card G < 2 * (A ∩ T).card := by
      have hunion : (A ∪ T).card ≤ Fintype.card G := by
        calc (A ∪ T).card ≤ Finset.univ.card :=
              Finset.card_le_card (Finset.subset_univ _)
          _ = Fintype.card G := Finset.card_univ
      have hsum : (A ∪ T).card + (A ∩ T).card = A.card + T.card :=
        Finset.card_union_add_card_inter A T
      omega
    have hcommU : ∀ z : G, z ∈ A ∩ T → z * x = x * z := by
      intro z hz
      obtain ⟨hzA, hzT⟩ := Finset.mem_inter.mp hz
      rw [hAdef] at hzA
      obtain ⟨y, hyT, hy_eq⟩ := Finset.mem_image.mp hzA
      have hy_eqφ : ⇑φ y = y⁻¹ := (memT y).mp hyT
      have hz_eqφ : ⇑φ z = z⁻¹ := (memT z).mp hzT
      have hkey : x⁻¹ * y⁻¹ = y⁻¹ * x⁻¹ := by
        have h1 : ⇑φ z = x⁻¹ * y⁻¹ := by
          rw [← hy_eq, map_mul, hx_eq, hy_eqφ]
        have h2 : ⇑φ z = y⁻¹ * x⁻¹ := by
          calc ⇑φ z = z⁻¹ := hz_eqφ
            _ = (x * y)⁻¹ := by rw [hy_eq]
            _ = y⁻¹ * x⁻¹ := by rw [mul_inv_rev]
        exact h1.symm.trans h2
      have hxy_comm : y * x = x * y := by
        have hinv : (y * x)⁻¹ = (x * y)⁻¹ := by
          rw [mul_inv_rev, mul_inv_rev]
          exact hkey
        exact inv_inj.mp hinv
      calc z * x = (x * y) * x := by rw [hy_eq]
        _ = x * (y * x) := by rw [mul_assoc]
        _ = x * (x * y) := by rw [hxy_comm]
        _ = x * z := by rw [hy_eq]
    have hinjg : Function.Injective (fun u : G => g * u) := by
      intro a b hab
      exact mul_left_cancel hab
    have hinter :=
      inter_nonempty_of_card_eq hUgt rfl
        (Finset.card_image_of_injective (A ∩ T) hinjg)
    obtain ⟨u1, hu1⟩ := hinter
    obtain ⟨hu1U, hu1img⟩ := Finset.mem_inter.mp hu1
    obtain ⟨u2, hu2U, hu2eq⟩ := Finset.mem_image.mp hu1img
    have hg_eq : g = u1 * u2⁻¹ := by
      rw [← hu2eq, mul_assoc, mul_inv_cancel, mul_one]
    have inv_comm : ∀ z : G, z * x = x * z → z⁻¹ * x = x * z⁻¹ := by
      intro z hzcomm
      have key : z * (z⁻¹ * x) = z * (x * z⁻¹) := by
        calc z * (z⁻¹ * x) = x := by
              rw [← mul_assoc, mul_inv_cancel, one_mul]
          _ = z * (x * z⁻¹) := by
              rw [← mul_assoc, hzcomm, mul_assoc, mul_inv_cancel, mul_one]
      exact mul_left_cancel key
    have hgx : g * x = x * g := by
      rw [hg_eq]
      calc u1 * u2⁻¹ * x = u1 * (u2⁻¹ * x) := by rw [mul_assoc]
        _ = u1 * (x * u2⁻¹) := by rw [inv_comm u2 (hcommU u2 hu2U)]
        _ = (u1 * x) * u2⁻¹ := by rw [mul_assoc]
        _ = (x * u1) * u2⁻¹ := by rw [hcommU u1 hu1U]
        _ = x * (u1 * u2⁻¹) := by rw [mul_assoc]
    exact hgx.symm
  have hprod :
      ∀ g : G, ∃ x : G, x ∈ T ∧ ∃ y : G, y ∈ T ∧ g = x * y := by
    intro g
    have hTgt : Fintype.card G < 2 * T.card := by omega
    have hinj : Function.Injective (fun y : G => g * y⁻¹) := by
      intro a b hab
      have h1 : a⁻¹ = b⁻¹ := mul_left_cancel hab
      exact inv_inj.mp h1
    have hinter :=
      inter_nonempty_of_card_eq hTgt rfl
        (Finset.card_image_of_injective T hinj)
    obtain ⟨x, hx⟩ := hinter
    obtain ⟨hxT, hximg⟩ := Finset.mem_inter.mp hx
    obtain ⟨y, hyT, hy_eq⟩ := Finset.mem_image.mp hximg
    refine ⟨x, hxT, y, hyT, ?_⟩
    calc g = g * y⁻¹ * y := by
          rw [mul_assoc, inv_mul_cancel, mul_one]
      _ = x * y := by rw [hy_eq]
  have hall : ∀ g : G, ⇑φ g = g⁻¹ := by
    intro g
    obtain ⟨x, hxT, y, hyT, hg⟩ := hprod g
    have hx_eq : ⇑φ x = x⁻¹ := (memT x).mp hxT
    have hy_eq : ⇑φ y = y⁻¹ := (memT y).mp hyT
    have hxy : x * y = y * x := hcentral x hxT y
    calc ⇑φ g = ⇑φ x * ⇑φ y := by rw [hg, map_mul]
      _ = x⁻¹ * y⁻¹ := by rw [hx_eq, hy_eq]
      _ = (y * x)⁻¹ := by rw [mul_inv_rev]
      _ = (x * y)⁻¹ := by rw [hxy]
      _ = g⁻¹ := by rw [hg]
  exact ⟨hall, fun a b => hcentral a ((memT a).mpr (hall a)) b⟩
