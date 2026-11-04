import Mathlib.Topology.MetricSpace.Basic
import Mathlib.Topology.Compactness.Compact
import Mathlib.Topology.Order.Compact

theorem statement2 {M : Type*} [MetricSpace M] {A B : Set M}
    (hA : IsCompact A) (hB : IsCompact B)
    (hAB : Disjoint A B)
    (hA_ne : A.Nonempty) (hB_ne : B.Nonempty) :
    ∃ a0 : A, ∃ b0 : B, ∀ a : A, ∀ b : B,
      dist (a0 : M) (b0 : M) ≤ dist (a : M) (b : M) := by
  have hS : IsCompact (A ×ˢ B) := hA.prod hB
  have hS_ne : (A ×ˢ B).Nonempty := hA_ne.prod hB_ne
  have hcont : ContinuousOn (fun p : M × M => dist p.1 p.2) (A ×ˢ B) :=
    continuous_dist.continuousOn
  obtain ⟨⟨a0, b0⟩, hmem, hmin⟩ := IsCompact.exists_isMinOn hS hS_ne hcont
  obtain ⟨ha0, hb0⟩ := hmem
  refine ⟨⟨a0, ha0⟩, ⟨b0, hb0⟩, ?_⟩
  intro a b
  have hab : ((a : M), (b : M)) ∈ A ×ˢ B := Set.mk_mem_prod a.2 b.2
  exact hmin hab
