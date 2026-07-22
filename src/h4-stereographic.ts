/**
 * H4 600-cell — stereographic projection from S³ + 1-parameter SO(4) rotation.
 *
 * The 600-cell sits as 120 unit vectors on the 3-sphere S³ ⊂ ℝ⁴. Two ways to
 * see it in 3D:
 *
 *   - Orthogonal drop of one axis — produces a Schlegel-like static image
 *     with straight chord edges. Fine for a still hero shot; misses the
 *     polytope's 4D nature.
 *   - **Stereographic projection from S³** — point (w, x, y, z) on S³ maps
 *     to (x, y, z) / (1 − w). Geodesic arcs on S³ project to circular
 *     arcs in ℝ³ (the Pardesco "curved edge" reading); the polytope reads
 *     as a system of nested circles. This is the Pardesco / vZome
 *     production pattern for animated 4D polytopes.
 *
 * Add a 1-parameter SO(4) rotation `R(θ)` applied to every vertex BEFORE
 * stereographic projection and the polytope visibly rotates in 4D — points
 * cross from the "back" (w → 1) to the "front" (w → −1) and vice versa,
 * passing through the equatorial w = 0 plane where they reach maximum
 * apparent distance. This is what `4d.pardesco.com` demonstrates.
 *
 * The kernel here is pure math — no Three.js, no rendering. Tests assert
 * stereographic properties (north-pole singularity, equatorial fixed),
 * SO(4) rotation properties (orthogonal, det = 1, identity at θ = 0,
 * preserves S³), and that projecting the rotated polytope at θ = 0
 * matches the orthogonal-drop convention's *vertex set* (different image,
 * same combinatorial type).
 *
 * Citations:
 *   - Coxeter, *Regular Polytopes* (1973) §22.4 — 600-cell construction.
 *   - Hopf, "Über die Abbildungen der dreidimensionalen Sphäre auf die
 *     Kugelfläche" (1931) — Hopf fibration; 1-parameter SO(4) subgroups.
 *   - 4d.pardesco.com viewer + github.com/Pardesco/4d-polytope-viewer —
 *     production reference for stereographic 4D rendering.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Vec4 = readonly [number, number, number, number];
export type Vec3 = readonly [number, number, number];
export type Mat4 = readonly [Vec4, Vec4, Vec4, Vec4];

// ---------------------------------------------------------------------------
// Stereographic projection
// ---------------------------------------------------------------------------

/**
 * Stereographic projection from S³ to ℝ³, projecting from the "north pole"
 * `(1, 0, 0, 0)`. A point `(w, x, y, z)` with `w² + x² + y² + z² = 1` maps to
 * `(x, y, z) / (1 − w)`. The pole itself maps to ∞ — callers must avoid
 * sending the north pole through this function.
 *
 * For numerical safety, returns `null` when `1 − w` falls below `eps`
 * (default `1e-9`) so callers can decide how to handle near-pole points
 * (skip the edge, expand the singularity to a finite cap, etc).
 */
export function stereographicS3ToR3(v: Vec4, eps = 1e-9): Vec3 | null {
	const denom = 1 - v[0];
	if (denom < eps) return null;
	return [v[1] / denom, v[2] / denom, v[3] / denom];
}

// ---------------------------------------------------------------------------
// 1-parameter SO(4) rotations
// ---------------------------------------------------------------------------

/**
 * Single-plane rotation in the (w, x) plane by angle θ. `(y, z)` are fixed.
 * This is the simplest 1-parameter SO(4) subgroup; geometrically it tilts
 * the polytope so vertices pass through the equator `w = 0`.
 *
 *   R(θ) = [ cos θ, −sin θ, 0, 0 ]
 *          [ sin θ,  cos θ, 0, 0 ]
 *          [ 0,     0,     1, 0 ]
 *          [ 0,     0,     0, 1 ]
 */
export function so4RotationWX(theta: number): Mat4 {
	const c = Math.cos(theta);
	const s = Math.sin(theta);
	return [
		[c, -s, 0, 0],
		[s, c, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 1],
	];
}

/**
 * Hopf-style left-isoclinic SO(4) rotation: rotate by θ in the (w, x)
 * plane AND by θ in the (y, z) plane simultaneously. Every vertex on S³
 * traces a great circle of the Hopf fibration; the polytope appears to
 * rotate "around itself" in 4D rather than just tilt.
 *
 *   R(θ) = [ cos θ, −sin θ,  0,    0      ]
 *          [ sin θ,  cos θ,  0,    0      ]
 *          [ 0,     0,      cos θ, −sin θ ]
 *          [ 0,     0,      sin θ,  cos θ ]
 */
export function so4RotationHopf(theta: number): Mat4 {
	const c = Math.cos(theta);
	const s = Math.sin(theta);
	return [
		[c, -s, 0, 0],
		[s, c, 0, 0],
		[0, 0, c, -s],
		[0, 0, s, c],
	];
}

/** Apply a 4×4 matrix to a 4-vector (column-vector convention: out = M · v). */
export function applyMat4(M: Mat4, v: Vec4): Vec4 {
	return [
		M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2] + M[0][3] * v[3],
		M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2] + M[1][3] * v[3],
		M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2] + M[2][3] * v[3],
		M[3][0] * v[0] + M[3][1] * v[1] + M[3][2] * v[2] + M[3][3] * v[3],
	];
}

// ---------------------------------------------------------------------------
// Combined: stereographic projection of rotated 600-cell vertices
// ---------------------------------------------------------------------------

export interface StereographicEdgeBuffer {
	/** Flat Float32Array of LineSegments-ready positions —
	 *  `[ax, ay, az, bx, by, bz, ...]`.
	 *  Length ≤ `edgeCount * segmentsPerEdge * 2 * 3`; some segments may be
	 *  dropped when both endpoints fall on / near the projection's north
	 *  pole. Use `validSegmentCount` for the actual filled length / 6. */
	positions: Float32Array;
	/** Number of segments actually written (each is 2 endpoints × 3
	 *  coords = 6 floats in `positions`). */
	validSegmentCount: number;
}

/**
 * Build the LineSegments-ready position buffer for the 600-cell's 720
 * edges, each tessellated into `segmentsPerEdge` straight pieces along the
 * great-circle arc on S³, then **stereographically projected** to ℝ³ AFTER
 * applying the SO(4) rotation `R`. Output positions are uniformly scaled
 * by `scale`.
 *
 * Segments where either endpoint sits within `eps` of the projection's
 * north pole are dropped — the singularity blows up the projection, and
 * the visual cost of including them is one or two stretched-to-infinity
 * lines per frame. Net loss is at most a handful of segments out of
 * `720 × segmentsPerEdge` (typically 0–4 for moderate θ).
 */
export function buildStereographic600CellEdges(input: {
	verts4D: readonly Vec4[];
	edges: readonly (readonly [number, number])[];
	rotation: Mat4;
	segmentsPerEdge: number;
	scale: number;
	eps?: number;
}): StereographicEdgeBuffer {
	const { verts4D, edges, rotation, segmentsPerEdge, scale } = input;
	const eps = input.eps ?? 1e-9;

	// 1. Rotate every vertex once and cache.
	const rotated: Vec4[] = verts4D.map((v) => applyMat4(rotation, v));

	// 2. Allocate worst-case buffer; we may drop near-pole segments.
	const positions = new Float32Array(edges.length * segmentsPerEdge * 2 * 3);
	let writeIdx = 0;
	let validSegments = 0;

	for (const [ai, bi] of edges) {
		const a = rotated[ai];
		const b = rotated[bi];
		// Slerp parameters: a · b is the cosine of the great-circle angle
		// between unit vectors a and b on S³.
		const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
		const cosTheta = Math.max(-1, Math.min(1, dot));
		const omega = Math.acos(cosTheta);
		const sinOmega = Math.sin(omega);

		// Parametric sample along the arc: p(u) = (sin((1-u)·ω)·a +
		// sin(u·ω)·b) / sin(ω). u ∈ [0, 1]. Sample N+1 points, emit N
		// segments as adjacent pairs.
		const samples: (Vec4 | null)[] = new Array(segmentsPerEdge + 1);
		for (let i = 0; i <= segmentsPerEdge; i++) {
			const u = i / segmentsPerEdge;
			let q: Vec4;
			if (sinOmega < 1e-9) {
				// Numerically degenerate slerp (a ≈ b); just return a.
				q = a;
			} else {
				const wa = Math.sin((1 - u) * omega) / sinOmega;
				const wb = Math.sin(u * omega) / sinOmega;
				q = [
					wa * a[0] + wb * b[0],
					wa * a[1] + wb * b[1],
					wa * a[2] + wb * b[2],
					wa * a[3] + wb * b[3],
				];
			}
			samples[i] = q;
		}

		// 3. Stereographic-project samples and emit segments.
		const projected: (Vec3 | null)[] = samples.map((s) =>
			s ? stereographicS3ToR3(s, eps) : null,
		);

		for (let i = 0; i < segmentsPerEdge; i++) {
			const p0 = projected[i];
			const p1 = projected[i + 1];
			if (!p0 || !p1) continue; // Drop segment touching the north pole.
			positions[writeIdx + 0] = p0[0] * scale;
			positions[writeIdx + 1] = p0[1] * scale;
			positions[writeIdx + 2] = p0[2] * scale;
			positions[writeIdx + 3] = p1[0] * scale;
			positions[writeIdx + 4] = p1[1] * scale;
			positions[writeIdx + 5] = p1[2] * scale;
			writeIdx += 6;
			validSegments++;
		}
	}

	return { positions, validSegmentCount: validSegments };
}
