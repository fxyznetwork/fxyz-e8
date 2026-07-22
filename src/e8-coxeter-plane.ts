/**
 * E8 Coxeter-plane projection — the real, verified "E8 mandala".
 *
 * This module DERIVES (not transcribes) the 2D projection onto the E8 Coxeter
 * plane and proves the result numerically. It exists because the older
 * `PETRIE_BASIS` / `projectPetrie2D` in `e8-constants.ts` / `e8-projections.ts`
 * carried a doc comment claiming its fixed basis was the Coxeter-element
 * eigenplane (hence 30-fold symmetric) — a claim an empirical rotation test
 * does NOT support (that basis shows only the trivial 2-fold centrosymmetry).
 * Rather than ship a false precise claim, the true Coxeter plane is computed
 * here from first principles and locked by a test.
 *
 * ── Mathematics ──────────────────────────────────────────────────────────
 * The E8 Coxeter number is h = 30. A Coxeter element is
 *
 *     w = s₁ · s₂ · … · s₈     (product of the 8 simple reflections)
 *
 * where sᵢ(v) = v − 2·(v·αᵢ)/(αᵢ·αᵢ)·αᵢ is the reflection in the simple root
 * αᵢ. Since every E8 root has αᵢ·αᵢ = 2, this is sᵢ(v) = v − (v·αᵢ)·αᵢ. As a
 * product of 8 reflections, w is a real orthogonal matrix with det = +1 and
 * exact order 30 (wᵏ ≠ I for every proper divisor k of 30; w³⁰ = I). Its
 * eigenvalues are exp(±2πi·mₖ/30) for the E8 exponents mₖ ∈ {1,7,11,13,17,19,
 * 23,29} — eight unit-circle values in four conjugate pairs, none real.
 *
 * The Coxeter plane P is the real 2-plane carrying the primitive eigenpair
 * exp(±2πi/30). We isolate it as the null space of the real matrix
 *
 *     M = w² − 2·cos(2π/30)·w + I = (w − e^{iθ}I)(w − e^{−iθ}I),  θ = 2π/30,
 *
 * whose kernel is exactly that 2-plane (only the m = 1 / m = 29 eigenvalues
 * annihilate M; the next-closest eigenvalue leaves a residual of ≈1.75, so the
 * null space is extremely well separated — condition number is a non-issue).
 * We recover the kernel via a Jacobi eigendecomposition of the symmetric PSD
 * matrix MᵀM (its two ≈0 eigenvectors span P), then Gram-Schmidt to an
 * orthonormal pair {u1, u2}. Because {u1, u2} is orthonormal and P is
 * w-invariant, w acts on P as an exact rotation by 2π/30, so the projected
 * point set { (v·u1, v·u2) : v ∈ Φ } is invariant under rotation by 2π/30.
 *
 * ── Verification (empirical, test-locked) ────────────────────────────────
 * Projecting all 240 E8 roots through {u1, u2} yields the canonical mandala:
 * EIGHT concentric shells of EXACTLY 30 points each (8 × 30 = 240), and the
 * point set maps back onto itself under rotation by 2π/30 to 100% within a
 * tight tolerance — genuine 30-fold rotational symmetry. Rotation by 2π/7 or
 * 2π/8 does NOT map the set to itself, confirming the symmetry is exactly
 * 30-fold, not accidental. The measured out-of-plane residual of w·u1 (i.e.
 * how far w·u1 falls outside span{u1,u2}) is ≈3.5e-16 — machine precision.
 * All of this is asserted in `__tests__/e8-coxeter-plane.test.ts`; the numbers
 * above are reproducible by running that suite, not taken on faith.
 *
 * ZERO Three.js dependency — pure linear algebra.
 */

import { E8_SIMPLE_ROOTS } from "./e8-constants";

// ---------------------------------------------------------------------------
// Minimal dense linear algebra (private; 8×8 scale, no external deps)
// ---------------------------------------------------------------------------

type Mat = number[][];

function dot(a: readonly number[], b: readonly number[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}

function identity(n: number): Mat {
	return Array.from({ length: n }, (_, i) =>
		Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
	);
}

function matMul(a: Mat, b: Mat): Mat {
	const n = a.length;
	const inner = b.length;
	const m = b[0].length;
	const c: Mat = Array.from({ length: n }, () => new Array(m).fill(0));
	for (let i = 0; i < n; i++) {
		for (let p = 0; p < inner; p++) {
			const aip = a[i][p];
			for (let j = 0; j < m; j++) c[i][j] += aip * b[p][j];
		}
	}
	return c;
}

function matVec(a: Mat, v: readonly number[]): number[] {
	return a.map((row) => dot(row, v));
}

function transpose(a: Mat): Mat {
	return a[0].map((_, j) => a.map((row) => row[j]));
}

/**
 * Householder-free Jacobi eigendecomposition for a symmetric matrix.
 * Returns eigenvalues and eigenvectors (as columns). Deterministic (no RNG),
 * which is what keeps the derived basis — and therefore the gallery — stable.
 */
function jacobiEigenSymmetric(input: Mat): {
	values: number[];
	vectors: Mat;
} {
	const n = input.length;
	const a = input.map((row) => row.slice());
	const v = identity(n);

	for (let sweep = 0; sweep < 100; sweep++) {
		let off = 0;
		for (let i = 0; i < n; i++)
			for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
		if (off < 1e-30) break;

		for (let p = 0; p < n; p++) {
			for (let q = p + 1; q < n; q++) {
				if (Math.abs(a[p][q]) < 1e-300) continue;
				const phi = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
				const cs = Math.cos(phi);
				const sn = Math.sin(phi);
				// Left rotation: columns p,q of a
				for (let k = 0; k < n; k++) {
					const akp = a[k][p];
					const akq = a[k][q];
					a[k][p] = cs * akp - sn * akq;
					a[k][q] = sn * akp + cs * akq;
				}
				// Right rotation: rows p,q of a
				for (let k = 0; k < n; k++) {
					const apk = a[p][k];
					const aqk = a[q][k];
					a[p][k] = cs * apk - sn * aqk;
					a[q][k] = sn * apk + cs * aqk;
				}
				// Accumulate eigenvectors
				for (let k = 0; k < n; k++) {
					const vkp = v[k][p];
					const vkq = v[k][q];
					v[k][p] = cs * vkp - sn * vkq;
					v[k][q] = sn * vkp + cs * vkq;
				}
			}
		}
	}

	const values = a.map((row, i) => row[i]);
	const vectors = transpose(v); // vectors[i] is the i-th eigenvector (column i)
	return { values, vectors };
}

function normalize(v: readonly number[]): number[] {
	const n = Math.sqrt(dot(v, v));
	return v.map((x) => x / n);
}

/**
 * Fix a vector's sign so its largest-magnitude component is positive. Makes the
 * derived basis reproducible and human-inspectable (the projected point set's
 * 30-fold symmetry and shell structure are independent of this choice — it only
 * pins the mandala's orientation so re-derivations agree).
 */
function canonicalizeSign(v: readonly number[]): number[] {
	let maxIdx = 0;
	for (let i = 1; i < v.length; i++) {
		if (Math.abs(v[i]) > Math.abs(v[maxIdx])) maxIdx = i;
	}
	return v[maxIdx] < 0 ? v.map((x) => -x) : v.slice();
}

// ---------------------------------------------------------------------------
// Coxeter element + Coxeter-plane basis
// ---------------------------------------------------------------------------

/**
 * Build the E8 Coxeter element w = s₁·s₂·…·s₈ as an 8×8 real matrix, where sᵢ
 * is the reflection in simple root `E8_SIMPLE_ROOTS[i]`. The result is
 * orthogonal with det = +1 and exact order 30 (w³⁰ = I) — asserted in the
 * test suite. Exposed so callers can verify the construction themselves.
 */
export function e8CoxeterElement(): number[][] {
	let w = identity(8);
	for (const alpha of E8_SIMPLE_ROOTS) {
		// Reflection matrix Rᵢ: e_k ↦ e_k − (e_k·αᵢ)·αᵢ  (norm² αᵢ = 2).
		// Entry (row i, col j) = δ_ij − αᵢ[j]·αᵢ[i].
		const r: Mat = Array.from({ length: 8 }, (_, i) =>
			Array.from(
				{ length: 8 },
				(_, j) => (i === j ? 1 : 0) - alpha[j] * alpha[i],
			),
		);
		w = matMul(w, r);
	}
	return w;
}

export interface CoxeterPlaneBasis {
	/** First orthonormal axis of the E8 Coxeter plane (length-8 unit vector). */
	u1: number[];
	/** Second orthonormal axis of the E8 Coxeter plane (length-8 unit vector). */
	u2: number[];
}

/**
 * Derive the orthonormal Coxeter-plane basis {u1, u2} from first principles by
 * (1) building the Coxeter element w, (2) isolating the null space of
 * M = w² − 2·cos(2π/30)·w + I (the exp(±2πi/30) eigenplane), and (3)
 * Gram-Schmidt + sign-canonicalization. Pure and deterministic — calling it
 * twice returns identical arrays. See the module header for the full math.
 */
export function deriveCoxeterPlaneBasis(): CoxeterPlaneBasis {
	const w = e8CoxeterElement();
	const theta = (2 * Math.PI) / 30;
	const c = Math.cos(theta);
	const w2 = matMul(w, w);

	// M = w² − 2cosθ·w + I
	const m: Mat = Array.from({ length: 8 }, (_, i) =>
		Array.from(
			{ length: 8 },
			(_, j) => w2[i][j] - 2 * c * w[i][j] + (i === j ? 1 : 0),
		),
	);

	// Null(M) via the two ≈0 eigenvectors of the symmetric PSD matrix MᵀM.
	const mtm = matMul(transpose(m), m);
	const { values, vectors } = jacobiEigenSymmetric(mtm);

	const order = values
		.map((val, i) => i)
		.sort((x, y) => Math.abs(values[x]) - Math.abs(values[y]));

	// Defensive: the fixed E8 input always yields a clean, well-separated 2D
	// null space (two eigenvalues ≈0, the third ≥ ~3). If that ever fails, the
	// construction is broken — surface it loudly rather than emit a bad basis.
	const scale = Math.max(1, Math.abs(values[order[7]]));
	if (
		Math.abs(values[order[1]]) > 1e-6 * scale ||
		Math.abs(values[order[2]]) < 1e-3 * scale
	) {
		throw new Error(
			"deriveCoxeterPlaneBasis: expected a well-separated 2D Coxeter plane; " +
				`got sorted |eigenvalues| ${order.map((i) => values[i].toExponential(2)).join(", ")}`,
		);
	}

	const u1 = canonicalizeSign(normalize(vectors[order[0]]));
	const rejected = vectors[order[1]];
	const proj = dot(rejected, u1);
	const u2 = canonicalizeSign(
		normalize(rejected.map((x, i) => x - proj * u1[i])),
	);

	return { u1, u2 };
}

/**
 * The orthonormal E8 Coxeter-plane basis, derived at load by
 * `deriveCoxeterPlaneBasis()`. This is a COMPUTED constant, not a transcribed
 * one: its value is the output of the derivation above, so it cannot silently
 * drift from the mathematics it claims to implement. Projecting the 240 roots
 * through it gives the verified 30-fold-symmetric mandala (8 shells × 30).
 */
export const COXETER_PLANE_BASIS: CoxeterPlaneBasis = deriveCoxeterPlaneBasis();

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Project a single 8D E8 vector onto the Coxeter plane: [v·u1, v·u2].
 *
 * Applied to the 240 roots this produces the canonical E8 mandala — eight
 * concentric 30-gons with exact 30-fold rotational symmetry (verified in the
 * test suite). This is the genuine Petrie / Coxeter-plane projection; prefer it
 * over the legacy `projectPetrie2D`, whose fixed basis does not achieve the
 * 30-fold symmetry.
 */
export function projectCoxeterPlane2D(v8D: readonly number[]): [number, number] {
	return [dot(v8D, COXETER_PLANE_BASIS.u1), dot(v8D, COXETER_PLANE_BASIS.u2)];
}

/** Project an array of 8D vectors onto the Coxeter plane. */
export function projectAllCoxeterPlane2D(
	vertices8D: readonly (readonly number[])[],
): [number, number][] {
	return vertices8D.map((v) => projectCoxeterPlane2D(v));
}

/**
 * Classify Coxeter-plane-projected points into their concentric shell index
 * (0 = innermost … 7 = outermost) by radius. For the 240 E8 roots this is an
 * EXACT partition into 8 shells of 30 — the projected radii take only 8
 * distinct values (unlike a k-means grouping of a spread-out radius set). Any
 * point whose radius is within `tol` of a shell's radius joins that shell.
 *
 * @param projected2D — points from `projectAllCoxeterPlane2D`
 * @param tol — radius-merge tolerance (default scales with the outer radius)
 */
export function classifyCoxeterShells(
	projected2D: readonly (readonly [number, number])[],
	tol?: number,
): number[] {
	const radii = projected2D.map(([x, y]) => Math.hypot(x, y));
	const maxR = radii.reduce((a, r) => Math.max(a, r), 0);
	const eps = tol ?? 1e-6 * maxR + 1e-9;

	// Collect distinct shell radii (ascending).
	const shellRadii: number[] = [];
	for (const r of [...radii].sort((a, b) => a - b)) {
		if (shellRadii.length === 0 || r - shellRadii[shellRadii.length - 1] > eps) {
			shellRadii.push(r);
		}
	}

	return radii.map((r) => {
		let best = 0;
		let bestDist = Math.abs(r - shellRadii[0]);
		for (let s = 1; s < shellRadii.length; s++) {
			const d = Math.abs(r - shellRadii[s]);
			if (d < bestDist) {
				bestDist = d;
				best = s;
			}
		}
		return best;
	});
}
