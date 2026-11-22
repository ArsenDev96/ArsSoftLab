# Station animation specification

Requirements that apply to every station's hover and selection animation. Each milestone's NOTES.md records how it meets them; a requirement marked **approval gate** must be signed off by the user before the technique is reused on another station.

## SA-1. Transparent lift gap (approval gate)

When any station lifts, the gap exposed underneath must reveal a sharp, continuous laboratory floor.

1. **Accurate cutouts.** Movable stations use accurate transparent cutouts.
2. **Clean reconstruction.** The occluded floor is reconstructed without visible blur, smearing, mirrored repetition, or artificial colour patches.
3. **Static floor.** The floor stays stationary while the platform lifts.
4. **Grounded light.** Grounded shadows and reflections are preserved.
5. **Clean edges.** The station's edges stay sharp and correctly composited.
6. **No concealment.** Reconstruction defects are not hidden with oversized shadows or dark overlays.
7. **Verification.** The gap is checked at normal desktop size (1648 × 928) and at 3× zoom. To show the shadow is not concealing anything, the 3× check is made twice: once as shipped, and once with the contact shadow, penumbra and under-light turned off.

If the flat illustration cannot support a convincing reconstruction, report that limitation and propose a better layered-background solution. Don't apply more blur.

**Constraints.** Existing power connections and Playground gameplay must be preserved.

**Approval gate.** The user must approve the lift gap's appearance before the technique is reused on other stations.

### Status

| Station | Lifts | SA-1 |
|---|---|---|
| Playground | 18 px (M1.3E.2–E.3) | **Approved M1.3E version: does not meet 2 or 6.** Audit: [`lift-gap-audit/NOTES.md`](lift-gap-audit/NOTES.md). |
| Playground, experimental | 18 px (M1.3H, behind the `NEXT_PUBLIC_PLAYGROUND_LAYERED` flag) | **Awaiting your review.** No mirroring or smear, and a light shadow (max 0.5), checked with the shadow off. At 3× it's still slightly smoother and greyer than the real floor. The full clean background behind the cabinet is not convincing. Notes: [`m1.3h/NOTES.md`](m1.3h/NOTES.md). |
| Playground, experimental 2.5D | 18 px (M1.3I, behind `NEXT_PUBLIC_LAB_LAYERED`) | **Awaiting your review.** The same gap floor as M1.3H, now with a faint foundation joint, contact and ambient shadows graded by height (contact at most 0.5, easing to 0.55 of that at full height), and a strip reflection that moves. Checked with shadows off at 3×. The floor still needs painted artwork (`m1.3i/background-requirements.md`). Notes: [`m1.3i/NOTES.md`](m1.3i/NOTES.md). |
| Engineering | 5 px (M1.2.2) | Not audited; it uses the same class of reconstruction. |
| Educational, Creative, Experience | No lift | n/a. Don't add a lift until SA-1 is approved. |
