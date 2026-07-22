import { describe, expect, it } from "vitest";
import { CANONICAL_3D_SHELL_MULTISET } from "../e8-3d-fold-projection";
import {
	getE8PlatonicHulls,
	getTotalPlatonicHullEdgeCount,
} from "../e8-platonic-hulls";

describe("e8-platonic-hulls", () => {
	it("partitions the 240 vertices into 8 concentric shells", () => {
		const hulls = getE8PlatonicHulls();
		expect(hulls.length).toBe(8);

		const totalVertices = hulls.reduce((s, h) => s + h.vertexCount, 0);
		expect(totalVertices).toBe(240);
	});

	it("reproduces the canonical 8-shell radial multiset {4, 24, 24, 30, 30, 40, 40, 48}", () => {
		const hulls = getE8PlatonicHulls();
		const counts = hulls.map((h) => h.vertexCount).sort((a, b) => a - b);
		const canonical = CANONICAL_3D_SHELL_MULTISET.toSorted((a, b) => a - b);
		expect(counts).toEqual(canonical);
	});

	it("orders the hulls by ascending radius", () => {
		const hulls = getE8PlatonicHulls();
		for (let i = 1; i < hulls.length; i++) {
			expect(hulls[i].radius).toBeGreaterThan(hulls[i - 1].radius);
		}
	});

	it("locks the inner→outer vertex-count ordering as a regression baseline", () => {
		// Snapshot of vertex counts per shell sorted by ascending radius.
		// Confirms the canonical multiset {4, 24, 24, 30, 30, 40, 40, 48}
		// AND that bucketing by radius is deterministic across runs.
		// Order differs from Moxness 2020 Fig. 5's table layout (his table
		// row order may not be strict-ascending radius); the canonical
		// scientific claim is the multiset, verified by the test above.
		const hulls = getE8PlatonicHulls();
		expect(hulls.map((h) => h.vertexCount)).toEqual([
			4, 24, 40, 48, 30, 40, 24, 30,
		]);
	});

	it("origin shell has 4 coincident vertices and 0 edges", () => {
		const hulls = getE8PlatonicHulls();
		const origin = hulls.find((h) => h.radius < 1e-9);
		expect(origin).toBeDefined();
		if (!origin) return;
		expect(origin.vertexCount).toBe(4);
		expect(origin.edgeCount).toBe(0);
		expect(origin.edges.length).toBe(0);
	});

	it("non-origin shells have non-empty edge skeletons", () => {
		const hulls = getE8PlatonicHulls();
		for (const h of hulls) {
			if (h.radius < 1e-9) continue;
			expect(h.edgeCount).toBeGreaterThan(0);
			expect(h.edges.length).toBe(h.edgeCount * 6);
			expect(h.edgeLength).toBeGreaterThan(0);
		}
	});

	it("every vertex in a shell has the same radius (within Float32 tolerance)", () => {
		const hulls = getE8PlatonicHulls();
		for (const h of hulls) {
			for (let i = 0; i < h.vertexCount; i++) {
				const x = h.vertices[i * 3 + 0];
				const y = h.vertices[i * 3 + 1];
				const z = h.vertices[i * 3 + 2];
				const r = Math.sqrt(x * x + y * y + z * z);
				expect(r).toBeCloseTo(h.radius, 4);
			}
		}
	});

	it("edge length within a shell is the minimum within-shell pair distance", () => {
		const hulls = getE8PlatonicHulls();
		for (const h of hulls) {
			if (h.edgeCount === 0) continue;
			let actualMin = Infinity;
			for (let i = 0; i < h.vertexCount; i++) {
				for (let j = i + 1; j < h.vertexCount; j++) {
					const dx = h.vertices[i * 3 + 0] - h.vertices[j * 3 + 0];
					const dy = h.vertices[i * 3 + 1] - h.vertices[j * 3 + 1];
					const dz = h.vertices[i * 3 + 2] - h.vertices[j * 3 + 2];
					const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
					if (d > 0 && d < actualMin) actualMin = d;
				}
			}
			expect(h.edgeLength).toBeCloseTo(actualMin, 5);
		}
	});

	it("getTotalPlatonicHullEdgeCount sums all shell edges", () => {
		const hulls = getE8PlatonicHulls();
		const total = hulls.reduce((s, h) => s + h.edgeCount, 0);
		expect(getTotalPlatonicHullEdgeCount()).toBe(total);
	});
});
