/**
 * E8 → 8 concentric Platonic / Archimedean hulls in 3D.
 *
 * Moxness 2020, "3D Polytope Hulls of E8", Fig. 5, shows the 4₂₁ E8 root
 * system, projected to 3D via H4_UNI rows 2-4
 * (the "Platonic Solid Projection Prism" derived from the icosahedron's three
 * mutually-perpendicular golden rectangles), splits into **8 concentric
 * polytope hulls**. The radial multiset is the canonical
 * `{4, 24, 24, 30, 30, 40, 40, 48}` (= 240).
 *
 * From the paper page 3:
 *   "This Platonic solid projection in 3D manifests a large number of
 *    concentric hulls with Platonic and Archimedean solid related
 *    structures. The 8 hull 4₂₁ ... includes two 4 hull 600-cell
 *    structures (H4 & H4Φ)."
 *
 * Concretely the 240 → 8 radii (Fig. 5 table, sorted by ascending radius):
 *
 *   radius  symbolic            vertex count
 *   0       0                   4    (origin — ST-axis-projected vertices)
 *   0.727   √(1 − 2/√5)         24   (inner H4 24-cell echo)
 *   1.07    √((2/3)(3 − √5))    40
 *   1.176   √((1/5)(1 + √5))    48
 *   1.236   −1 + √5             40
 *   1.732   √3                  30
 *   1.902   √((1/2)(1 + √5))    30
 *   2       2                   24   (outer H4Φ 24-cell echo)
 *
 * A typical GPU consumer needs:
 *   1. Group the 240 `posFold3D` vertices by radius into 8 buckets.
 *   2. For each bucket with N ≥ 2 vertices, compute the convex-hull edge
 *      skeleton — pairs of vertices at the minimum within-shell distance.
 *      This is the canonical polytope edge set; rendering it as
 *      `LineSegments` shows the platonic structure visibly.
 *
 * The kernel is read-only: it reuses `getE8FoldMorphEndpoints()` from
 * `e8-fold-morph.ts` (cached). Output is two `Float32Array`s per shell
 * (vertices + edge positions) plus a small index of metadata.
 *
 * No new math claims — every step composes existing tested primitives.
 */

import { getE8FoldMorphEndpoints } from "./e8-fold-morph";

const E8_VERTEX_COUNT = 240;
const SHELL_COUNT = 8;

// Radius-bucketing tolerance. The 8 canonical radii are well-separated
// (closest pair: 1.07 → 1.176, gap 0.106). Float64 storage keeps the
// per-vertex norms within ~1e-12 of the symbolic values, so 1e-6 is a
// generous tolerance that buckets cleanly.
const RADIUS_BUCKET_EPS = 1e-6;

// Edge tolerance: within a shell, pairs at the minimum distance ± 0.1%
// count as edges. The Platonic / Archimedean polytopes have a single
// edge length per polytope, so the floor of pairwise distances is the
// canonical edge length.
const EDGE_LENGTH_EPS_REL = 1e-3;

export interface PlatonicHull {
	/** 0-indexed shell number, 0 = innermost (smallest radius). */
	index: number;
	/** Radius shared by every vertex in this shell. */
	radius: number;
	/** Vertex count = 4 / 24 / 30 / 40 / 48 per the canonical multiset. */
	vertexCount: number;
	/**
	 * Flat Float32Array of vertex positions, length = vertexCount * 3.
	 * Position [3i, 3i+1, 3i+2] is vertex i in 3D fold space.
	 */
	vertices: Float32Array;
	/**
	 * Flat Float32Array of edge endpoint positions, length = edgeCount * 6
	 * (two vertices per edge × 3 components). Empty for shells with fewer
	 * than 2 vertices or where the edge skeleton is degenerate (e.g. the
	 * origin-shell with 4 coincident points has 0 edges).
	 */
	edges: Float32Array;
	/** Number of edges = `edges.length / 6`. */
	edgeCount: number;
	/** Canonical edge length within this shell, or 0 if no edges. */
	edgeLength: number;
}

let cachedHulls: PlatonicHull[] | null = null;

/**
 * Compute (or return cached) the 8 concentric Platonic / Archimedean hulls
 * of the E8 → 3D Moxness fold.
 *
 * Output is sorted by ascending radius (innermost first). Shell 0 is the
 * 4-vertex origin echo with 0 edges; shells 1-7 each have ≥ 24 vertices
 * with non-trivial edge skeletons.
 */
export function getE8PlatonicHulls(): PlatonicHull[] {
	if (cachedHulls) return cachedHulls;

	const { posFold3D } = getE8FoldMorphEndpoints();

	// 1. Compute per-vertex radius and bucket by distinct radii.
	const radiiByVertex = new Float64Array(E8_VERTEX_COUNT);
	const distinctRadii: number[] = [];
	const bucketByVertex = new Int32Array(E8_VERTEX_COUNT);

	for (let i = 0; i < E8_VERTEX_COUNT; i++) {
		const x = posFold3D[i * 3 + 0];
		const y = posFold3D[i * 3 + 1];
		const z = posFold3D[i * 3 + 2];
		const r = Math.sqrt(x * x + y * y + z * z);
		radiiByVertex[i] = r;

		let bucket = -1;
		for (let b = 0; b < distinctRadii.length; b++) {
			if (Math.abs(r - distinctRadii[b]) < RADIUS_BUCKET_EPS) {
				bucket = b;
				break;
			}
		}
		if (bucket === -1) {
			bucket = distinctRadii.length;
			distinctRadii.push(r);
		}
		bucketByVertex[i] = bucket;
	}

	if (distinctRadii.length !== SHELL_COUNT) {
		throw new Error(
			`E8 platonic-hull bucketing expected ${SHELL_COUNT} distinct radii, got ${distinctRadii.length} (radii: ${distinctRadii.join(", ")})`,
		);
	}

	// 2. Sort buckets by radius ascending; build a remap old→new bucket.
	const sortedRadii = Array.from(distinctRadii).toSorted((a, b) => a - b);
	const sortedRadiusIndex = new Map(
		sortedRadii.map((radius, index) => [radius, index]),
	);
	const oldToNew = new Int32Array(SHELL_COUNT);
	for (let oldB = 0; oldB < SHELL_COUNT; oldB++) {
		oldToNew[oldB] = sortedRadiusIndex.get(distinctRadii[oldB]) ?? -1;
	}

	// 3. Group vertex indices per shell.
	const verticesPerShell: number[][] = sortedRadii.map(() => []);
	for (let i = 0; i < E8_VERTEX_COUNT; i++) {
		const newB = oldToNew[bucketByVertex[i]];
		verticesPerShell[newB].push(i);
	}

	// 4. Build the hull objects.
	const hulls: PlatonicHull[] = [];
	for (let s = 0; s < SHELL_COUNT; s++) {
		const indices = verticesPerShell[s];
		const radius = sortedRadii[s];
		const vertexCount = indices.length;

		// Pack vertices into a Float32Array.
		const vertices = new Float32Array(vertexCount * 3);
		for (let i = 0; i < vertexCount; i++) {
			const v = indices[i];
			vertices[i * 3 + 0] = posFold3D[v * 3 + 0];
			vertices[i * 3 + 1] = posFold3D[v * 3 + 1];
			vertices[i * 3 + 2] = posFold3D[v * 3 + 2];
		}

		// Compute the minimum within-shell pair distance + edges at that
		// distance. Skipped if vertexCount < 2 or all vertices coincide
		// (origin shell).
		let edgeLength = 0;
		const edgePositions: number[] = [];
		if (vertexCount >= 2) {
			let minDist = Infinity;
			for (let i = 0; i < vertexCount; i++) {
				const ax = vertices[i * 3 + 0];
				const ay = vertices[i * 3 + 1];
				const az = vertices[i * 3 + 2];
				for (let j = i + 1; j < vertexCount; j++) {
					const bx = vertices[j * 3 + 0];
					const by = vertices[j * 3 + 1];
					const bz = vertices[j * 3 + 2];
					const dx = ax - bx;
					const dy = ay - by;
					const dz = az - bz;
					const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
					if (d > 0 && d < minDist) {
						minDist = d;
					}
				}
			}

			if (minDist < Infinity) {
				edgeLength = minDist;
				const tolerance = minDist * EDGE_LENGTH_EPS_REL;
				for (let i = 0; i < vertexCount; i++) {
					const ax = vertices[i * 3 + 0];
					const ay = vertices[i * 3 + 1];
					const az = vertices[i * 3 + 2];
					for (let j = i + 1; j < vertexCount; j++) {
						const bx = vertices[j * 3 + 0];
						const by = vertices[j * 3 + 1];
						const bz = vertices[j * 3 + 2];
						const dx = ax - bx;
						const dy = ay - by;
						const dz = az - bz;
						const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
						if (Math.abs(d - minDist) < tolerance) {
							edgePositions.push(ax, ay, az, bx, by, bz);
						}
					}
				}
			}
		}

		const edges = new Float32Array(edgePositions);
		hulls.push({
			index: s,
			radius,
			vertexCount,
			vertices,
			edges,
			edgeCount: edges.length / 6,
			edgeLength,
		});
	}

	cachedHulls = hulls;
	return cachedHulls;
}

/**
 * Sum of all hull `edgeCount` values — useful for sizing GPU buffers
 * upstream of the renderer.
 */
export function getTotalPlatonicHullEdgeCount(): number {
	return getE8PlatonicHulls().reduce((sum, h) => sum + h.edgeCount, 0);
}
