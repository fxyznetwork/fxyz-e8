/**
 * E8 → H4 Folding — Pure Math Module
 *
 * Implements the explicit symmetric 8×8 folding matrix `H4_FOLD_MATRIX` from
 * J. G. Moxness, "The 3D Visualization of E8 using an H4 Folding Matrix"
 * (2014), Eq. (1). The matrix has the structural identity H4_FOLD = H4_FOLDᵀ
 * (symmetric, quaternion-octonion Cayley-Dickson-like) and rotates 8D E8
 * vertices into four 4D copies of the H4 600-cell.
 *
 * Per Moxness 2019 "Unimodular rotation of E8 to H4 600-cells":
 *   - Only the first 4 rows are needed for folding E8 → H4 by dot product
 *   - Using the full 8×8 produces 4 copies of H4 600-cell:
 *     (1 ⊕ φ)(H4_L ⊕ H4_R)
 *   - Dividing by 2√φ produces H4_UNI_MATRIX with Det = 1
 *
 * Per Moxness QM/QC preprint Fig. 1 caption: H4 sub-lattice = rings {1,3,4,5},
 * H4φ sub-lattice = rings {2,6,7,8} (1-indexed innermost→outermost). This is
 * encoded in `RING_TO_SUBLATTICE` in e8-constants.ts.
 *
 * ZERO Three.js dependency — pure linear algebra.
 */

import {
	PHI,
	PHI_INV,
	RING_TO_SUBLATTICE,
	type SubLattice,
} from "./e8-constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Big golden ratio Φ = (1+√5)/2 ≈ 1.618 (alias of PHI from e8-constants). */
const Phi = PHI;

/** Small golden ratio φ = 1/Φ = Φ−1 ≈ 0.618. */
const phi = PHI_INV;

/** φ² = (1/Φ)² ≈ 0.382. */
const phi2 = phi * phi;

// ---------------------------------------------------------------------------
// H4_fold matrix (Moxness 2014 Eq. 1)
// ---------------------------------------------------------------------------

/**
 * The H4 folding matrix from Moxness 2014 Eq. 1.
 *
 * 8×8 symmetric matrix with entries in {0, 1, ±φ, Φ, φ²}. Rotates an 8D E8
 * vertex into four 4D copies of H4 600-cell when applied as dot products
 * row-wise; first 4 rows alone fold E8 → H4 (the L-half). Symmetry
 * H4_FOLD_MATRIX = H4_FOLD_MATRIXᵀ encodes the quaternion-octonion structure
 * referenced in the paper.
 *
 * Det per paper = (2√φ)⁸ ≈ 37.349. Eigenvalues = 2{ST, φST} where the
 * "space-time signature" ST = (−1, 1, 1, 1).
 */
export const H4_FOLD_MATRIX: readonly (readonly number[])[] = [
	[Phi, 0, 0, 0, phi2, 0, 0, 0],
	[0, phi, 1, 0, 0, -phi, 1, 0],
	[0, 1, 0, phi, 0, 1, 0, -phi],
	[0, 0, phi, 1, 0, 0, -phi, 1],
	[phi2, 0, 0, 0, Phi, 0, 0, 0],
	[0, -phi, 1, 0, 0, phi, 1, 0],
	[0, 1, 0, -phi, 0, 1, 0, phi],
	[0, 0, -phi, 1, 0, 0, phi, 1],
] as const;

/**
 * The unimodular form of H4_fold: H4_UNI = H4_FOLD / (2√φ).
 *
 * Has Det = 1 (volume-preserving under E8 ↔ H4 rotation). Per Moxness 2019
 * Eq. 2 / 2020 hulls Eq. 1. Numerically:
 *   2√φ = 2 · √0.618… ≈ 1.5723
 *   H4_UNI[0][0] = Φ / 2√φ ≈ 1.029
 *   H4_UNI[0][4] = φ² / 2√φ ≈ 0.243
 *   H4_UNI[1][1] = φ / 2√φ ≈ 0.393
 */
const TWO_SQRT_PHI = 2 * Math.sqrt(phi);

export const H4_UNI_MATRIX: readonly (readonly number[])[] = H4_FOLD_MATRIX.map(
	(row) => row.map((x) => x / TWO_SQRT_PHI),
);

// ---------------------------------------------------------------------------
// Folding operations
// ---------------------------------------------------------------------------

/**
 * Fold an 8D E8 vertex into four 4D coordinates by dot-product against the
 * 8 rows of H4_FOLD. The 8 outputs split into:
 *   - left[0..3]: H4 (rows 0..3, the L-half)
 *   - right[0..3]: H4Φ (rows 4..7, the R-half scaled by Φ relative to L)
 *
 * Per Moxness 2019: "Only the first 4 rows are needed for folding E8 to H4."
 * Using all 8 rows gives the 4-copy structure.
 *
 * @param v8D — 8-element coordinate vector (E8 root or scaled version)
 * @returns { left, right } — both length-4 arrays
 */
export function foldE8To4D(v8D: readonly number[]): {
	left: number[];
	right: number[];
} {
	if (v8D.length !== 8) {
		throw new Error(`foldE8To4D: expected length-8 vector, got ${v8D.length}`);
	}
	const left = new Array<number>(4);
	const right = new Array<number>(4);
	for (let r = 0; r < 4; r++) {
		const row = H4_FOLD_MATRIX[r];
		let s = 0;
		for (let c = 0; c < 8; c++) s += row[c] * v8D[c];
		left[r] = s;
	}
	for (let r = 4; r < 8; r++) {
		const row = H4_FOLD_MATRIX[r];
		let s = 0;
		for (let c = 0; c < 8; c++) s += row[c] * v8D[c];
		right[r - 4] = s;
	}
	return { left, right };
}

/**
 * Classify a Petrie ring index (0..7, innermost→outermost) into its H4 vs
 * H4φ sub-lattice membership per Moxness QM/QC Fig. 1.
 *
 * H4 = rings {0, 2, 3, 4} (Moxness 1, 3, 4, 5)
 * H4φ = rings {1, 5, 6, 7} (Moxness 2, 6, 7, 8)
 */
export function classifyRingSubLattice(ring: number): SubLattice {
	if (ring < 0 || ring >= RING_TO_SUBLATTICE.length) {
		throw new Error(
			`classifyRingSubLattice: ring out of range [0..7], got ${ring}`,
		);
	}
	return RING_TO_SUBLATTICE[ring];
}

// ---------------------------------------------------------------------------
// Matrix-lerp: I → H4_FOLD (Moxness 2019 unimodular rotation)
// ---------------------------------------------------------------------------

/**
 * Compute the 3D positions of the 240 E8 roots under the matrix-lerp
 * `M(t) = (1−t)·I + t·H4_FOLD`, projected to R³ via the canonical
 * H4_UNI fold + ST-axis drop pipeline.
 *
 * This is the explicit "unimodular rotation E8 → H4 600-cells" Moxness
 * 2019 names. At t=0 the output equals `projectTo3DViaFold(roots)` — the
 * canonical Petrie / 8-shell static frame. At t=1 the 240 points have
 * migrated to the two superimposed H4 600-cells (one scaled by Φ
 * relative to the other) that ARE E8's structural identity per
 * Wikipedia `4_21_polytope` ("240 vertices project as two copies of
 * the 120 vertices of the 600-cell, one copy smaller (scaled by golden
 * ratio) than the other").
 *
 * Det of M(t) interpolates from 1 (identity) to (2√φ)⁸ ≈ 37.349
 * (H4_FOLD), so volumes are not preserved through the lerp; the
 * unimodular form would multiply by 1/(2√φ)⁸ at t=1 to land on Det=1
 * H4_UNI. We use H4_FOLD (not H4_UNI) for the lerp so the scale
 * stays consistent with the static Petrie projection at the start
 * AND the published two-600-cell structure at the end. Both ends are
 * canonical — the interpolation between them animates the
 * "unimodular rotation" Moxness 2019 names.
 *
 * Per-frame cost on the hot path:
 *   - 240 roots × 8 columns × 2 mat-vec (H4_FOLD then H4_UNI) ≈ 30 720
 *     scalar mults. Trivial — under 0.1 ms on any modern CPU.
 *
 * Output buffer is mutated in place to avoid per-frame allocation. Caller
 * supplies a Float32Array of length ≥ roots.length × 3.
 */
export function computeE8MatrixLerpPositions(
	t: number,
	roots: ReadonlyArray<readonly number[]>,
	out: Float32Array,
): void {
	const tClamped = Math.max(0, Math.min(1, t));
	const oneMinusT = 1 - tClamped;

	// Scratch for one root's 8D lerped coordinate. Re-used per iteration.
	const lerped8d = new Array<number>(8);

	for (let i = 0; i < roots.length; i++) {
		const root = roots[i];
		if (root.length !== 8) {
			throw new Error(
				`computeE8MatrixLerpPositions: expected 8D roots, got ${root.length} at index ${i}`,
			);
		}

		// 1. Compute (H4_FOLD @ root) via 8 dot products, then lerp with
		//    the identity-applied root (= root itself).
		for (let r = 0; r < 8; r++) {
			const row = H4_FOLD_MATRIX[r];
			let folded = 0;
			for (let c = 0; c < 8; c++) folded += row[c] * root[c];
			lerped8d[r] = oneMinusT * root[r] + tClamped * folded;
		}

		// 2. Apply H4_UNI first 4 rows to fold from 8D to 4D (H4_L space).
		//    Inline so we don't allocate a per-iteration array.
		let h4l1 = 0;
		let h4l2 = 0;
		let h4l3 = 0;
		// Skip h4l0 — that's the ST-axis component we drop in step 3.
		const row1 = H4_UNI_MATRIX[1];
		const row2 = H4_UNI_MATRIX[2];
		const row3 = H4_UNI_MATRIX[3];
		for (let c = 0; c < 8; c++) {
			const v = lerped8d[c];
			h4l1 += row1[c] * v;
			h4l2 += row2[c] * v;
			h4l3 += row3[c] * v;
		}

		// 3. Write 3D position. ST-axis drop = use rows 1, 2, 3 of H4_UNI.
		const o = i * 3;
		out[o + 0] = h4l1;
		out[o + 1] = h4l2;
		out[o + 2] = h4l3;
	}
}

// ---------------------------------------------------------------------------
// CNOT + SWAP + Fibonacci derivation (Moxness 2019 Sec. III)
// ---------------------------------------------------------------------------

/**
 * The 4×4 CNOT (controlled-NOT) gate in qubit basis order |00⟩,|01⟩,|10⟩,|11⟩.
 * Used by Moxness 2019 to reconstruct H4_FOLD from quantum-computing
 * primitives + a Fibonacci recursion.
 */
export const CNOT: readonly (readonly number[])[] = [
	[1, 0, 0, 0],
	[0, 1, 0, 0],
	[0, 0, 0, 1],
	[0, 0, 1, 0],
] as const;

/**
 * The 4×4 SWAP gate in qubit basis order. Swaps |01⟩ ↔ |10⟩.
 */
export const SWAP: readonly (readonly number[])[] = [
	[1, 0, 0, 0],
	[0, 0, 1, 0],
	[0, 1, 0, 0],
	[0, 0, 0, 1],
] as const;
