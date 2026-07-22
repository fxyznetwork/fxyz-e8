import { describe, expect, it } from "vitest";
import {
	applyMat4,
	buildStereographic600CellEdges,
	so4RotationHopf,
	so4RotationWX,
	stereographicS3ToR3,
	type Vec4,
} from "../h4-stereographic";

describe("h4-stereographic — projection kernel", () => {
	it("stereographic projection sends the equator (w=0) to the unit ball without distortion", () => {
		// Points with w = 0 sit on the "equator" of S³; stereographic from
		// the north pole (1,0,0,0) maps them to (x,y,z)/1 = (x,y,z).
		const equator: Vec4 = [0, 0.6, 0, 0.8]; // w² + x² + y² + z² = 0 + 0.36 + 0 + 0.64 = 1 ✓
		const result = stereographicS3ToR3(equator);
		expect(result).not.toBeNull();
		if (!result) return;
		expect(result[0]).toBeCloseTo(0.6, 9);
		expect(result[1]).toBeCloseTo(0, 9);
		expect(result[2]).toBeCloseTo(0.8, 9);
	});

	it("stereographic projection sends the south pole (-1, 0, 0, 0) to the origin", () => {
		// (-1, 0, 0, 0) ↦ (0, 0, 0) / 2 = (0, 0, 0).
		const south: Vec4 = [-1, 0, 0, 0];
		const result = stereographicS3ToR3(south);
		expect(result).not.toBeNull();
		if (!result) return;
		expect(result[0]).toBe(0);
		expect(result[1]).toBe(0);
		expect(result[2]).toBe(0);
	});

	it("stereographic projection refuses the north pole (singularity)", () => {
		expect(stereographicS3ToR3([1, 0, 0, 0])).toBeNull();
		// And anywhere within eps of the pole.
		expect(stereographicS3ToR3([0.9999999999, 1e-6, 0, 0])).toBeNull();
	});
});

describe("h4-stereographic — SO(4) rotations", () => {
	it("so4RotationWX(0) is the identity", () => {
		const R = so4RotationWX(0);
		const v: Vec4 = [0.5, 0.5, 0.5, 0.5];
		const out = applyMat4(R, v);
		expect(out[0]).toBeCloseTo(0.5, 12);
		expect(out[1]).toBeCloseTo(0.5, 12);
		expect(out[2]).toBeCloseTo(0.5, 12);
		expect(out[3]).toBeCloseTo(0.5, 12);
	});

	it("so4RotationWX(π/2) sends (1, 0, 0, 0) to (0, 1, 0, 0)", () => {
		const R = so4RotationWX(Math.PI / 2);
		const out = applyMat4(R, [1, 0, 0, 0]);
		expect(out[0]).toBeCloseTo(0, 12);
		expect(out[1]).toBeCloseTo(1, 12);
		expect(out[2]).toBeCloseTo(0, 12);
		expect(out[3]).toBeCloseTo(0, 12);
	});

	it("so4RotationWX preserves S³ (vertex norms stay 1)", () => {
		const verts: Vec4[] = [
			[1, 0, 0, 0],
			[0.5, 0.5, 0.5, 0.5],
			[Math.SQRT1_2, Math.SQRT1_2, 0, 0],
			[0, 0, 1, 0],
			[0.6, 0, 0.8, 0],
		];
		const R = so4RotationWX(1.234);
		for (const v of verts) {
			const out = applyMat4(R, v);
			const norm = Math.sqrt(
				out[0] ** 2 + out[1] ** 2 + out[2] ** 2 + out[3] ** 2,
			);
			expect(norm).toBeCloseTo(1, 10);
		}
	});

	it("so4RotationHopf preserves S³ at all angles", () => {
		const verts: Vec4[] = [
			[0.5, 0.5, 0.5, 0.5],
			[1, 0, 0, 0],
			[0, 1, 0, 0],
			[0, 0, 0, 1],
		];
		for (const theta of [0, 0.1, 1, Math.PI / 2, Math.PI, 2 * Math.PI]) {
			const R = so4RotationHopf(theta);
			for (const v of verts) {
				const out = applyMat4(R, v);
				const norm = Math.sqrt(
					out[0] ** 2 + out[1] ** 2 + out[2] ** 2 + out[3] ** 2,
				);
				expect(norm).toBeCloseTo(1, 10);
			}
		}
	});

	it("so4RotationHopf(2π) is identity", () => {
		const R = so4RotationHopf(2 * Math.PI);
		const v: Vec4 = [0.3, 0.4, 0.5, Math.sqrt(1 - 0.09 - 0.16 - 0.25)];
		const out = applyMat4(R, v);
		for (let i = 0; i < 4; i++) {
			expect(out[i]).toBeCloseTo(v[i], 10);
		}
	});

	it("so4RotationWX is orthogonal (R · Rᵀ = I)", () => {
		// Apply rotation then reverse rotation; should recover input.
		const R = so4RotationWX(0.789);
		const Rinv = so4RotationWX(-0.789);
		const v: Vec4 = [0.6, 0.8, 0, 0];
		const rotated = applyMat4(R, v);
		const recovered = applyMat4(Rinv, rotated);
		for (let i = 0; i < 4; i++) {
			expect(recovered[i]).toBeCloseTo(v[i], 12);
		}
	});
});

describe("h4-stereographic — buildStereographic600CellEdges", () => {
	// Synthetic minimal polytope: 4 vertices on S³ chosen so no edge's
	// slerp passes near the north pole (1, 0, 0, 0). Three equatorial
	// vertices + the south pole. Edges connect each equatorial vertex to
	// its neighbour and to the south pole.
	const TETRA_S3: Vec4[] = [
		[0, 1, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 1],
		[-1, 0, 0, 0], // south pole — projects to origin under stereographic
	];
	const TETRA_EDGES: [number, number][] = [
		[0, 1],
		[1, 2],
		[0, 3],
		[1, 3],
	];

	it("emits Float32Array sized for edges × segmentsPerEdge × 6", () => {
		const result = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationWX(0),
			segmentsPerEdge: 8,
			scale: 1,
		});
		expect(result.positions.length).toBe(TETRA_EDGES.length * 8 * 2 * 3);
	});

	it("at θ = 0 produces non-degenerate edges (validSegmentCount > 0 for off-pole vertices)", () => {
		// Tetrahedron sits at w = 1/√2, so vertices are NOT at the pole;
		// no slerp samples should hit the singularity for these edges.
		const result = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationWX(0),
			segmentsPerEdge: 8,
			scale: 1,
		});
		expect(result.validSegmentCount).toBe(TETRA_EDGES.length * 8);
	});

	it("rotation by 2π returns to the same projected geometry", () => {
		const a = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationHopf(0),
			segmentsPerEdge: 8,
			scale: 1,
		});
		const b = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationHopf(2 * Math.PI),
			segmentsPerEdge: 8,
			scale: 1,
		});
		expect(b.validSegmentCount).toBe(a.validSegmentCount);
		for (let i = 0; i < a.validSegmentCount * 6; i++) {
			expect(b.positions[i]).toBeCloseTo(a.positions[i], 5);
		}
	});

	it("rotation moves vertices that aren't fixed under the WX subgroup", () => {
		// At θ = π/2 the vertices with w > 0 swap their (w, x) components
		// with x. So the projected image differs from θ = 0.
		const baseline = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationWX(0),
			segmentsPerEdge: 4,
			scale: 1,
		});
		const rotated = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationWX(Math.PI / 4),
			segmentsPerEdge: 4,
			scale: 1,
		});
		// At least one position pair should differ — if buffers were
		// identical the rotation isn't actually animating anything.
		let differ = false;
		for (let i = 0; i < baseline.validSegmentCount * 6; i++) {
			if (Math.abs(baseline.positions[i] - rotated.positions[i]) > 1e-6) {
				differ = true;
				break;
			}
		}
		expect(differ).toBe(true);
	});

	it("scale uniformly multiplies output positions", () => {
		const a = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationWX(0),
			segmentsPerEdge: 4,
			scale: 1,
		});
		const b = buildStereographic600CellEdges({
			verts4D: TETRA_S3,
			edges: TETRA_EDGES,
			rotation: so4RotationWX(0),
			segmentsPerEdge: 4,
			scale: 3.4,
		});
		for (let i = 0; i < a.validSegmentCount * 6; i++) {
			expect(b.positions[i]).toBeCloseTo(a.positions[i] * 3.4, 5);
		}
	});

	it("drops segments that hit the north-pole singularity", () => {
		// Construct an edge whose midpoint passes near the north pole.
		// Two points on opposite sides of the pole's neighbourhood; the
		// slerp midpoint will be at (close-to-1, …) and should be dropped.
		const verts: Vec4[] = [
			[0.99, 0.141067, 0, 0], // ~0.99² + 0.141² ≈ 1
			[0.99, -0.141067, 0, 0],
		];
		// Re-normalise.
		const norm = (v: Vec4): Vec4 => {
			const n = Math.hypot(v[0], v[1], v[2], v[3]);
			return [v[0] / n, v[1] / n, v[2] / n, v[3] / n];
		};
		const verts4D = [norm(verts[0]), norm(verts[1])];
		const edges: [number, number][] = [[0, 1]];
		const result = buildStereographic600CellEdges({
			verts4D,
			edges,
			rotation: so4RotationWX(0),
			segmentsPerEdge: 8,
			scale: 1,
			eps: 1e-3, // Permissive eps to force pole-skip.
		});
		// At least the midpoint segments touching the pole should be
		// dropped.
		expect(result.validSegmentCount).toBeLessThan(8);
	});
});
