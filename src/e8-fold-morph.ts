/**
 * E8 fold morph — pre-computed endpoint positions for the canonical
 * Petrie-2D → Moxness-3D-fold animation.
 *
 * A lerp between two MATHEMATICALLY GROUNDED canonical projections of the
 * SAME 240 E8 root vectors:
 *
 *   t=0  → (mandala_x, mandala_y, 0)          — the E8 Coxeter-plane mandala
 *                                                (projectCoxeterPlane2D, the
 *                                                verified 30-fold projection),
 *                                                embedded as a flat z=0 disk
 *   t=1  → (folded[1], folded[2], folded[3])  — Moxness 2019 canonical 3D
 *                                                via H4_UNI rows 0-3 + drop
 *                                                ST-axis (eigenvalue 2·ST)
 *
 * The morph reads as the Moxness narrative made visible: the 2D Petrie
 * mandala IS a shadow of the 4D 600-cell which IS a shadow of the 8D E8
 * root system. Lifting from t=0 to t=1 unfolds the shadow back into
 * 3D and the 8 Petrie rings physically separate into the canonical
 * 8-shell radial multiset {4, 24, 24, 30, 30, 40, 40, 48}.
 *
 * Both endpoints come from existing tested math — `projectCoxeterPlane2D`
 * (e8-coxeter-plane.ts) and `projectTo3DViaFold` (e8-3d-fold-projection.ts)
 * — so this module adds zero new math claims. It just provides the GPU
 * shader two pre-baked attribute arrays so the morph runs as
 * `mix(posPetrie, posFold, uFoldT)` in the vertex shader, no per-frame
 * 8D matrix multiply.
 *
 * Math citations:
 *   - Coxeter, *Regular Polytopes* (Dover, 1973) §13.4 (Petrie polygon).
 *   - Stembridge, "Coxeter Planes" (U. Mich., archived) — canonical
 *     computer rendering of the Petrie projection after McMullen's hand
 *     drawing.
 *   - Moxness, *Unimodular rotation of E8 to H4 600-cells* (2019),
 *     vixra:1910.0345. H4_UNI matrix (det=1).
 *   - Moxness, *The 3D Visualization of E8 Using an H4 Folding Matrix*
 *     (2014). H4_FOLD matrix Eq. 1.
 */

import { projectTo3DViaFold } from "./e8-3d-fold-projection";
import { projectCoxeterPlane2D } from "./e8-coxeter-plane";
import { generateE8RootSystem } from "./e8-geometry";

const E8_VERTEX_COUNT = 240;

export interface E8FoldMorphEndpoints {
	/** Flat Float64Array, 240*3 length. Index 3i..3i+2 = [x, y, z=0] for
	 *  E8 root i in the canonical Coxeter-plane 2D projection (the verified
	 *  30-fold mandala). Float64 preserves the canonical-math precision;
	 *  convert via `toFloat32` at the GPU attribute boundary. */
	posPetrie3D: Float64Array;
	/** Flat Float64Array, 240*3 length. Index 3i..3i+2 = (folded[1],
	 *  folded[2], folded[3]) for E8 root i — the canonical Moxness 3D
	 *  fold via H4_UNI rows 0-3 with ST-axis dropped. */
	posFold3D: Float64Array;
}

let cachedEndpoints: E8FoldMorphEndpoints | null = null;

/**
 * Compute (or return cached) endpoint positions. Idempotent — the underlying
 * math is deterministic and small enough that a one-shot bake is the simplest
 * path. Cache lives at module scope; cleared only by a full module reload.
 */
export function getE8FoldMorphEndpoints(): E8FoldMorphEndpoints {
	if (cachedEndpoints) return cachedEndpoints;

	const roots = generateE8RootSystem();
	if (roots.length !== E8_VERTEX_COUNT) {
		throw new Error(
			`E8 root count mismatch: expected ${E8_VERTEX_COUNT}, got ${roots.length}`,
		);
	}

	const posPetrie3D = new Float64Array(E8_VERTEX_COUNT * 3);
	const posFold3D = new Float64Array(E8_VERTEX_COUNT * 3);

	const fold3D = projectTo3DViaFold(roots);

	for (let i = 0; i < E8_VERTEX_COUNT; i++) {
		const [px, py] = projectCoxeterPlane2D(roots[i]);
		const [fx, fy, fz] = fold3D[i];
		const o = i * 3;
		posPetrie3D[o + 0] = px;
		posPetrie3D[o + 1] = py;
		posPetrie3D[o + 2] = 0;
		posFold3D[o + 0] = fx;
		posFold3D[o + 1] = fy;
		posFold3D[o + 2] = fz;
	}

	cachedEndpoints = { posPetrie3D, posFold3D };
	return cachedEndpoints;
}

/**
 * Float32 view of the endpoints for direct upload to a GPU vertex buffer
 * (e.g. a three.js `BufferAttribute`). Computes once and caches; the GPU
 * only reads float32 anyway.
 */
let cachedFloat32: {
	posPetrie3D: Float32Array;
	posFold3D: Float32Array;
} | null = null;
export function getE8FoldMorphEndpointsFloat32(): {
	posPetrie3D: Float32Array;
	posFold3D: Float32Array;
} {
	if (cachedFloat32) return cachedFloat32;
	const { posPetrie3D, posFold3D } = getE8FoldMorphEndpoints();
	cachedFloat32 = {
		posPetrie3D: new Float32Array(posPetrie3D),
		posFold3D: new Float32Array(posFold3D),
	};
	return cachedFloat32;
}

/**
 * CPU implementation of the same lerp the GPU shader runs — used for parity
 * tests and for any non-shader consumer (e.g. preview / static screenshots).
 *
 * Returns a fresh Float64Array of length 240*3 with the per-vertex 3D
 * position at the requested `t`. Linearly interpolates between the Petrie
 * 2D embedding (t=0) and the Moxness 3D fold (t=1).
 */
export function computeE8FoldMorphPositions(t: number): Float64Array {
	const clamped = Math.max(0, Math.min(1, t));
	const { posPetrie3D, posFold3D } = getE8FoldMorphEndpoints();
	const out = new Float64Array(E8_VERTEX_COUNT * 3);
	const oneMinusT = 1 - clamped;
	for (let i = 0; i < posPetrie3D.length; i++) {
		out[i] = oneMinusT * posPetrie3D[i] + clamped * posFold3D[i];
	}
	return out;
}
