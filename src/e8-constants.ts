/**
 * E8 Shared Constants - Pure Math, Zero Dependencies
 *
 * Canonical constants derived from Moxness (2023-2024) papers and the E8 lattice.
 * Used across the E8/H4 geometry, projection, and folding modules in this package.
 */

// ---------------------------------------------------------------------------
// Golden Ratio
// ---------------------------------------------------------------------------

/** The golden ratio φ = (1 + √5) / 2 ≈ 1.618 */
export const PHI = (1 + Math.sqrt(5)) / 2;

/** Inverse golden ratio 1/φ = φ - 1 ≈ 0.618 */
export const PHI_INV = PHI - 1;

// ---------------------------------------------------------------------------
// E8 Theta Function Coefficients
// ---------------------------------------------------------------------------

/**
 * E8 lattice theta function: Θ_E8(q) = 1 + 240q + 2160q² + 6720q³ + ...
 *
 * Index i gives the number of E8 lattice points at squared norm 2i.
 * These are EXACT numbers (Conway & Sloane, Chapter 4, Table 4.9).
 */
export const THETA_COEFFICIENTS = [
	1, // norm²=0: origin (1 point)
	240, // norm²=2: root vectors (the 240 roots)
	2160, // norm²=4: 2nd shell
	6720, // norm²=6: 3rd shell
	17520, // norm²=8: 4th shell
	30240, // norm²=10: 5th shell
	60480, // norm²=12: 6th shell
	82560, // norm²=14: 7th shell
	140400, // norm²=16: 8th shell
] as const;

// ---------------------------------------------------------------------------
// Moxness Projection Bases (corpus papers 2014/2019/2020/undated; nearest 2020 hulls Eq. 5)
// ---------------------------------------------------------------------------

/**
 * 3D projection basis transcribed from the Moxness corpus.
 *
 * @deprecated Use `projectTo3DViaFold` from `e8-3d-fold-projection.ts`
 * instead. That function composes `H4_UNI_MATRIX` (Det = 1, verified) with
 * a canonical-axis Schlegel projection and recovers the canonical 8-shell
 * multiset {4, 24, 24, 30, 30, 40, 40, 48} EXACTLY (no k-means tolerance).
 * This basis is retained for back-compat and for parity testing during the
 * migration window.
 *
 * Provenance: closest match to Moxness 2020 "3D Polytope Hulls of E8" Eq. 5
 * with a column-reorder + sign-flip (numerics agree to 3-4 sig figs). An
 * earlier code-comment cite of "Moxness (2023, eq 6)" is incorrect — no such
 * paper exists in the corpus. The four canonical Moxness papers are 2014 (H4
 * fold matrix), 2019 (unimodular rotation), 2020 (3D hulls — closest match),
 * and an undated QM/QC preprint (ring sub-lattice partition).
 *
 * Caveat: this basis is NOT orthonormal and cannot reproduce the canonical
 * 8-shell multiset {24,40,48,30,40,24,30,4} cleanly.
 */
export const MOXNESS_BASIS = {
	X: [0, 0.252, 0.427, -0.319, 0.319, 0.427, 0.781, 0],
	Y: [0.0821, 0, -0.393, 0.636, 0.636, 0.393, 0, 0.348],
	Z: [-0.242, 0, -0.132, 0.215, 0.215, 0.132, 0, -1.03],
} as const;

// ---------------------------------------------------------------------------
// Petrie Projection (Coxeter plane)
// ---------------------------------------------------------------------------

/**
 * E8 Coxeter exponents: the integers 1 ≤ m < h coprime to h, where h = 30
 * is the Coxeter number. These are the degrees minus 1 of the Casimir
 * invariants of E8, and they sum to |W|/h = 120.
 *
 * The Petrie projection uses eigenvectors of the Coxeter element
 * with eigenvalues exp(2πi·m_k/h), giving the correct 30-fold
 * symmetric mandala with 8 concentric rings of 30 vertices each.
 */
export const E8_COXETER_EXPONENTS = [1, 7, 11, 13, 17, 19, 23, 29] as const;

/**
 * Van Oss / Petrie projection basis: maps 8D E8 roots onto the Coxeter eigenplane.
 *
 * These are the orthonormal eigenvectors of the E8 Coxeter element C for the
 * m=1 eigenvalue exp(2πi/30), computed by solving (C² - 2cos(2π/30)C + I)v = 0
 * with Gram-Schmidt orthogonalization.
 *
 * The Coxeter element C = s₁·s₂·...·s₈ (product of simple reflections in
 * bipartite order [0,2,4,6,1,3,5,7]) satisfies C³⁰ = I with max error 0.
 * These eigenvectors satisfy C·u1 = cos(2π/30)·u1 - sin(2π/30)·u2 exactly
 * (residual 4e-16).
 *
 * The projection produces 48 distinct radii (not 8 equal rings of 30).
 * This is the mathematically correct Petrie/Coxeter plane projection,
 * grouped visually into 8 clusters via k-means for rendering.
 */
export const PETRIE_BASIS = {
	u1: [
		0.200957533, -0.0190178731, 0.4351438217, -0.2151684157, 0.6733059285,
		-0.3789213749, 0.3559276837, 0.0,
	],
	u2: [
		0.1730348992, 0.2645058164, 0.1292982996, 0.3997133332, 0.1352075168,
		0.5727482324, 0.3539778746, 0.5019809277,
	],
} as const;

// ---------------------------------------------------------------------------
// H4 / H4φ Sub-Lattice Partition (Moxness QM/QC preprint, Fig. 1)
// ---------------------------------------------------------------------------

/**
 * Per-ring sub-lattice membership for the Petrie projection mandala.
 *
 * Ring index (0-indexed innermost→outermost) → "H4" | "phiH4"
 * From Moxness "E8 and H4 in QM and QC" preprint, Fig. 1 caption: H4
 * sub-lattice = rings {1,3,4,5}, H4φ sub-lattice = rings {2,6,7,8}
 * (1-indexed innermost→outermost; here 0-indexed: H4 = {0,2,3,4},
 * H4φ = {1,5,6,7}).
 */
export const RING_TO_SUBLATTICE = [
	"H4", // ring 0 (Moxness 1)
	"phiH4", // ring 1 (Moxness 2)
	"H4", // ring 2 (Moxness 3)
	"H4", // ring 3 (Moxness 4)
	"H4", // ring 4 (Moxness 5)
	"phiH4", // ring 5 (Moxness 6)
	"phiH4", // ring 6 (Moxness 7)
	"phiH4", // ring 7 (Moxness 8)
] as const;

export type SubLattice = (typeof RING_TO_SUBLATTICE)[number];

// ---------------------------------------------------------------------------
// Moxness Algorithmic Ring Palette (paper-derived edge-norm color classes)
// ---------------------------------------------------------------------------

/**
 * The 8 ring colors per Moxness QM/QC Fig. 1 caption: an algorithm that
 * assigns colors based on the 2D norm of the projected edge in the Petrie
 * projection. Vertex ring colors from smallest to largest:
 * 1=Yellow, 2=Gray, 3=Orange, 4=Cyan, 5=Magenta, 6=Red, 7=Green, 8=Blue.
 *
 * This is the paper-faithful palette for the 8 edge-norm classes computed
 * by `e8-edge-norms.ts` — a direct transcription of the source, not a
 * design choice.
 */
export const MOXNESS_RING_PALETTE = [
	{ color: "#FFD700", name: "Yellow" }, // ring 0 (Moxness 1)
	{ color: "#8A8A9A", name: "Gray" }, // ring 1 (Moxness 2)
	{ color: "#FF8C42", name: "Orange" }, // ring 2 (Moxness 3)
	{ color: "#00E5CC", name: "Cyan" }, // ring 3 (Moxness 4)
	{ color: "#E040FB", name: "Magenta" }, // ring 4 (Moxness 5)
	{ color: "#FF3D5A", name: "Red" }, // ring 5 (Moxness 6)
	{ color: "#00E676", name: "Green" }, // ring 6 (Moxness 7)
	{ color: "#448AFF", name: "Blue" }, // ring 7 (Moxness 8)
] as const;
