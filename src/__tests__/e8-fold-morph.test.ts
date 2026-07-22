import { describe, expect, it } from "vitest";
import {
	CANONICAL_3D_SHELL_MULTISET,
	projectTo3DViaFold,
} from "../e8-3d-fold-projection";
import {
	computeE8FoldMorphPositions,
	getE8FoldMorphEndpoints,
} from "../e8-fold-morph";
import { generateE8RootSystem } from "../e8-geometry";

describe("e8-fold-morph", () => {
	it("provides 240 endpoint pairs (Petrie 2D + Moxness 3D fold)", () => {
		const { posPetrie3D, posFold3D } = getE8FoldMorphEndpoints();
		expect(posPetrie3D.length).toBe(240 * 3);
		expect(posFold3D.length).toBe(240 * 3);
	});

	it("Petrie endpoint has all z=0 (flat 2D mandala embedded as 3D)", () => {
		const { posPetrie3D } = getE8FoldMorphEndpoints();
		for (let i = 0; i < 240; i++) {
			expect(posPetrie3D[i * 3 + 2]).toBe(0);
		}
	});

	it("t=1 lerp output matches projectTo3DViaFold byte-for-byte (canonical Moxness 3D)", () => {
		const lerped = computeE8FoldMorphPositions(1);
		const roots = generateE8RootSystem();
		const canonical = projectTo3DViaFold(roots);
		for (let i = 0; i < 240; i++) {
			const o = i * 3;
			expect(lerped[o + 0]).toBeCloseTo(canonical[i][0], 10);
			expect(lerped[o + 1]).toBeCloseTo(canonical[i][1], 10);
			expect(lerped[o + 2]).toBeCloseTo(canonical[i][2], 10);
		}
	});

	it("t=0 lerp output keeps z=0 across all 240 vertices (Petrie disk)", () => {
		const lerped = computeE8FoldMorphPositions(0);
		for (let i = 0; i < 240; i++) {
			expect(lerped[i * 3 + 2]).toBe(0);
		}
	});

	it("t=0.5 lerp output is the midpoint (sanity — geometric continuity)", () => {
		const { posPetrie3D, posFold3D } = getE8FoldMorphEndpoints();
		const lerped = computeE8FoldMorphPositions(0.5);
		for (let i = 0; i < 240 * 3; i++) {
			expect(lerped[i]).toBeCloseTo(0.5 * (posPetrie3D[i] + posFold3D[i]), 12);
		}
	});

	it("t=1 reproduces the canonical 8-shell radial multiset {4, 24, 24, 30, 30, 40, 40, 48}", () => {
		// At t=1 the 240 vertices sit at the Moxness 3D fold positions, so the
		// distinct-radii distribution must match the published multiset (the
		// same property `e8-3d-fold-projection.test.ts` enforces; we re-check
		// here so any future shader change that breaks the contract is caught
		// at THIS module's test boundary too).
		const lerped = computeE8FoldMorphPositions(1);
		const radii: number[] = [];
		for (let i = 0; i < 240; i++) {
			const x = lerped[i * 3];
			const y = lerped[i * 3 + 1];
			const z = lerped[i * 3 + 2];
			radii.push(Math.sqrt(x * x + y * y + z * z));
		}
		// Sort radii, group near-duplicates within float tolerance, count each
		// distinct radius. Should land on 8 buckets summing to 240.
		const sorted = [...radii].sort((a, b) => a - b);
		const buckets: { radius: number; count: number }[] = [];
		const tol = 1e-9;
		for (const r of sorted) {
			const last = buckets[buckets.length - 1];
			if (last && Math.abs(r - last.radius) < tol) {
				last.count++;
			} else {
				buckets.push({ radius: r, count: 1 });
			}
		}
		const counts = buckets.map((b) => b.count).sort((a, b) => a - b);
		expect(counts).toEqual(
			CANONICAL_3D_SHELL_MULTISET.toSorted((a, b) => a - b),
		);
	});

	it("clamps t < 0 to 0 and t > 1 to 1", () => {
		const { posPetrie3D, posFold3D } = getE8FoldMorphEndpoints();
		const negT = computeE8FoldMorphPositions(-0.5);
		const overT = computeE8FoldMorphPositions(1.5);
		for (let i = 0; i < 240 * 3; i++) {
			expect(negT[i]).toBe(posPetrie3D[i]);
			expect(overT[i]).toBe(posFold3D[i]);
		}
	});
});
