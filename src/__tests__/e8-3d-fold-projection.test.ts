/**
 * Tests for the H4_UNI fold + ST-axis drop projection pipeline.
 *
 * Acceptance gate (per `docs/audits/2026-04-29-toe-math-reapply-brief.md`
 * §3.1): the projected 240 roots must exhibit the canonical 8-shell
 * multiset {4, 24, 24, 30, 30, 40, 40, 48} (Moxness 2020 Fig. 5; standard
 * E8 distance-class enumeration). This is a property of the lattice, not
 * a Moxness original.
 */

import { describe, expect, it } from "vitest";
import {
	CANONICAL_3D_SHELL_MULTISET,
	foldE8ToH4L,
	projectTo3DViaFold,
} from "../e8-3d-fold-projection";
import { generateE8RootSystem } from "../e8-geometry";

// ---------------------------------------------------------------------------
// Folding step
// ---------------------------------------------------------------------------

describe("foldE8ToH4L", () => {
	it("returns a length-4 vector for an 8D input", () => {
		const v = [1, 0, 1, 0, 1, 0, 1, 0];
		const out = foldE8ToH4L(v);
		expect(out.length).toBe(4);
		for (const x of out) expect(Number.isFinite(x)).toBe(true);
	});

	it("rejects non-8D inputs", () => {
		expect(() => foldE8ToH4L([1, 2, 3])).toThrow();
	});

	it("folds all 240 E8 roots without producing NaN/Inf", () => {
		for (const root of generateE8RootSystem()) {
			const out = foldE8ToH4L(root);
			for (const x of out) expect(Number.isFinite(x)).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Projection pipeline + canonical 8-shell multiset acceptance gate
// ---------------------------------------------------------------------------

describe("projectTo3DViaFold (acceptance gate)", () => {
	const roots = generateE8RootSystem();
	const projected = projectTo3DViaFold(roots);

	it("returns 240 finite 3D points", () => {
		expect(projected.length).toBe(240);
		for (const p of projected) {
			expect(p.length).toBe(3);
			expect(Number.isFinite(p[0])).toBe(true);
			expect(Number.isFinite(p[1])).toBe(true);
			expect(Number.isFinite(p[2])).toBe(true);
		}
	});

	it("spans a non-degenerate 3D volume", () => {
		const xs = projected.map((p) => p[0]);
		const ys = projected.map((p) => p[1]);
		const zs = projected.map((p) => p[2]);
		const rangeX = Math.max(...xs) - Math.min(...xs);
		const rangeY = Math.max(...ys) - Math.min(...ys);
		const rangeZ = Math.max(...zs) - Math.min(...zs);
		expect(rangeX).toBeGreaterThan(0.1);
		expect(rangeY).toBeGreaterThan(0.1);
		expect(rangeZ).toBeGreaterThan(0.1);
	});

	it("is deterministic (same input → same output)", () => {
		const second = projectTo3DViaFold(roots);
		for (let i = 0; i < projected.length; i++) {
			expect(second[i][0]).toBeCloseTo(projected[i][0], 12);
			expect(second[i][1]).toBeCloseTo(projected[i][1], 12);
			expect(second[i][2]).toBeCloseTo(projected[i][2], 12);
		}
	});

	it("has exactly 8 distinct radii (the lattice's distance classes)", () => {
		const radii = projected.map((p) =>
			Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]),
		);
		// Bin by 5-decimal precision to count distinct radii
		const distinct = new Set(radii.map((r) => r.toFixed(5)));
		expect(distinct.size).toBe(8);
	});

	it("recovers the canonical 8-shell multiset {4, 24, 24, 30, 30, 40, 40, 48}", () => {
		const radii = projected.map((p) =>
			Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]),
		);
		// Bin by exact (5dp) radius — these are first-principles distance classes
		const bins = new Map<string, number>();
		for (const r of radii) {
			const k = r.toFixed(5);
			bins.set(k, (bins.get(k) ?? 0) + 1);
		}
		const counts = [...bins.values()].sort((a, b) => a - b);
		expect(counts.reduce((a, b) => a + b, 0)).toBe(240);
		expect(counts).toEqual([...CANONICAL_3D_SHELL_MULTISET]);
	});

	it("CANONICAL_3D_SHELL_MULTISET sums to 240 (E8 root count)", () => {
		const total = CANONICAL_3D_SHELL_MULTISET.reduce((a, b) => a + b, 0);
		expect(total).toBe(240);
	});
});
