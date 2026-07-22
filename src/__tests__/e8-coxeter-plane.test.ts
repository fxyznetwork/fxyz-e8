/**
 * Coxeter-plane projection — the tests that LOCK the 30-fold symmetry claim.
 *
 * Everything the module's doc comment asserts (Coxeter element of order 30,
 * exp(±2πi/30) eigenplane, exact 8×30 shell structure, empirical 30-fold
 * rotational symmetry) is checked numerically here. If any of it regresses,
 * these fail — the "E8 mandala" claim can never silently become false again.
 */

import { describe, expect, it } from "vitest";
import {
	classifyCoxeterShells,
	COXETER_PLANE_BASIS,
	deriveCoxeterPlaneBasis,
	e8CoxeterElement,
	projectAllCoxeterPlane2D,
	projectCoxeterPlane2D,
} from "../e8-coxeter-plane";
import { E8_SIMPLE_ROOTS } from "../e8-constants";
import { generateE8RootSystem } from "../e8-geometry";

// --- tiny linear-algebra helpers (test-local) ------------------------------

function dot(a: readonly number[], b: readonly number[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}
function matMul(a: number[][], b: number[][]): number[][] {
	const n = a.length;
	const inner = b.length;
	const m = b[0].length;
	const c = Array.from({ length: n }, () => new Array(m).fill(0));
	for (let i = 0; i < n; i++)
		for (let p = 0; p < inner; p++)
			for (let j = 0; j < m; j++) c[i][j] += a[i][p] * b[p][j];
	return c;
}
function matPow(a: number[][], p: number): number[][] {
	let r = a.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
	for (let k = 0; k < p; k++) r = matMul(r, a);
	return r;
}
function maxAbsDiffFromIdentity(a: number[][]): number {
	let e = 0;
	for (let i = 0; i < a.length; i++)
		for (let j = 0; j < a.length; j++)
			e = Math.max(e, Math.abs(a[i][j] - (i === j ? 1 : 0)));
	return e;
}

// --- E8 simple roots -------------------------------------------------------

describe("E8_SIMPLE_ROOTS", () => {
	const roots = generateE8RootSystem();
	const rootKeys = new Set(
		roots.map((r) => r.map((x) => x.toFixed(3)).join(",")),
	);

	it("has 8 simple roots, each of norm² = 2", () => {
		expect(E8_SIMPLE_ROOTS.length).toBe(8);
		for (const a of E8_SIMPLE_ROOTS) {
			expect(a.length).toBe(8);
			expect(dot(a, a)).toBeCloseTo(2, 12);
		}
	});

	it("every simple root is a member of the 240-root system", () => {
		for (const a of E8_SIMPLE_ROOTS) {
			const key = a.map((x) => x.toFixed(3)).join(",");
			expect(rootKeys.has(key)).toBe(true);
		}
	});

	it("Gram matrix is the E8 Cartan matrix", () => {
		const gram = E8_SIMPLE_ROOTS.map((ai) =>
			E8_SIMPLE_ROOTS.map((aj) => Math.round(dot(ai, aj))),
		);
		// The E8 Cartan matrix in this (Bourbaki even-coordinate) labeling.
		expect(gram).toEqual([
			[2, 0, -1, 0, 0, 0, 0, 0],
			[0, 2, 0, -1, 0, 0, 0, 0],
			[-1, 0, 2, -1, 0, 0, 0, 0],
			[0, -1, -1, 2, -1, 0, 0, 0],
			[0, 0, 0, -1, 2, -1, 0, 0],
			[0, 0, 0, 0, -1, 2, -1, 0],
			[0, 0, 0, 0, 0, -1, 2, -1],
			[0, 0, 0, 0, 0, 0, -1, 2],
		]);
	});
});

// --- Coxeter element -------------------------------------------------------

describe("e8CoxeterElement", () => {
	const w = e8CoxeterElement();

	it("is orthogonal (wᵀw = I)", () => {
		const wt = w[0].map((_, j) => w.map((row) => row[j]));
		expect(maxAbsDiffFromIdentity(matMul(wt, w))).toBeLessThan(1e-12);
	});

	it("has order exactly 30: w³⁰ = I", () => {
		expect(maxAbsDiffFromIdentity(matPow(w, 30))).toBeLessThan(1e-9);
	});

	it("has order EXACTLY 30, not a proper divisor (wᵏ ≠ I for k | 30, k < 30)", () => {
		for (const k of [1, 2, 3, 5, 6, 10, 15]) {
			// non-trivial distance from I proves the order is not k
			expect(maxAbsDiffFromIdentity(matPow(w, k))).toBeGreaterThan(0.1);
		}
	});
});

// --- Derived Coxeter-plane basis ------------------------------------------

describe("COXETER_PLANE_BASIS / deriveCoxeterPlaneBasis", () => {
	const { u1, u2 } = COXETER_PLANE_BASIS;

	it("u1, u2 are an orthonormal pair", () => {
		expect(dot(u1, u1)).toBeCloseTo(1, 12);
		expect(dot(u2, u2)).toBeCloseTo(1, 12);
		expect(Math.abs(dot(u1, u2))).toBeLessThan(1e-9);
	});

	it("is deterministic (two derivations are identical)", () => {
		const a = deriveCoxeterPlaneBasis();
		const b = deriveCoxeterPlaneBasis();
		expect(a.u1).toEqual(b.u1);
		expect(a.u2).toEqual(b.u2);
	});

	it("the Coxeter element acts on span{u1,u2} as a rotation by 2π/30", () => {
		const w = e8CoxeterElement();
		const wu1 = w.map((row) => dot(row, u1));
		const c = dot(wu1, u1);
		const s = dot(wu1, u2);
		// in-plane coords match (cos θ, ±sin θ); |c| = cos, |s| = sin
		expect(Math.hypot(c, s)).toBeCloseTo(1, 9); // stays in-plane (unit norm)
		expect(c).toBeCloseTo(Math.cos((2 * Math.PI) / 30), 9);
		expect(Math.abs(s)).toBeCloseTo(Math.sin((2 * Math.PI) / 30), 9);
		// out-of-plane leakage of w·u1 is at machine precision (~3.5e-16)
		const rej = wu1.map((x, i) => x - c * u1[i] - s * u2[i]);
		expect(Math.sqrt(dot(rej, rej))).toBeLessThan(1e-12);
	});
});

// --- The mandala: 8 shells of 30, exact 30-fold symmetry ------------------

describe("E8 Coxeter-plane mandala (240 roots)", () => {
	const roots = generateE8RootSystem();
	const proj = projectAllCoxeterPlane2D(roots);

	it("projects to exactly 8 concentric shells of exactly 30 points each", () => {
		const shells = classifyCoxeterShells(proj);
		const counts = new Array(8).fill(0);
		for (const s of shells) counts[s]++;
		expect(new Set(shells).size).toBe(8);
		expect(counts).toEqual([30, 30, 30, 30, 30, 30, 30, 30]);
	});

	it("has exactly 8 distinct projected radii", () => {
		const maxR = Math.max(...proj.map(([x, y]) => Math.hypot(x, y)));
		const tol = 1e-6 * maxR;
		const distinct: number[] = [];
		for (const [x, y] of proj) {
			const r = Math.hypot(x, y);
			if (!distinct.some((d) => Math.abs(d - r) < tol)) distinct.push(r);
		}
		expect(distinct.length).toBe(8);
	});

	// Empirical harness: rotate the projected set by 2π/n and measure the
	// fraction of points landing back onto another point of the set.
	function symmetryFraction(n: number): number {
		const maxR = Math.max(...proj.map(([x, y]) => Math.hypot(x, y)));
		const tol = 1e-6 * maxR + 1e-9;
		const ang = (2 * Math.PI) / n;
		const c = Math.cos(ang);
		const s = Math.sin(ang);
		let matched = 0;
		for (const [x, y] of proj) {
			const rx = c * x - s * y;
			const ry = s * x + c * y;
			if (proj.some(([px, py]) => (rx - px) ** 2 + (ry - py) ** 2 < tol * tol))
				matched++;
		}
		return matched / proj.length;
	}

	it("is exactly 30-fold rotationally symmetric (rotation by 2π/30 maps the set to itself)", () => {
		expect(symmetryFraction(30)).toBe(1);
	});

	it("is symmetric under every divisor of 30 (2,3,5,6,10,15)", () => {
		for (const n of [2, 3, 5, 6, 10, 15]) {
			expect(symmetryFraction(n)).toBe(1);
		}
	});

	it("is NOT symmetric under non-divisors (7, 8, 30-fold is exact, not accidental)", () => {
		expect(symmetryFraction(7)).toBeLessThan(0.5);
		expect(symmetryFraction(8)).toBeLessThan(0.5);
	});

	it("projectCoxeterPlane2D matches projectAllCoxeterPlane2D element-wise", () => {
		for (let i = 0; i < 5; i++) {
			expect(projectCoxeterPlane2D(roots[i])).toEqual(proj[i]);
		}
	});
});
