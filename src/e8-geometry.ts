/**
 * E8 Root System Geometry - Pure Math Module
 *
 * Generates the 240 root vectors of the E8 exceptional Lie group in 8 dimensions,
 * projects them to 3D, and classifies vertices into concentric hulls.
 *
 * ZERO Three.js dependency - this is pure linear algebra.
 *
 * 3D projection uses the canonical first-principles pipeline
 * `projectTo3DViaFold` (`e8-3d-fold-projection.ts`): H4_UNI fold
 * (Moxness 2019) + ST-axis drop. This produces EXACTLY the canonical 8-shell
 * multiset {4, 24, 24, 30, 30, 40, 40, 48}. The legacy `projectTo3D`
 * (MOXNESS_BASIS-based) remains exported for parity testing.
 *
 * Supports two hull classification modes:
 * - classifyHulls(): 5 hulls (simplified)
 * - classifyHulls8(): 8 hulls (paper-accurate)
 */

import { projectTo3DViaFold } from "./e8-3d-fold-projection";
import { MOXNESS_BASIS, THETA_COEFFICIENTS } from "./e8-constants";

// ---------------------------------------------------------------------------
// Cardinality constants
// ---------------------------------------------------------------------------

/** Number of E8 root vectors (vertices in the 240-cell root polytope). */
export const E8_VERTEX_COUNT = 240;

/** Number of E8 edges: each vertex has 56 neighbors → 240 × 56 / 2 = 6720. */
export const E8_EDGE_COUNT = 6720;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface E8Vertex {
	/** Sequential index 0..239 */
	index: number;
	/** Original 8-dimensional root vector coordinates */
	coords8D: number[];
	/** 3D position after Moxness projection */
	position3D: [number, number, number];
	/** Euclidean distance from origin in 3D */
	norm3D: number;
	/** Concentric hull index 0-4 */
	hull: number;
}

// ---------------------------------------------------------------------------
// E8 Root System Generation
// ---------------------------------------------------------------------------

/**
 * Generate all 240 root vectors of the E8 exceptional Lie group in 8 dimensions.
 *
 * Family 1 (112 vectors): All permutations of (+-1, +-1, 0, 0, 0, 0, 0, 0)
 *   - Choose 2 positions from 8: C(8,2) = 28
 *   - Each position +/-1: 2^2 = 4 sign combos
 *   - Total: 28 * 4 = 112
 *
 * Family 2 (128 vectors): All (+-1/2)^8 with an EVEN number of minus signs
 *   - Total 2^8 = 256 sign patterns, half have even negatives
 *   - Total: 128
 *
 * Every root has norm sqrt(2).
 */
export function generateE8RootSystem(): number[][] {
	const roots: number[][] = [];

	// --- Family 1: 112 vectors ---
	// All permutations of two non-zero coordinates, each +-1
	for (let i = 0; i < 8; i++) {
		for (let j = i + 1; j < 8; j++) {
			for (const si of [-1, 1]) {
				for (const sj of [-1, 1]) {
					const v = new Array(8).fill(0);
					v[i] = si;
					v[j] = sj;
					roots.push(v);
				}
			}
		}
	}

	// --- Family 2: 128 vectors ---
	// All (+-1/2)^8 with even number of minus signs
	for (let mask = 0; mask < 256; mask++) {
		let negCount = 0;
		const v: number[] = [];
		for (let bit = 0; bit < 8; bit++) {
			if (mask & (1 << bit)) {
				v.push(-0.5);
				negCount++;
			} else {
				v.push(0.5);
			}
		}
		if (negCount % 2 === 0) {
			roots.push(v);
		}
	}

	return roots;
}

// ---------------------------------------------------------------------------
// 3D Projection via Moxness Platonic Solid Basis (2023)
// ---------------------------------------------------------------------------

/**
 * Projection basis vectors from Moxness (2023).
 * Now imported from e8-constants.ts for single source of truth.
 */
const MOXNESS_BASIS_X = MOXNESS_BASIS.X as unknown as number[];
const MOXNESS_BASIS_Y = MOXNESS_BASIS.Y as unknown as number[];
const MOXNESS_BASIS_Z = MOXNESS_BASIS.Z as unknown as number[];

function dot8(a: number[], b: number[]): number {
	let sum = 0;
	for (let i = 0; i < 8; i++) {
		sum += a[i] * b[i];
	}
	return sum;
}

/**
 * Project 8D root vectors into 3D using the legacy `MOXNESS_BASIS`.
 *
 * @deprecated Consumers should prefer `projectTo3DViaFold` (the H4_UNI fold
 * + ST-axis drop pipeline) which recovers the canonical 8-shell multiset
 * exactly. This function is retained for parity tests during the migration
 * window.
 */
export function projectTo3D(
	vertices8D: number[][],
): [number, number, number][] {
	return vertices8D.map((v) => [
		dot8(v, MOXNESS_BASIS_X),
		dot8(v, MOXNESS_BASIS_Y),
		dot8(v, MOXNESS_BASIS_Z),
	]);
}

// ---------------------------------------------------------------------------
// Hull Classification
// ---------------------------------------------------------------------------

/**
 * Classify projected 3D vertices into 5 concentric hulls (shells) by radius.
 *
 * Uses 1D k-means on the 3D norms with k=5. Vertices at similar distances from
 * the origin belong to the same hull.
 */
export function classifyHulls(projected: [number, number, number][]): number[] {
	const norms = projected.map((p) =>
		Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]),
	);

	// Simple k-means on 1D norms with k=5
	const k = 5;

	// Initialize centroids by picking evenly spaced quantiles
	const sortedNorms = Array.from(norms).toSorted((a, b) => a - b);
	let centroids: number[] = [];
	for (let i = 0; i < k; i++) {
		const idx = Math.floor(((i + 0.5) / k) * sortedNorms.length);
		centroids.push(sortedNorms[idx]);
	}

	// Run k-means iterations
	let assignments = new Array(norms.length).fill(0);

	for (let iter = 0; iter < 50; iter++) {
		// Assign each norm to nearest centroid
		const newAssignments = norms.map((n) => {
			let bestCluster = 0;
			let bestDist = Math.abs(n - centroids[0]);
			for (let c = 1; c < k; c++) {
				const dist = Math.abs(n - centroids[c]);
				if (dist < bestDist) {
					bestDist = dist;
					bestCluster = c;
				}
			}
			return bestCluster;
		});

		// Check convergence
		const changed = newAssignments.some((a, i) => a !== assignments[i]);
		assignments = newAssignments;
		if (!changed) break;

		// Update centroids
		const sums = new Array(k).fill(0);
		const counts = new Array(k).fill(0);
		for (let i = 0; i < norms.length; i++) {
			sums[assignments[i]] += norms[i];
			counts[assignments[i]]++;
		}
		centroids = centroids.map((c, i) =>
			counts[i] > 0 ? sums[i] / counts[i] : c,
		);
	}

	// Sort clusters by centroid radius so hull 0 = innermost
	const clusterOrder = centroids
		.map((c, i) => ({ centroid: c, originalIdx: i }))
		.sort((a, b) => a.centroid - b.centroid)
		.map((item) => item.originalIdx);

	// Create mapping from original cluster index to sorted hull index
	const clusterToHull = new Array(k);
	for (let hull = 0; hull < k; hull++) {
		clusterToHull[clusterOrder[hull]] = hull;
	}

	return assignments.map((a) => clusterToHull[a]);
}

// ---------------------------------------------------------------------------
// Convenience Export
// ---------------------------------------------------------------------------

/**
 * Generate the complete typed E8 vertex array.
 *
 * Combines root system generation, 3D projection, and hull classification
 * into a single call returning fully-typed E8Vertex objects.
 *
 * Uses `projectTo3DViaFold` (H4_UNI + ST-axis drop, first-principles).
 */
export function generateE8Vertices(): E8Vertex[] {
	const roots = generateE8RootSystem();
	const projected = projectTo3DViaFold(roots);
	const hulls = classifyHulls(projected);

	return roots.map((coords8D, index) => ({
		index,
		coords8D,
		position3D: projected[index],
		norm3D: Math.sqrt(
			projected[index][0] ** 2 +
				projected[index][1] ** 2 +
				projected[index][2] ** 2,
		),
		hull: hulls[index],
	}));
}

// ---------------------------------------------------------------------------
// 8-Hull Classification (Paper-Accurate)
// ---------------------------------------------------------------------------

/**
 * Classify projected 3D vertices into 8 concentric hulls (shells) by radius.
 *
 * Uses 1D k-means on the 3D norms with k=8, matching the approach used by
 * classifyHulls() for 5-hull classification. This is deterministic and
 * self-calibrating - it finds the natural clusters in the norm distribution
 * without requiring hand-tuned boundary thresholds.
 *
 * The canonical 3D projection (Coxeter 1973 *Regular Polytopes* + Koca-Al-Ajmi-Koca
 * 2012 arXiv:1204.4567; `H4_UNI_MATRIX` first 4 rows + ST-axis drop) reveals
 * 8 concentric shells with multiset {4, 24, 24, 30, 30, 40, 40, 48} (sum
 * 240). `projectTo3DViaFold` recovers this multiset EXACTLY as 8 distinct
 * radii; k-means is preserved for backward compatibility with consumers
 * that read the E8Vertex hull index but is no longer required for
 * correctness.
 */
export function classifyHulls8(
	projected: [number, number, number][],
): number[] {
	const norms = projected.map((p) =>
		Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]),
	);

	// Simple k-means on 1D norms with k=8
	const k = 8;

	// Initialize centroids by picking evenly spaced quantiles
	const sortedNorms = Array.from(norms).toSorted((a, b) => a - b);
	let centroids: number[] = [];
	for (let i = 0; i < k; i++) {
		const idx = Math.floor(((i + 0.5) / k) * sortedNorms.length);
		centroids.push(sortedNorms[idx]);
	}

	// Run k-means iterations
	let assignments = new Array(norms.length).fill(0);

	for (let iter = 0; iter < 50; iter++) {
		// Assign each norm to nearest centroid
		const newAssignments = norms.map((n) => {
			let bestCluster = 0;
			let bestDist = Math.abs(n - centroids[0]);
			for (let c = 1; c < k; c++) {
				const dist = Math.abs(n - centroids[c]);
				if (dist < bestDist) {
					bestDist = dist;
					bestCluster = c;
				}
			}
			return bestCluster;
		});

		// Check convergence
		const changed = newAssignments.some((a, i) => a !== assignments[i]);
		assignments = newAssignments;
		if (!changed) break;

		// Update centroids
		const sums = new Array(k).fill(0);
		const counts = new Array(k).fill(0);
		for (let i = 0; i < norms.length; i++) {
			sums[assignments[i]] += norms[i];
			counts[assignments[i]]++;
		}
		centroids = centroids.map((c, i) =>
			counts[i] > 0 ? sums[i] / counts[i] : c,
		);
	}

	// Sort clusters by centroid radius so hull 0 = innermost
	const clusterOrder = centroids
		.map((c, i) => ({ centroid: c, originalIdx: i }))
		.sort((a, b) => a.centroid - b.centroid)
		.map((item) => item.originalIdx);

	// Create mapping from original cluster index to sorted hull index
	const clusterToHull = new Array(k);
	for (let hull = 0; hull < k; hull++) {
		clusterToHull[clusterOrder[hull]] = hull;
	}

	return assignments.map((a) => clusterToHull[a]);
}

/**
 * Generate E8 vertices with 8-hull classification (paper-accurate).
 *
 * Uses `projectTo3DViaFold` (H4_UNI + ST-axis drop). With this projection
 * the 8 hulls correspond to the canonical multiset {4, 24, 24, 30, 30, 40,
 * 40, 48} — these are exact distance classes, not k-means clusters.
 */
export function generateE8Vertices8Hull(): E8Vertex[] {
	const roots = generateE8RootSystem();
	const projected = projectTo3DViaFold(roots);
	const hulls = classifyHulls8(projected);

	return roots.map((coords8D, index) => ({
		index,
		coords8D,
		position3D: projected[index],
		norm3D: Math.sqrt(
			projected[index][0] ** 2 +
				projected[index][1] ** 2 +
				projected[index][2] ** 2,
		),
		hull: hulls[index],
	}));
}

// ---------------------------------------------------------------------------
// Theta Function Utilities
// ---------------------------------------------------------------------------

/**
 * Get the number of lattice points at a given shell.
 */
export function thetaShellCount(shell: number): number {
	if (shell < 0 || shell >= THETA_COEFFICIENTS.length) return 0;
	return THETA_COEFFICIENTS[shell];
}

// ---------------------------------------------------------------------------
// E8 Edge Computation
// ---------------------------------------------------------------------------

/**
 * Compute E8 root system edges.
 *
 * Two roots are connected iff their 8D inner product = 1
 * (equivalently, 8D distance = sqrt(2)).
 * Each vertex has exactly 56 neighbors, yielding 240 * 56 / 2 = 6720 edges.
 *
 * Returns edges as sorted pairs [i, j] where i < j, with no duplicates.
 */
export function computeE8Edges(roots: number[][]): [number, number][] {
	const edges: [number, number][] = [];
	const n = roots.length;

	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			let dot = 0;
			for (let k = 0; k < 8; k++) {
				dot += roots[i][k] * roots[j][k];
			}
			if (Math.abs(dot - 1.0) < 1e-6) {
				edges.push([i, j]);
			}
		}
	}

	return edges;
}
