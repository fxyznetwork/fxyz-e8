/**
 * E8 Petrie-Edge Norm Classification — Pure Math Module
 *
 * Implements the algorithm described in Moxness "E8 and H4 in QM and QC"
 * preprint, Fig. 1 caption:
 *   "8 concentric rings of 30 vertices which are in the same color palette
 *    used to color the edges, which uses an algorithm that assigns colors
 *    based on the norm of the projected edge. The vertex ring colors from
 *    smallest to largest are: 1=Yellow, 2=Gray, 3=Orange, 4=Cyan,
 *    5=Magenta, 6=Red, 7=Green, 8=Blue."
 *
 * Each of the 6,720 edges has its 2D Petrie projection computed, then edges
 * are clustered by 2D length into 8 norm classes. Vertices inherit the color
 * of the rings they sit on (each ring's vertices share a single class).
 *
 * The output pairs with `MOXNESS_RING_PALETTE` (defined in e8-constants.ts),
 * the paper-faithful 8-color palette for the edge-norm classes.
 *
 * ZERO Three.js dependency — pure linear algebra.
 */

import { computeE8Edges } from "./e8-geometry";
import { projectAllPetrie2D } from "./e8-projections";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EdgeNorm {
	/** Index into the edge list returned by computeE8Edges() */
	edgeIdx: number;
	/** Vertex indices in the E8 root system (i < j) */
	i: number;
	j: number;
	/** 2D Petrie-projected edge length |proj(v_i) − proj(v_j)| */
	norm2D: number;
	/** Cluster index 0..7 (after classifyEdgesByNorm) */
	classIdx: number;
}

// ---------------------------------------------------------------------------
// Edge norm computation
// ---------------------------------------------------------------------------

/**
 * Compute 2D Petrie-projected edge lengths for all 6,720 E8 edges.
 *
 * @param roots8D — the 240 E8 root vectors in 8D (from generateE8RootSystem)
 * @returns array of 6,720 EdgeNorm objects with `classIdx = -1` (not yet classified)
 */
export function computePetrieEdgeNorms(roots8D: number[][]): EdgeNorm[] {
	const proj2D = projectAllPetrie2D(roots8D);
	const edges = computeE8Edges(roots8D);
	const out: EdgeNorm[] = [];
	for (let e = 0; e < edges.length; e++) {
		const [i, j] = edges[e];
		const dx = proj2D[i][0] - proj2D[j][0];
		const dy = proj2D[i][1] - proj2D[j][1];
		out.push({
			edgeIdx: e,
			i,
			j,
			norm2D: Math.sqrt(dx * dx + dy * dy),
			classIdx: -1,
		});
	}
	return out;
}

// ---------------------------------------------------------------------------
// 8-class norm clustering
// ---------------------------------------------------------------------------

/**
 * Cluster edge norms into 8 classes via 1D k-means (k=8) on edge lengths.
 *
 * Mutates the input array in place: each EdgeNorm gets `classIdx` set to
 * 0..7, where class 0 = shortest edges and class 7 = longest. Returns the
 * cluster centroids (length-8 array of mean norms, sorted ascending).
 *
 * Empirically the Petrie projection of E8's 6,720 edges produces a small
 * number of distinct norms (~8 well-separated clusters) — this matches the
 * "8 colors" in Moxness Fig. 1 caption. The k-means converges in <20
 * iterations on typical input.
 */
export function classifyEdgesByNorm(edges: EdgeNorm[]): number[] {
	const k = 8;
	const norms = edges.map((e) => e.norm2D);
	const sortedNorms = Array.from(norms).toSorted((a, b) => a - b);

	// Initialize centroids at evenly spaced quantiles.
	let centroids: number[] = [];
	for (let i = 0; i < k; i++) {
		const idx = Math.floor(((i + 0.5) / k) * sortedNorms.length);
		centroids.push(sortedNorms[idx]);
	}

	let assignments = new Array<number>(norms.length).fill(0);
	for (let iter = 0; iter < 50; iter++) {
		const next = norms.map((n) => {
			let best = 0;
			let bestDist = Math.abs(n - centroids[0]);
			for (let c = 1; c < k; c++) {
				const d = Math.abs(n - centroids[c]);
				if (d < bestDist) {
					bestDist = d;
					best = c;
				}
			}
			return best;
		});
		const changed = next.some((a, i) => a !== assignments[i]);
		assignments = next;
		if (!changed) break;
		const sums = new Array<number>(k).fill(0);
		const counts = new Array<number>(k).fill(0);
		for (let i = 0; i < norms.length; i++) {
			sums[assignments[i]] += norms[i];
			counts[assignments[i]]++;
		}
		centroids = centroids.map((c, i) =>
			counts[i] > 0 ? sums[i] / counts[i] : c,
		);
	}

	// Sort clusters by centroid so class 0 = shortest, 7 = longest.
	const order = centroids
		.map((c, i) => ({ centroid: c, originalIdx: i }))
		.sort((a, b) => a.centroid - b.centroid);
	const clusterToClass = new Array<number>(k);
	const sortedCentroids = new Array<number>(k);
	for (let cls = 0; cls < k; cls++) {
		clusterToClass[order[cls].originalIdx] = cls;
		sortedCentroids[cls] = order[cls].centroid;
	}
	for (let i = 0; i < edges.length; i++) {
		edges[i].classIdx = clusterToClass[assignments[i]];
	}
	return sortedCentroids;
}

/**
 * Convenience: in one call, compute and classify all 6,720 E8 edge norms.
 *
 * @returns { edges, centroids } — `edges` is mutable (in-place classified);
 *   `centroids` is the length-8 array of cluster means (ascending).
 */
export function generateMoxnessEdgeClasses(roots8D: number[][]): {
	edges: EdgeNorm[];
	centroids: number[];
} {
	const edges = computePetrieEdgeNorms(roots8D);
	const centroids = classifyEdgesByNorm(edges);
	return { edges, centroids };
}
