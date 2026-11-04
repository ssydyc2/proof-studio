import Mathlib.Topology.Basic
import Mathlib.Topology.Constructions
import Mathlib.Topology.Separation.Basic
import Mathlib.Topology.Separation.Hausdorff

theorem statement2 {X Y : Type*} [TopologicalSpace X] [TopologicalSpace Y] [T2Space Y]
    (A : Set X) (f : A → Y) (hf : Continuous f) :
    Subsingleton { g : closure A → Y //
      Continuous g ∧ ∀ a : A, g ⟨a.1, subset_closure a.2⟩ = f a } := by
  refine ⟨fun g h => ?_⟩
  have hdense :
      Dense (Set.range (fun a : A => (⟨a.1, subset_closure a.2⟩ : closure A))) := by
    intro x
    rw [mem_closure_iff]
    intro o ho hxo
    obtain ⟨U, hU, rfl⟩ := isOpen_induced_iff.mp ho
    have hnon : (U ∩ A).Nonempty := mem_closure_iff.mp x.2 U hU hxo
    obtain ⟨y, hyU, hyA⟩ := hnon
    refine ⟨⟨y, subset_closure hyA⟩, hyU, ⟨⟨y, hyA⟩, rfl⟩⟩
  have hsub :
      Set.range (fun a : A => (⟨a.1, subset_closure a.2⟩ : closure A)) ⊆
        {x : closure A | g.1 x = h.1 x} := by
    rintro x ⟨a, rfl⟩
    show g.1 ⟨a.1, subset_closure a.2⟩ = h.1 ⟨a.1, subset_closure a.2⟩
    rw [g.2.2 a, h.2.2 a]
  apply Subtype.ext
  funext x
  exact closure_minimal hsub (isClosed_eq g.2.1 h.2.1) (hdense x)
