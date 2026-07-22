/**
 * Tests for E8 root system geometry.
 *
 * Validates the mathematical correctness of:
 * - 240 root vectors in 8 dimensions
 * - 3D projection via Moxness basis
 * - Hull classification into 5 and 8 concentric shells
 * - Petrie ring classification (8 visual clusters via k-means)
 * - E8Vertex convenience wrapper
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
	classifyHulls,
	classifyHulls8,
	computeE8Edges,
	type E8Vertex,
	generateE8RootSystem,
	generateE8Vertices,
	generateE8Vertices8Hull,
	projectTo3D,
} from "../e8-geometry";
import {
	classifyPetrieRings,
	generatePetrieMandala,
	projectAllPetrie2D,
} from "../e8-projections";

describe("generateE8RootSystem", () => {
	let roots: number[][];

	beforeAll(() => {
		roots = generateE8RootSystem();
	});

	it("should return exactly 240 root vectors", () => {
		expect(roots.length).toBe(240);
	});

	it("should return 8-dimensional vectors", () => {
		for (const v of roots) {
			expect(v.length).toBe(8);
		}
	});

	it("should contain Family 1 vectors (112 permutations of +/-1,+/-1,0,...,0)", () => {
		const family1 = roots.filter((v) => {
			const nonZero = v.filter((x) => x !== 0);
			return nonZero.length === 2 && nonZero.every((x) => Math.abs(x) === 1);
		});
		expect(family1.length).toBe(112);
	});

	it("should contain Family 2 vectors (128 half-integer vectors with even minus signs)", () => {
		const family2 = roots.filter((v) => {
			return v.every((x) => Math.abs(x) === 0.5);
		});
		expect(family2.length).toBe(128);
	});

	it("Family 2 vectors should have an even number of negative components", () => {
		const family2 = roots.filter((v) => v.every((x) => Math.abs(x) === 0.5));
		for (const v of family2) {
			const negCount = v.filter((x) => x < 0).length;
			expect(negCount % 2).toBe(0);
		}
	});

	it("every root vector should have norm sqrt(2)", () => {
		for (const v of roots) {
			const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
			expect(norm).toBeCloseTo(Math.SQRT2, 10);
		}
	});

	it("should contain no duplicate vectors", () => {
		const seen = new Set<string>();
		for (const v of roots) {
			const key = v.map((x) => x.toFixed(6)).join(",");
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});

	it("should include specific known roots", () => {
		// (1,1,0,0,0,0,0,0) should be in the system
		const hasRoot = roots.some(
			(v) => v[0] === 1 && v[1] === 1 && v.slice(2).every((x) => x === 0),
		);
		expect(hasRoot).toBe(true);

		// (0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5) should be in the system (0 minus signs = even)
		const hasHalfRoot = roots.some((v) => v.every((x) => x === 0.5));
		expect(hasHalfRoot).toBe(true);
	});
});

describe("projectTo3D", () => {
	let roots: number[][];
	let projected: [number, number, number][];

	beforeAll(() => {
		roots = generateE8RootSystem();
		projected = projectTo3D(roots);
	});

	it("should return same count as input", () => {
		expect(projected.length).toBe(roots.length);
	});

	it("should return 3-element tuples", () => {
		for (const p of projected) {
			expect(p.length).toBe(3);
		}
	});

	it("should return finite numbers", () => {
		for (const p of projected) {
			expect(Number.isFinite(p[0])).toBe(true);
			expect(Number.isFinite(p[1])).toBe(true);
			expect(Number.isFinite(p[2])).toBe(true);
		}
	});

	it("should produce non-zero projections (not all collapsed to origin)", () => {
		const allZero = projected.every(
			(p) =>
				Math.abs(p[0]) < 1e-10 &&
				Math.abs(p[1]) < 1e-10 &&
				Math.abs(p[2]) < 1e-10,
		);
		expect(allZero).toBe(false);
	});

	it("projections should span a reasonable 3D volume (not degenerate)", () => {
		const xs = projected.map((p) => p[0]);
		const ys = projected.map((p) => p[1]);
		const zs = projected.map((p) => p[2]);
		const rangeX = Math.max(...xs) - Math.min(...xs);
		const rangeY = Math.max(...ys) - Math.min(...ys);
		const rangeZ = Math.max(...zs) - Math.min(...zs);
		// Should have extent in all 3 axes
		expect(rangeX).toBeGreaterThan(0.1);
		expect(rangeY).toBeGreaterThan(0.1);
		expect(rangeZ).toBeGreaterThan(0.1);
	});
});

describe("classifyHulls", () => {
	let projected: [number, number, number][];
	let hulls: number[];

	beforeAll(() => {
		const roots = generateE8RootSystem();
		projected = projectTo3D(roots);
		hulls = classifyHulls(projected);
	});

	it("should return same count as input", () => {
		expect(hulls.length).toBe(projected.length);
	});

	it("should assign hull indices 0-4", () => {
		for (const h of hulls) {
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThanOrEqual(4);
		}
	});

	it("should use all 5 hull indices", () => {
		const uniqueHulls = new Set(hulls);
		expect(uniqueHulls.size).toBe(5);
	});

	it("hull 0 vertices should be closer to origin than hull 4 vertices", () => {
		const norm = (p: [number, number, number]) =>
			Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2);

		const hull0Norms = projected.filter((_, i) => hulls[i] === 0).map(norm);
		const hull4Norms = projected.filter((_, i) => hulls[i] === 4).map(norm);

		const maxHull0 = Math.max(...hull0Norms);
		const minHull4 = Math.min(...hull4Norms);
		expect(maxHull0).toBeLessThan(minHull4);
	});

	it("should be deterministic", () => {
		const hulls2 = classifyHulls(projected);
		expect(hulls2).toEqual(hulls);
	});
});

describe("generateE8Vertices", () => {
	let vertices: E8Vertex[];

	beforeAll(() => {
		vertices = generateE8Vertices();
	});

	it("should return exactly 240 vertices", () => {
		expect(vertices.length).toBe(240);
	});

	it("each vertex should have correct shape", () => {
		for (const v of vertices) {
			expect(typeof v.index).toBe("number");
			expect(v.coords8D.length).toBe(8);
			expect(v.position3D.length).toBe(3);
			expect(typeof v.norm3D).toBe("number");
			expect(typeof v.hull).toBe("number");
			expect(v.hull).toBeGreaterThanOrEqual(0);
			expect(v.hull).toBeLessThanOrEqual(4);
		}
	});

	it("index should be sequential 0..239", () => {
		for (let i = 0; i < vertices.length; i++) {
			expect(vertices[i].index).toBe(i);
		}
	});

	it("norm3D should match position3D magnitude", () => {
		for (const v of vertices) {
			const computed = Math.sqrt(
				v.position3D[0] ** 2 + v.position3D[1] ** 2 + v.position3D[2] ** 2,
			);
			expect(v.norm3D).toBeCloseTo(computed, 10);
		}
	});

	it("should be deterministic across calls", () => {
		const vertices2 = generateE8Vertices();
		expect(vertices2.length).toBe(vertices.length);
		for (let i = 0; i < vertices.length; i++) {
			expect(vertices2[i].position3D).toEqual(vertices[i].position3D);
			expect(vertices2[i].hull).toBe(vertices[i].hull);
		}
	});
});

// ---------------------------------------------------------------------------
// 8-Hull Classification
// ---------------------------------------------------------------------------

describe("classifyHulls8", () => {
	let projected: [number, number, number][];
	let hulls: number[];

	beforeAll(() => {
		const roots = generateE8RootSystem();
		projected = projectTo3D(roots);
		hulls = classifyHulls8(projected);
	});

	it("should return 240 hull assignments", () => {
		expect(hulls.length).toBe(240);
	});

	it("should assign hull indices 0-7", () => {
		for (const h of hulls) {
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThanOrEqual(7);
		}
	});

	it("should use all 8 hull indices", () => {
		const uniqueHulls = new Set(hulls);
		expect(uniqueHulls.size).toBe(8);
	});

	it("hull vertex counts should sum to 240", () => {
		const counts: Record<number, number> = {};
		for (const h of hulls) {
			counts[h] = (counts[h] ?? 0) + 1;
		}
		const total = Object.values(counts).reduce((a, b) => a + b, 0);
		expect(total).toBe(240);
	});

	it("every hull should have at least 2 vertices", () => {
		const counts: number[] = Array(8).fill(0);
		for (const h of hulls) counts[h]++;
		for (let hull = 0; hull < 8; hull++) {
			expect(counts[hull]).toBeGreaterThanOrEqual(2);
		}
	});

	it("hull radii should be monotonically ordered (inner < outer)", () => {
		// Compute mean radius per hull
		const roots = generateE8RootSystem();
		const projected = projectTo3D(roots);
		const norms = projected.map((p) =>
			Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2),
		);
		const sums = Array(8).fill(0);
		const counts = Array(8).fill(0);
		for (let i = 0; i < norms.length; i++) {
			sums[hulls[i]] += norms[i];
			counts[hulls[i]]++;
		}
		const meanRadii = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
		for (let i = 1; i < 8; i++) {
			expect(meanRadii[i]).toBeGreaterThan(meanRadii[i - 1]);
		}
	});

	it("should be deterministic", () => {
		const hulls2 = classifyHulls8(projected);
		expect(hulls2).toEqual(hulls);
	});
});

// ---------------------------------------------------------------------------
// Petrie Rings (Coxeter eigenplane basis, 8 visual clusters via k-means)
// ---------------------------------------------------------------------------

describe("Petrie ring classification", () => {
	let roots: number[][];
	let rings: number[];

	beforeAll(() => {
		roots = generateE8RootSystem();
		const projected2D = projectAllPetrie2D(roots);
		rings = classifyPetrieRings(projected2D);
	});

	it("should assign 240 ring indices", () => {
		expect(rings.length).toBe(240);
	});

	it("should assign ring indices 0-7", () => {
		for (const r of rings) {
			expect(r).toBeGreaterThanOrEqual(0);
			expect(r).toBeLessThanOrEqual(7);
		}
	});

	it("should use all 8 ring indices", () => {
		expect(new Set(rings).size).toBe(8);
	});

	it("every ring should have at least 2 vertices", () => {
		const counts: number[] = Array(8).fill(0);
		for (const r of rings) counts[r]++;
		for (let ring = 0; ring < 8; ring++) {
			expect(counts[ring]).toBeGreaterThanOrEqual(2);
		}
	});

	it("ring radii should be monotonically ordered (inner < outer)", () => {
		const projected2D = projectAllPetrie2D(roots);
		const radii = projected2D.map(([x, y]) => Math.sqrt(x * x + y * y));
		const sums = Array(8).fill(0);
		const counts = Array(8).fill(0);
		for (let i = 0; i < radii.length; i++) {
			sums[rings[i]] += radii[i];
			counts[rings[i]]++;
		}
		const meanRadii = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
		for (let i = 1; i < 8; i++) {
			expect(meanRadii[i]).toBeGreaterThan(meanRadii[i - 1]);
		}
	});

	it("should be deterministic", () => {
		const projected2D = projectAllPetrie2D(roots);
		const rings2 = classifyPetrieRings(projected2D);
		expect(rings2).toEqual(rings);
	});
});

// ---------------------------------------------------------------------------
// E8 Edge Computation (8D inner product adjacency)
// ---------------------------------------------------------------------------

describe("computeE8Edges", () => {
	let roots: number[][];
	let edges: [number, number][];

	beforeAll(() => {
		roots = generateE8RootSystem();
		edges = computeE8Edges(roots);
	});

	it("should return exactly 6720 edges", () => {
		expect(edges.length).toBe(6720);
	});

	it("each edge should be a pair of vertex indices", () => {
		for (const [a, b] of edges) {
			expect(a).toBeGreaterThanOrEqual(0);
			expect(a).toBeLessThan(240);
			expect(b).toBeGreaterThanOrEqual(0);
			expect(b).toBeLessThan(240);
			expect(a).not.toBe(b);
		}
	});

	it("edges should be ordered (a < b) with no duplicates", () => {
		const seen = new Set<string>();
		for (const [a, b] of edges) {
			expect(a).toBeLessThan(b);
			const key = `${a}-${b}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});

	it("connected roots should have 8D inner product = 1", () => {
		for (const [a, b] of edges.slice(0, 100)) {
			const dot = roots[a].reduce((s, x, i) => s + x * roots[b][i], 0);
			expect(dot).toBeCloseTo(1.0, 6);
		}
	});

	it("each vertex should have exactly 56 neighbors", () => {
		const degree = new Array(240).fill(0);
		for (const [a, b] of edges) {
			degree[a]++;
			degree[b]++;
		}
		for (let i = 0; i < 240; i++) {
			expect(degree[i]).toBe(56);
		}
	});

	it("should be deterministic", () => {
		const edges2 = computeE8Edges(roots);
		expect(edges2).toEqual(edges);
	});
});
