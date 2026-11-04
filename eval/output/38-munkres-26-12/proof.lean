import Mathlib.Topology.Basic
import Mathlib.Topology.Compactness.Compact
import Mathlib.Topology.Maps.Basic

theorem statement2 {X Y : Type*} [TopologicalSpace X] [TopologicalSpace Y]
    (f : X → Y) (hf_continuous : Continuous f)
    (hf_surjective : Function.Surjective f) (hf_closed : IsClosedMap f)
    (hf_fibers : ∀ y : Y, IsCompact (f ⁻¹' {y}))
    (hY_compact : IsCompact (Set.univ : Set Y)) :
    IsCompact (Set.univ : Set X) := by
  classical
  rw [isCompact_iff_finite_subcover]
  intro ι U hU_open hU_cover
  have h_fiber : ∀ y : Y, ∃ t : Finset ι, f ⁻¹' {y} ⊆ ⋃ i ∈ t, U i := by
    intro y
    exact (hf_fibers y).elim_finite_subcover U hU_open
      (fun x _ => hU_cover (Set.mem_univ x))
  choose t ht using h_fiber
  have hV_open : ∀ y : Y, IsOpen ((f '' (⋃ i ∈ t y, U i)ᶜ)ᶜ) := by
    intro y
    have hopen : IsOpen (⋃ i ∈ t y, U i) := by
      apply isOpen_iUnion
      intro i
      apply isOpen_iUnion
      intro _
      exact hU_open i
    exact (hf_closed _ hopen.isClosed_compl).isOpen_compl
  have hV_mem : ∀ y : Y, y ∈ (f '' (⋃ i ∈ t y, U i)ᶜ)ᶜ := by
    intro y
    show y ∉ f '' (⋃ i ∈ t y, U i)ᶜ
    rintro ⟨x, hx, hfx⟩
    apply hx
    apply ht y
    rw [Set.mem_preimage, Set.mem_singleton_iff]
    exact hfx
  have hV_cover : (Set.univ : Set Y) ⊆
      ⋃ y : Y, (f '' (⋃ i ∈ t y, U i)ᶜ)ᶜ := by
    intro y _
    exact Set.mem_iUnion.mpr ⟨y, hV_mem y⟩
  obtain ⟨sY, hsY⟩ := hY_compact.elim_finite_subcover _ hV_open hV_cover
  refine ⟨sY.biUnion t, ?_⟩
  intro x _
  have hfx_mem : f x ∈ ⋃ y ∈ sY, (f '' (⋃ i ∈ t y, U i)ᶜ)ᶜ :=
    hsY (Set.mem_univ (f x))
  obtain ⟨y, hy⟩ := Set.mem_iUnion.mp hfx_mem
  obtain ⟨hy_sY, hfy⟩ := Set.mem_iUnion.mp hy
  have hxU : x ∈ ⋃ i ∈ t y, U i := by
    by_contra hx_not
    exact hfy ⟨x, hx_not, rfl⟩
  obtain ⟨i, hi⟩ := Set.mem_iUnion.mp hxU
  obtain ⟨hi_t, hx_i⟩ := Set.mem_iUnion.mp hi
  apply Set.mem_iUnion.mpr
  refine ⟨i, ?_⟩
  apply Set.mem_iUnion.mpr
  exact ⟨Finset.mem_biUnion.mpr ⟨y, hy_sY, hi_t⟩, hx_i⟩
