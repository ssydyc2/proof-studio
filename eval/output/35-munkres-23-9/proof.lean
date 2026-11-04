import Mathlib.Topology.Connected.Basic
import Mathlib.Topology.Constructions
import Mathlib.Data.Set.Prod

theorem statement2 {X Y : Type*} [TopologicalSpace X] [TopologicalSpace Y]
    [ConnectedSpace X] [ConnectedSpace Y] (A : Set X) (B : Set Y)
    (hA : ∃ x, x ∉ A) (hB : ∃ y, y ∉ B) :
    ConnectedSpace ↥((A ×ˢ B)ᶜ : Set (X × Y)) := by
  obtain ⟨a0, ha0⟩ := hA
  obtain ⟨b0, hb0⟩ := hB
  have hzS : (a0, b0) ∈ ((A ×ˢ B)ᶜ : Set (X × Y)) := by
    simp [ha0]
  have hV : ∀ a : X, IsPreconnected (({a} : Set X) ×ˢ (Set.univ : Set Y)) :=
    fun a => (isConnected_singleton.prod isConnected_univ).2
  have hH : ∀ b : Y, IsPreconnected ((Set.univ : Set X) ×ˢ ({b} : Set Y)) :=
    fun b => (isConnected_univ.prod isConnected_singleton).2
  have hVsub : ∀ a : X, a ∉ A →
      (({a} : Set X) ×ˢ (Set.univ : Set Y)) ⊆ ((A ×ˢ B)ᶜ : Set (X × Y)) := by
    intro a ha p hp
    obtain ⟨x, y⟩ := p
    rcases hp with ⟨hp1, _hp2⟩
    have hx : x = a := Set.mem_singleton_iff.mp hp1
    simp [hx, ha]
  have hHsub : ∀ b : Y, b ∉ B →
      ((Set.univ : Set X) ×ˢ ({b} : Set Y)) ⊆ ((A ×ˢ B)ᶜ : Set (X × Y)) := by
    intro b hb p hp
    obtain ⟨x, y⟩ := p
    rcases hp with ⟨_hp1, hp2⟩
    have hy : y = b := Set.mem_singleton_iff.mp hp2
    simp [hy, hb]
  have hpre : IsPreconnected ((A ×ˢ B)ᶜ : Set (X × Y)) := by
    intro u v hu hv hcover hune hvne
    obtain ⟨⟨xu, yu⟩, hpuS, hpuU⟩ := hune
    obtain ⟨⟨xv, yv⟩, hpvS, hpvU⟩ := hvne
    by_cases hint : (((A ×ˢ B)ᶜ : Set (X × Y)) ∩ (u ∩ v)).Nonempty
    · exact hint
    · have auxU : ∀ T : Set (X × Y), IsPreconnected T →
          T ⊆ ((A ×ˢ B)ᶜ : Set (X × Y)) → (T ∩ u).Nonempty → T ⊆ u := by
        intro T hT hTS hTu q hq
        have hqcover : q ∈ u ∪ v := hcover (hTS hq)
        rcases hqcover with hqu | hqv
        · exact hqu
        · exfalso
          have hTv : (T ∩ v).Nonempty := ⟨q, hq, hqv⟩
          have hinter := hT u v hu hv (fun x hx => hcover (hTS hx)) hTu hTv
          obtain ⟨r, hrT, hru, hrv⟩ := hinter
          exact hint ⟨r, hTS hrT, hru, hrv⟩
      have auxV : ∀ T : Set (X × Y), IsPreconnected T →
          T ⊆ ((A ×ˢ B)ᶜ : Set (X × Y)) → (T ∩ v).Nonempty → T ⊆ v := by
        intro T hT hTS hTv q hq
        have hqcover : q ∈ u ∪ v := hcover (hTS hq)
        rcases hqcover with hqu | hqv
        · exfalso
          have hTu : (T ∩ u).Nonempty := ⟨q, hq, hqu⟩
          have hinter := hT u v hu hv (fun x hx => hcover (hTS hx)) hTu hTv
          obtain ⟨r, hrT, hru, hrv⟩ := hinter
          exact hint ⟨r, hTS hrT, hru, hrv⟩
        · exact hqv
      have hzU : (a0, b0) ∈ u := by
        have hor : xu ∉ A ∨ yu ∉ B := by
          have hnot : (xu, yu) ∉ A ×ˢ B := hpuS
          by_cases hx : xu ∈ A
          · exact Or.inr (fun hy => hnot (Set.mk_mem_prod hx hy))
          · exact Or.inl hx
        rcases hor with hx | hy
        · have hsub1 : (({xu} : Set X) ×ˢ (Set.univ : Set Y)) ⊆ u :=
            auxU _ (hV xu) (hVsub xu hx) ⟨(xu, yu), by simp, hpuU⟩
          have hpoint : (xu, b0) ∈ u := hsub1 (by simp)
          have hsub2 : ((Set.univ : Set X) ×ˢ ({b0} : Set Y)) ⊆ u :=
            auxU _ (hH b0) (hHsub b0 hb0) ⟨(xu, b0), by simp, hpoint⟩
          exact hsub2 (by simp)
        · have hsub1 : ((Set.univ : Set X) ×ˢ ({yu} : Set Y)) ⊆ u :=
            auxU _ (hH yu) (hHsub yu hy) ⟨(xu, yu), by simp, hpuU⟩
          have hpoint : (a0, yu) ∈ u := hsub1 (by simp)
          have hsub2 : (({a0} : Set X) ×ˢ (Set.univ : Set Y)) ⊆ u :=
            auxU _ (hV a0) (hVsub a0 ha0) ⟨(a0, yu), by simp, hpoint⟩
          exact hsub2 (by simp)
      have hzV : (a0, b0) ∈ v := by
        have hor : xv ∉ A ∨ yv ∉ B := by
          have hnot : (xv, yv) ∉ A ×ˢ B := hpvS
          by_cases hx : xv ∈ A
          · exact Or.inr (fun hy => hnot (Set.mk_mem_prod hx hy))
          · exact Or.inl hx
        rcases hor with hx | hy
        · have hsub1 : (({xv} : Set X) ×ˢ (Set.univ : Set Y)) ⊆ v :=
            auxV _ (hV xv) (hVsub xv hx) ⟨(xv, yv), by simp, hpvU⟩
          have hpoint : (xv, b0) ∈ v := hsub1 (by simp)
          have hsub2 : ((Set.univ : Set X) ×ˢ ({b0} : Set Y)) ⊆ v :=
            auxV _ (hH b0) (hHsub b0 hb0) ⟨(xv, b0), by simp, hpoint⟩
          exact hsub2 (by simp)
        · have hsub1 : ((Set.univ : Set X) ×ˢ ({yv} : Set Y)) ⊆ v :=
            auxV _ (hH yv) (hHsub yv hy) ⟨(xv, yv), by simp, hpvU⟩
          have hpoint : (a0, yv) ∈ v := hsub1 (by simp)
          have hsub2 : (({a0} : Set X) ×ˢ (Set.univ : Set Y)) ⊆ v :=
            auxV _ (hV a0) (hVsub a0 ha0) ⟨(a0, yv), by simp, hpoint⟩
          exact hsub2 (by simp)
      exact absurd ⟨(a0, b0), hzS, hzU, hzV⟩ hint
  have hconn : IsConnected ((A ×ˢ B)ᶜ : Set (X × Y)) :=
    ⟨⟨(a0, b0), hzS⟩, hpre⟩
  exact isConnected_iff_connectedSpace.mp hconn
