/**
 * E8 Projection Methods - Multiple Projection Bases
 *
 * Provides different 2D and 3D projections of 8D E8 root vectors:
 * - Platonic 3D: Moxness basis revealing concentric shells (existing, now canonical)
 * - Petrie 2D: Coxeter eigenplane projection (the "mandala")
 * - Van Oss 2D: Alternative 2D projection
 *
 * The Petrie projection uses eigenvectors of the Coxeter element, producing
 * 48 distinct radii grouped visually into 8 clusters via k-means.
 * See E8-AUDIT-REPORT.md for mathematical derivation.
 *
 * ZERO Three.js dependency - pure linear algebra.
 */

import { MOXNESS_BASIS, PETRIE_BASIS } from "./e8-constants";

// ---------------------------------------------------------------------------
// Internal Utilities
// ---------------------------------------------------------------------------

function dot8(a: readonly number[], b: readonly number[]): number {
	let sum = 0;
	for (let i = 0; i < 8; i++) {
		sum += a[i] * b[i];
	}
	return sum;
}

// ---------------------------------------------------------------------------
// 3D Projections
// ---------------------------------------------------------------------------

/**
 * Project a single 8D vector to 3D using the Moxness Platonic Solid basis.
 * This is the same projection used in e8-geometry.ts, exposed as a standalone function.
 */
export function projectPlatonic3D(v8D: number[]): [number, number, number] {
	return [
		dot8(v8D, MOXNESS_BASIS.X),
		dot8(v8D, MOXNESS_BASIS.Y),
		dot8(v8D, MOXNESS_BASIS.Z),
	];
}

/**
 * Project an array of 8D vectors to 3D using the Moxness basis.
 */
export function projectAllPlatonic3D(
	vertices8D: number[][],
): [number, number, number][] {
	return vertices8D.map(projectPlatonic3D);
}

// ---------------------------------------------------------------------------
// 2D Projections
// ---------------------------------------------------------------------------

/**
 * Project a single 8D vector to 2D using the Petrie/Coxeter eigenplane basis.
 *
 * This produces the famous mandala view with 8 visual concentric rings.
 * The basis vectors are the m=1 eigenvectors of the E8 Coxeter element,
 * computed by solving (C² - 2cos(2π/30)C + I)v = 0.
 *
 * The projection produces 48 distinct radii, grouped into 8 visual
 * clusters by k-means. See e8-constants.ts for basis derivation.
 */
export function projectPetrie2D(v8D: number[]): [number, number] {
	return [dot8(v8D, PETRIE_BASIS.u1), dot8(v8D, PETRIE_BASIS.u2)];
}

/**
 * Project an array of 8D vectors to 2D Petrie projection.
 */
export function projectAllPetrie2D(vertices8D: number[][]): [number, number][] {
	return vertices8D.map(projectPetrie2D);
}

/**
 * Classify Petrie-projected vertices into 8 visual ring clusters (0-7).
 *
 * The Petrie projection of 240 E8 roots produces 48 distinct 2D radii.
 * These are grouped into 8 visual clusters using 1D k-means on the radii.
 * Ring 0 = innermost, ring 7 = outermost.
 *
 * Note: the popular claim of "8 rings of exactly 30 vertices each" is a
 * simplification. The true Coxeter eigenplane projection has unequal cluster
 * sizes. See E8-AUDIT-REPORT.md for mathematical proof.
 *
 * Returns an array of ring indices (0-7) corresponding to input vertices.
 */
export function classifyPetrieRings(projected2D: [number, number][]): number[] {
	// Compute radii
	const radii = projected2D.map(([x, y]) => Math.sqrt(x * x + y * y));

	// Find 8 distinct radius clusters using simple 1D k-means
	const k = 8;
	const sortedRadii = Array.from(radii).toSorted((a, b) => a - b);

	// Initialize centroids at evenly spaced quantiles
	let centroids: number[] = [];
	for (let i = 0; i < k; i++) {
		const idx = Math.floor(((i + 0.5) / k) * sortedRadii.length);
		centroids.push(sortedRadii[idx]);
	}

	// Run k-means
	let assignments = new Array(radii.length).fill(0);
	for (let iter = 0; iter < 50; iter++) {
		const newAssignments = radii.map((r) => {
			let bestCluster = 0;
			let bestDist = Math.abs(r - centroids[0]);
			for (let c = 1; c < k; c++) {
				const dist = Math.abs(r - centroids[c]);
				if (dist < bestDist) {
					bestDist = dist;
					bestCluster = c;
				}
			}
			return bestCluster;
		});

		const changed = newAssignments.some((a, i) => a !== assignments[i]);
		assignments = newAssignments;
		if (!changed) break;

		const sums = new Array(k).fill(0);
		const counts = new Array(k).fill(0);
		for (let i = 0; i < radii.length; i++) {
			sums[assignments[i]] += radii[i];
			counts[assignments[i]]++;
		}
		centroids = centroids.map((c, i) =>
			counts[i] > 0 ? sums[i] / counts[i] : c,
		);
	}

	// Sort clusters by radius so ring 0 = innermost
	const clusterOrder = centroids
		.map((c, i) => ({ centroid: c, originalIdx: i }))
		.sort((a, b) => a.centroid - b.centroid)
		.map((item) => item.originalIdx);

	const clusterToRing = new Array(k);
	for (let ring = 0; ring < k; ring++) {
		clusterToRing[clusterOrder[ring]] = ring;
	}

	return assignments.map((a) => clusterToRing[a]);
}

// ---------------------------------------------------------------------------
// Petrie Mandala Data
// ---------------------------------------------------------------------------

export interface PetrieVertex {
	/** Index in the E8 root system (0-239) */
	index: number;
	/** 8D coordinates */
	coords8D: number[];
	/** 2D Petrie-projected position */
	position2D: [number, number];
	/** 2D radius from origin */
	radius: number;
	/** Ring index 0-7 (innermost to outermost) */
	ring: number;
}

/**
 * Generate the complete Petrie mandala: 240 vertices projected to 2D
 * with ring classification (8 visual clusters via k-means).
 *
 * Returns vertices sorted by ring (innermost first) then by angle.
 */
export function generatePetrieMandala(roots8D: number[][]): PetrieVertex[] {
	const projected = projectAllPetrie2D(roots8D);
	const rings = classifyPetrieRings(projected);

	const vertices: PetrieVertex[] = roots8D.map((coords8D, index) => ({
		index,
		coords8D,
		position2D: projected[index],
		radius: Math.sqrt(projected[index][0] ** 2 + projected[index][1] ** 2),
		ring: rings[index],
	}));

	// Sort by ring, then by angle within each ring
	vertices.sort((a, b) => {
		if (a.ring !== b.ring) return a.ring - b.ring;
		const angleA = Math.atan2(a.position2D[1], a.position2D[0]);
		const angleB = Math.atan2(b.position2D[1], b.position2D[0]);
		return angleA - angleB;
	});

	return vertices;
}
