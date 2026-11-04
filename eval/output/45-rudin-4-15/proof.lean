import Mathlib.Analysis.Normed.Field.Basic
import Mathlib.Order.Monotone.Basic
import Mathlib.Topology.ContinuousOn
import Mathlib.Topology.Maps.Basic
import Mathlib.Topology.MetricSpace.Basic
import Mathlib.Topology.Order.Basic
import Mathlib.Topology.Order.IntermediateValue
import Mathlib.Analysis.Calculus.MeanValue

theorem statement1 {f : ℝ → ℝ} (hf_continuous : Continuous f) (hf_open : IsOpenMap f) :
    Monotone f ∨ Antitone f := by
  have hinj_aux : ∀ ⦃a b : ℝ⦄, a < b → f a = f b → False := by
    intro a b hab heq
    have no_max : ∀ c ∈ Set.Ioo a b, (∀ x ∈ Set.Icc a b, f x ≤ f c) → False := by
      intro c hc hmax
      obtain ⟨ε, hεpos, hεsub⟩ :=
        Metric.isOpen_iff.mp (hf_open _ isOpen_Ioo) (f c) ⟨c, hc, rfl⟩
      have hdist : dist (f c + ε / 2) (f c) = ε / 2 := by
        rw [dist_eq_norm]
        have hsub : f c + ε / 2 - f c = ε / 2 := by ring
        rw [hsub, Real.norm_eq_abs]
        exact abs_of_nonneg (by linarith)
      have hmem : f c + ε / 2 ∈ f '' Set.Ioo a b :=
        hεsub (by rw [Metric.mem_ball, hdist]; linarith)
      obtain ⟨x, hxIoo, hxeq⟩ := hmem
      have hle : f x ≤ f c := hmax x ⟨hxIoo.1.le, hxIoo.2.le⟩
      linarith
    have no_min : ∀ c ∈ Set.Ioo a b, (∀ x ∈ Set.Icc a b, f c ≤ f x) → False := by
      intro c hc hmin
      obtain ⟨ε, hεpos, hεsub⟩ :=
        Metric.isOpen_iff.mp (hf_open _ isOpen_Ioo) (f c) ⟨c, hc, rfl⟩
      have hdist : dist (f c - ε / 2) (f c) = ε / 2 := by
        rw [dist_eq_norm]
        have hsub : f c - ε / 2 - f c = -(ε / 2) := by ring
        rw [hsub, norm_neg, Real.norm_eq_abs]
        exact abs_of_nonneg (by linarith)
      have hmem : f c - ε / 2 ∈ f '' Set.Ioo a b :=
        hεsub (by rw [Metric.mem_ball, hdist]; linarith)
      obtain ⟨x, hxIoo, hxeq⟩ := hmem
      have hge : f c ≤ f x := hmin x ⟨hxIoo.1.le, hxIoo.2.le⟩
      linarith
    by_cases h_ex : ∃ u ∈ Set.Ioo a b, f u ≠ f a
    · obtain ⟨u, huIoo, hune⟩ := h_ex
      have huIcc : u ∈ Set.Icc a b := ⟨huIoo.1.le, huIoo.2.le⟩
      rcases lt_or_gt_of_ne hune with hult | hugt
      · obtain ⟨d, hdIcc, hdMin⟩ :=
          isCompact_Icc.exists_isMinOn ⟨a, Set.left_mem_Icc.mpr hab.le⟩
            hf_continuous.continuousOn
        have hdMin' : ∀ x ∈ Set.Icc a b, f d ≤ f x := isMinOn_iff.mp hdMin
        have had : a < d := by
          rcases eq_or_lt_of_le hdIcc.1 with h_eq | h_lt
          · exfalso
            have hle : f d ≤ f u := hdMin' u huIcc
            rw [← h_eq] at hle
            linarith
          · exact h_lt
        have hdb : d < b := by
          rcases eq_or_lt_of_le hdIcc.2 with h_eq | h_lt
          · exfalso
            have hle : f d ≤ f u := hdMin' u huIcc
            rw [h_eq, ← heq] at hle
            linarith
          · exact h_lt
        exact no_min d ⟨had, hdb⟩ hdMin'
      · obtain ⟨c, hcIcc, hcMax⟩ :=
          isCompact_Icc.exists_isMaxOn ⟨a, Set.left_mem_Icc.mpr hab.le⟩
            hf_continuous.continuousOn
        have hcMax' : ∀ x ∈ Set.Icc a b, f x ≤ f c := isMaxOn_iff.mp hcMax
        have hac : a < c := by
          rcases eq_or_lt_of_le hcIcc.1 with h_eq | h_lt
          · exfalso
            have hle : f u ≤ f c := hcMax' u huIcc
            rw [← h_eq] at hle
            linarith
          · exact h_lt
        have hcb : c < b := by
          rcases eq_or_lt_of_le hcIcc.2 with h_eq | h_lt
          · exfalso
            have hle : f u ≤ f c := hcMax' u huIcc
            rw [h_eq, ← heq] at hle
            linarith
          · exact h_lt
        exact no_max c ⟨hac, hcb⟩ hcMax'
    · have hall : ∀ x ∈ Set.Ioo a b, f x = f a := by
        intro x hx
        by_contra hne
        exact h_ex ⟨x, hx, hne⟩
      have hmid : (a + b) / 2 ∈ Set.Ioo a b := ⟨by linarith, by linarith⟩
      apply no_max _ hmid
      intro x hxIcc
      have hxfa : f x = f a := by
        rcases eq_or_lt_of_le hxIcc.1 with h_eq | h_lt1
        · rw [← h_eq]
        · rcases eq_or_lt_of_le hxIcc.2 with h_eq2 | h_lt2
          · rw [h_eq2, ← heq]
          · exact hall x ⟨h_lt1, h_lt2⟩
      exact le_of_eq (hxfa.trans (hall _ hmid).symm)
  have hinj : Function.Injective f := by
    intro a b heq
    by_contra hne
    rcases lt_or_gt_of_ne hne with h | h
    · exact hinj_aux h heq
    · exact hinj_aux h heq.symm
  have no_top : ∀ {a b c : ℝ}, a < b → b < c → f a < f b → f c < f b → False := by
    intro a b c hab hbc h1 h2
    have hy_ex : ∃ y, f a < y ∧ f c < y ∧ y < f b := by
      by_cases hle : f a ≤ f c
      · obtain ⟨y, hy1, hy2⟩ := exists_between h2
        exact ⟨y, lt_of_le_of_lt hle hy1, hy1, hy2⟩
      · have hfc : f c < f a := not_le.mp hle
        obtain ⟨y, hy1, hy2⟩ := exists_between h1
        exact ⟨y, hy1, lt_trans hfc hy1, hy2⟩
    obtain ⟨y, hay, hcy, hyb⟩ := hy_ex
    obtain ⟨x1, hx1, hx1eq⟩ :=
      intermediate_value_Icc hab.le hf_continuous.continuousOn ⟨hay.le, hyb.le⟩
    obtain ⟨x2, hx2, hx2eq⟩ :=
      intermediate_value_Icc' hbc.le hf_continuous.continuousOn ⟨hcy.le, hyb.le⟩
    have hx1lt : x1 < b := by
      rcases eq_or_lt_of_le hx1.2 with h_eq | h_lt
      · exfalso
        rw [h_eq] at hx1eq
        linarith
      · exact h_lt
    have hx2gt : b < x2 := by
      rcases eq_or_lt_of_le hx2.1 with h_eq | h_lt
      · exfalso
        rw [← h_eq] at hx2eq
        linarith
      · exact h_lt
    have h_eq12 : x1 = x2 := hinj (hx1eq.trans hx2eq.symm)
    exact (ne_of_lt (lt_trans hx1lt hx2gt)) h_eq12
  have no_bot : ∀ {a b c : ℝ}, a < b → b < c → f b < f a → f b < f c → False := by
    intro a b c hab hbc h1 h2
    have hy_ex : ∃ y, y < f a ∧ y < f c ∧ f b < y := by
      by_cases hle : f a ≤ f c
      · obtain ⟨y, hy1, hy2⟩ := exists_between h1
        exact ⟨y, hy2, lt_of_lt_of_le hy2 hle, hy1⟩
      · have hfc : f c < f a := not_le.mp hle
        obtain ⟨y, hy1, hy2⟩ := exists_between h2
        exact ⟨y, lt_trans hy2 hfc, hy2, hy1⟩
    obtain ⟨y, hay, hcy, hfb⟩ := hy_ex
    obtain ⟨x1, hx1, hx1eq⟩ :=
      intermediate_value_Icc' hab.le hf_continuous.continuousOn ⟨hfb.le, hay.le⟩
    obtain ⟨x2, hx2, hx2eq⟩ :=
      intermediate_value_Icc hbc.le hf_continuous.continuousOn ⟨hfb.le, hcy.le⟩
    have hx1lt : x1 < b := by
      rcases eq_or_lt_of_le hx1.2 with h_eq | h_lt
      · exfalso
        rw [h_eq] at hx1eq
        linarith
      · exact h_lt
    have hx2gt : b < x2 := by
      rcases eq_or_lt_of_le hx2.1 with h_eq | h_lt
      · exfalso
        rw [← h_eq] at hx2eq
        linarith
      · exact h_lt
    have h_eq12 : x1 = x2 := hinj (hx1eq.trans hx2eq.symm)
    exact (ne_of_lt (lt_trans hx1lt hx2gt)) h_eq12
  have hbetween : ∀ a b c : ℝ, a < b → b < c →
      (f a < f b ∧ f b < f c) ∨ (f c < f b ∧ f b < f a) := by
    intro a b c hab hbc
    have hne_ab : f a ≠ f b := hinj.ne hab.ne
    have hne_bc : f b ≠ f c := hinj.ne hbc.ne
    rcases lt_or_gt_of_ne hne_ab with h1 | h1 <;>
      rcases lt_or_gt_of_ne hne_bc with h2 | h2
    · exact Or.inl ⟨h1, h2⟩
    · exfalso
      exact no_top hab hbc h1 h2
    · exfalso
      exact no_bot hab hbc h1 h2
    · exact Or.inr ⟨h2, h1⟩
  have mono_of : ∀ {a b : ℝ}, a < b → f a < f b → StrictMono f := by
    intro a b hab hfab
    have hA : ∀ t : ℝ, a < t → f a < f t := by
      intro t hat
      rcases lt_trichotomy t b with htb | htb | htb
      · rcases hbetween a t b hat htb with h | h
        · exact h.1
        · exfalso
          linarith [h.1, h.2, hfab]
      · rw [htb]
        exact hfab
      · rcases hbetween a b t hab htb with h | h
        · exact lt_trans hfab h.2
        · exfalso
          linarith [h.1, h.2, hfab]
    have hB : ∀ t : ℝ, t < b → f t < f b := by
      intro t htb
      rcases lt_trichotomy t a with hta | hta | hta
      · rcases hbetween t a b hta hab with h | h
        · exact lt_trans h.1 hfab
        · exfalso
          linarith [h.1, h.2, hfab]
      · rw [hta]
        exact hfab
      · rcases hbetween a t b hta htb with h | h
        · exact h.2
        · exfalso
          linarith [h.1, h.2, hfab]
    have hC : ∀ t : ℝ, t < a → f t < f a := by
      intro t hta
      rcases hbetween t a b hta hab with h | h
      · exact h.1
      · exfalso
        linarith [h.1, h.2, hfab]
    intro x y hxy
    by_cases hya : y ≤ a
    · have hyb : y < b := lt_of_le_of_lt hya hab
      rcases hbetween x y b hxy hyb with h | h
      · exact h.1
      · exfalso
        have hyfb : f y < f b := hB y hyb
        linarith [h.1, hyfb]
    · have hya' : a < y := not_le.mp hya
      by_cases hxa : x ≤ a
      · have hfay : f a < f y := hA y hya'
        have hfxa : f x ≤ f a := by
          rcases eq_or_lt_of_le hxa with h_eq | h_lt
          · exact le_of_eq (by rw [h_eq])
          · exact (hC x h_lt).le
        exact lt_of_le_of_lt hfxa hfay
      · have hxa' : a < x := not_le.mp hxa
        rcases hbetween a x y hxa' hxy with h | h
        · exact h.2
        · exfalso
          have hfax : f a < f x := hA x hxa'
          linarith [h.2, hfax]
  have anti_of : ∀ {a b : ℝ}, a < b → f b < f a → StrictAnti f := by
    intro a b hab hfab
    have hA : ∀ t : ℝ, a < t → f t < f a := by
      intro t hat
      rcases lt_trichotomy t b with htb | htb | htb
      · rcases hbetween a t b hat htb with h | h
        · exfalso
          linarith [h.1, h.2, hfab]
        · exact h.2
      · rw [htb]
        exact hfab
      · rcases hbetween a b t hab htb with h | h
        · exfalso
          linarith [h.1, hfab]
        · exact lt_trans h.1 hfab
    have hB : ∀ t : ℝ, t < b → f b < f t := by
      intro t htb
      rcases lt_trichotomy t a with hta | hta | hta
      · rcases hbetween t a b hta hab with h | h
        · exfalso
          linarith [h.2, hfab]
        · exact lt_trans h.1 h.2
      · rw [hta]
        exact hfab
      · rcases hbetween a t b hta htb with h | h
        · exfalso
          linarith [h.1, h.2, hfab]
        · exact h.1
    have hC : ∀ t : ℝ, t < a → f a < f t := by
      intro t hta
      rcases hbetween t a b hta hab with h | h
      · exfalso
        linarith [h.2, hfab]
      · exact h.2
    intro x y hxy
    by_cases hya : y ≤ a
    · have hyb : y < b := lt_of_le_of_lt hya hab
      rcases hbetween x y b hxy hyb with h | h
      · exfalso
        have hbfy : f b < f y := hB y hyb
        linarith [h.2, hbfy]
      · exact h.2
    · have hya' : a < y := not_le.mp hya
      by_cases hxa : x ≤ a
      · have hfya : f y < f a := hA y hya'
        have hfax : f a ≤ f x := by
          rcases eq_or_lt_of_le hxa with h_eq | h_lt
          · exact le_of_eq (by rw [h_eq])
          · exact (hC x h_lt).le
        exact lt_of_lt_of_le hfya hfax
      · have hxa' : a < x := not_le.mp hxa
        rcases hbetween a x y hxa' hxy with h | h
        · exfalso
          have hfxa : f x < f a := hA x hxa'
          linarith [h.1, hfxa]
        · exact h.1
  have h01 : (0 : ℝ) < 1 := zero_lt_one
  have hne01 : f 0 ≠ f 1 := hinj.ne h01.ne
  rcases lt_or_gt_of_ne hne01 with h | h
  · exact Or.inl (mono_of h01 h).monotone
  · exact Or.inr (anti_of h01 h).antitone
