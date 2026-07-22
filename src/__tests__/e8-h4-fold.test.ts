import { describe, expect, it } from "vitest";
import { generateE8RootSystem } from "../e8-geometry";
import {
	CNOT,
	classifyRingSubLattice,
	foldE8To4D,
	H4_FOLD_MATRIX,
	H4_UNI_MATRIX,
	SWAP,
} from "../e8-h4-fold";

/** Compute determinant of a square matrix via Gaussian elimination with partial pivoting. */
function det(M: readonly (readonly number[])[]): number {
	const n = M.length;
	const a = M.map((row) => [...row]);
	let sign = 1;
	for (let i = 0; i < n; i++) {
		let pivot = i;
		for (let k = i + 1; k < n; k++) {
			if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
		}
		if (Math.abs(a[pivot][i]) < 1e-15) return 0;
		if (pivot !== i) {
			[a[i], a[pivot]] = [a[pivot], a[i]];
			sign = -sign;
		}
		for (let k = i + 1; k < n; k++) {
			const f = a[k][i] / a[i][i];
			for (let j = i; j < n; j++) a[k][j] -= f * a[i][j];
		}
	}
	let d = sign;
	for (let i = 0; i < n; i++) d *= a[i][i];
	return d;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const phi = PHI - 1;

describe("H4_FOLD_MATRIX (Moxness 2014 Eq. 1)", () => {
	it("is 8×8", () => {
		expect(H4_FOLD_MATRIX.length).toBe(8);
		for (const row of H4_FOLD_MATRIX) expect(row.length).toBe(8);
	});

	it("is symmetric: H4_FOLD = H4_FOLDᵀ", () => {
		for (let i = 0; i < 8; i++) {
			for (let j = 0; j < 8; j++) {
				expect(H4_FOLD_MATRIX[i][j]).toBeCloseTo(H4_FOLD_MATRIX[j][i], 12);
			}
		}
	});

	it("has determinant ≈ (2√φ)⁸ ≈ 37.349 (Moxness 2019)", () => {
		const expected = (2 * Math.sqrt(phi)) ** 8;
		expect(det(H4_FOLD_MATRIX)).toBeCloseTo(expected, 6);
		expect(det(H4_FOLD_MATRIX)).toBeCloseTo(37.3499, 3);
	});

	it("has only entries in {0, ±1, ±φ, Φ, φ²}", () => {
		const allowed = [0, 1, phi, -phi, PHI, phi * phi];
		for (const row of H4_FOLD_MATRIX) {
			for (const x of row) {
				const ok = allowed.some((v) => Math.abs(x - v) < 1e-12);
				expect(ok, `unexpected entry ${x}`).toBe(true);
			}
		}
	});
});

describe("H4_UNI_MATRIX (Moxness 2019 Eq. 2)", () => {
	it("has determinant ≈ 1 (unimodular)", () => {
		expect(det(H4_UNI_MATRIX)).toBeCloseTo(1, 10);
	});

	it("equals H4_FOLD divided by 2√φ", () => {
		const k = 2 * Math.sqrt(phi);
		for (let i = 0; i < 8; i++) {
			for (let j = 0; j < 8; j++) {
				expect(H4_UNI_MATRIX[i][j]).toBeCloseTo(H4_FOLD_MATRIX[i][j] / k, 12);
			}
		}
	});

	it("has the expected entry classes Φ/2√φ ≈ 1.029, φ²/2√φ ≈ 0.243, φ/2√φ ≈ 0.393, 1/2√φ ≈ 0.636", () => {
		// Our matrix follows the 2014 H4-fold paper Eq. 1; the 2020 paper
		// publishes a basis-permuted unimodular form with [0][0] ↔ [0][4]
		// swapped. Both have Det = 1.
		expect(H4_UNI_MATRIX[0][0]).toBeCloseTo(PHI / (2 * Math.sqrt(phi)), 6); // ≈ 1.029
		expect(H4_UNI_MATRIX[0][4]).toBeCloseTo(
			(phi * phi) / (2 * Math.sqrt(phi)),
			6,
		); // ≈ 0.243
		expect(H4_UNI_MATRIX[1][1]).toBeCloseTo(phi / (2 * Math.sqrt(phi)), 6); // ≈ 0.393
		expect(H4_UNI_MATRIX[1][2]).toBeCloseTo(1 / (2 * Math.sqrt(phi)), 6); // ≈ 0.636
	});
});

describe("foldE8To4D", () => {
	it("returns length-4 left + right halves for an 8D vector", () => {
		const v = [1, 0, 1, 0, 1, 0, 1, 0];
		const { left, right } = foldE8To4D(v);
		expect(left).toHaveLength(4);
		expect(right).toHaveLength(4);
	});

	it("rejects non-8D inputs", () => {
		expect(() => foldE8To4D([1, 2, 3])).toThrow();
	});

	it("folds all 240 E8 roots without producing NaN/Inf", () => {
		for (const root of generateE8RootSystem()) {
			const { left, right } = foldE8To4D(root);
			for (const x of [...left, ...right]) {
				expect(Number.isFinite(x)).toBe(true);
			}
		}
	});
});

describe("classifyRingSubLattice (Moxness QM/QC Fig. 1)", () => {
	it("places rings 0,2,3,4 in H4 and rings 1,5,6,7 in H4φ", () => {
		expect(classifyRingSubLattice(0)).toBe("H4");
		expect(classifyRingSubLattice(1)).toBe("phiH4");
		expect(classifyRingSubLattice(2)).toBe("H4");
		expect(classifyRingSubLattice(3)).toBe("H4");
		expect(classifyRingSubLattice(4)).toBe("H4");
		expect(classifyRingSubLattice(5)).toBe("phiH4");
		expect(classifyRingSubLattice(6)).toBe("phiH4");
		expect(classifyRingSubLattice(7)).toBe("phiH4");
	});

	it("rejects out-of-range ring indices", () => {
		expect(() => classifyRingSubLattice(-1)).toThrow();
		expect(() => classifyRingSubLattice(8)).toThrow();
	});

	it("partitions exactly: 4 H4 rings + 4 H4φ rings = 8", () => {
		let h4 = 0;
		let phih4 = 0;
		for (let r = 0; r < 8; r++) {
			if (classifyRingSubLattice(r) === "H4") h4++;
			else phih4++;
		}
		expect(h4).toBe(4);
		expect(phih4).toBe(4);
	});
});

describe("CNOT + SWAP gates (Moxness 2019 Sec. III)", () => {
	it("CNOT is 4×4", () => {
		expect(CNOT.length).toBe(4);
		for (const row of CNOT) expect(row.length).toBe(4);
	});

	it("CNOT is its own inverse: CNOT · CNOT = I", () => {
		const sq: number[][] = [];
		for (let i = 0; i < 4; i++) {
			sq.push([]);
			for (let j = 0; j < 4; j++) {
				let s = 0;
				for (let k = 0; k < 4; k++) s += CNOT[i][k] * CNOT[k][j];
				sq[i].push(s);
			}
		}
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				expect(sq[i][j]).toBe(i === j ? 1 : 0);
			}
		}
	});

	it("SWAP is its own inverse: SWAP · SWAP = I", () => {
		const sq: number[][] = [];
		for (let i = 0; i < 4; i++) {
			sq.push([]);
			for (let j = 0; j < 4; j++) {
				let s = 0;
				for (let k = 0; k < 4; k++) s += SWAP[i][k] * SWAP[k][j];
				sq[i].push(s);
			}
		}
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				expect(sq[i][j]).toBe(i === j ? 1 : 0);
			}
		}
	});
});
