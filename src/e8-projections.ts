/**
 * E8 Projection Methods - Multiple Projection Bases
 *
 * Provides different 2D and 3D projections of 8D E8 root vectors:
 * - Platonic 3D: Moxness basis revealing concentric shells (existing, canonical)
 * - `projectPetrie2D`: a fixed orthonormal 2D projection (see the caveat below)
 *
 * `projectPetrie2D` uses the fixed `PETRIE_BASIS` from e8-constants.ts. Despite
 * its historical name, that basis is NOT the Coxeter eigenplane and does not
 * exhibit the 30-fold symmetry of a true Petrie/Coxeter-plane projection (an
 * empirical rotation test finds only the trivial 2-fold centrosymmetry); it
 * produces 48 distinct radii. The genuine, verified Coxeter-plane mandala
 * (8 concentric shells of 30, exact 30-fold symmetry) lives in
 * `e8-coxeter-plane.ts` as `projectCoxeterPlane2D` / `COXETER_PLANE_BASIS`.
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
 * Project a single 8D vector to 2D using the fixed orthonormal `PETRIE_BASIS`.
 *
 * NOTE: despite the "Petrie" name this is NOT the Coxeter-plane projection — the
 * projected 240-root set shows only the trivial 2-fold centrosymmetry, not the
 * 30-fold symmetry of a true Petrie/Coxeter-plane mandala, and yields 48
 * distinct radii (see the `PETRIE_BASIS` caveat in e8-constants.ts). Retained
 * for back-compat. For the verified 30-fold mandala use `projectCoxeterPlane2D`
 * from `e8-coxeter-plane.ts`.
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
 * Classify `projectPetrie2D`-projected vertices into 8 visual ring clusters (0-7).
 *
 * The fixed `PETRIE_BASIS` projection of the 240 E8 roots produces 48 distinct
 * 2D radii. This routine groups them into 8 visual clusters via 1D k-means on
 * the radii (ring 0 = innermost, ring 7 = outermost); the clusters are a
 * rendering convenience, not a structural 8×30 split.
 *
 * Contrast the genuine Coxeter-plane projection (`projectCoxeterPlane2D` +
 * `classifyCoxeterShells`, `e8-coxeter-plane.ts`), where the 240 roots land on
 * EXACTLY 8 radii of 30 points each — an exact partition, no k-means needed.
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
 * Generate the legacy `projectPetrie2D` layout: 240 vertices projected to 2D
 * with ring classification (8 visual clusters via k-means on 48 distinct
 * radii). This is the fixed-`PETRIE_BASIS` projection, NOT the exact 8×30
 * Coxeter mandala — for that use `projectAllCoxeterPlane2D` +
 * `classifyCoxeterShells` (`e8-coxeter-plane.ts`).
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
