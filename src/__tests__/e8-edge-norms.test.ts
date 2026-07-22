import { describe, expect, it } from "vitest";
import { MOXNESS_RING_PALETTE } from "../e8-constants";
import {
	classifyEdgesByNorm,
	computePetrieEdgeNorms,
	generateMoxnessEdgeClasses,
} from "../e8-edge-norms";
import { generateE8RootSystem } from "../e8-geometry";

describe("computePetrieEdgeNorms", () => {
	it("produces exactly 6,720 edge entries (E8 edge count)", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		expect(edges).toHaveLength(6720);
	});

	it("each edge has a strictly-positive norm", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		for (const e of edges) {
			expect(e.norm2D).toBeGreaterThan(0);
			expect(Number.isFinite(e.norm2D)).toBe(true);
		}
	});

	it("each edge starts unclassified (classIdx = -1)", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		for (const e of edges) expect(e.classIdx).toBe(-1);
	});

	it("vertex indices satisfy i < j (matches computeE8Edges convention)", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		for (const e of edges) expect(e.i).toBeLessThan(e.j);
	});
});

describe("classifyEdgesByNorm", () => {
	it("assigns every edge to one of 8 classes", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		const centroids = classifyEdgesByNorm(edges);
		expect(centroids).toHaveLength(8);
		for (const e of edges) {
			expect(e.classIdx).toBeGreaterThanOrEqual(0);
			expect(e.classIdx).toBeLessThan(8);
		}
	});

	it("centroids are strictly ascending (class 0 = shortest)", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		const centroids = classifyEdgesByNorm(edges);
		for (let i = 1; i < 8; i++) {
			expect(centroids[i]).toBeGreaterThan(centroids[i - 1]);
		}
	});

	it("all 8 classes are non-empty", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		classifyEdgesByNorm(edges);
		const counts = new Array<number>(8).fill(0);
		for (const e of edges) counts[e.classIdx]++;
		for (let c = 0; c < 8; c++) {
			expect(counts[c]).toBeGreaterThan(0);
		}
	});

	it("total edges across classes = 6,720", () => {
		const roots = generateE8RootSystem();
		const edges = computePetrieEdgeNorms(roots);
		classifyEdgesByNorm(edges);
		const counts = new Array<number>(8).fill(0);
		for (const e of edges) counts[e.classIdx]++;
		expect(counts.reduce((a, b) => a + b, 0)).toBe(6720);
	});
});

describe("generateMoxnessEdgeClasses (combined)", () => {
	it("returns edges and centroids together", () => {
		const roots = generateE8RootSystem();
		const { edges, centroids } = generateMoxnessEdgeClasses(roots);
		expect(edges).toHaveLength(6720);
		expect(centroids).toHaveLength(8);
	});
});

describe("MOXNESS_RING_PALETTE (paper-faithful palette)", () => {
	it("has exactly 8 entries matching Moxness QM/QC Fig. 1 caption", () => {
		expect(MOXNESS_RING_PALETTE).toHaveLength(8);
		expect(MOXNESS_RING_PALETTE.map((p) => p.name)).toEqual([
			"Yellow",
			"Gray",
			"Orange",
			"Cyan",
			"Magenta",
			"Red",
			"Green",
			"Blue",
		]);
	});

	it("each entry has a valid 7-character hex color", () => {
		const hexRe = /^#[0-9A-Fa-f]{6}$/;
		for (const entry of MOXNESS_RING_PALETTE) {
			expect(entry.color).toMatch(hexRe);
		}
	});
});
