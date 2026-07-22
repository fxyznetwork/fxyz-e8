/**
 * Deterministic SVG gallery generator.
 *
 * Renders the package's own exported math directly to plain SVG files under
 * `gallery/`. No hand-drawn art, no Math.random, no external renderer — every
 * pixel traces back to a call into this package's public API. Re-run with
 * `pnpm gallery` any time the math changes; the pictures can never drift from
 * the library because they ARE the library's output.
 *
 * Uses only real, publicly-exported functions:
 *   generateE8RootSystem, projectAllPetrie2D, generateMoxnessEdgeClasses,
 *   MOXNESS_RING_PALETTE, getE8PlatonicHulls, buildStereographic600CellEdges,
 *   so4RotationHopf, foldE8ToH4L.
 *
 * `foldE8ToH4L` (from e8-3d-fold-projection.ts, re-exported at the package
 * root) is used in addition to the primary list because building a genuine
 * H4 600-cell frame (120 vertices on S³, 720 edges) requires a 4D vertex
 * generator that isn't otherwise in the public surface. The derivation is
 * verified at runtime below (see `deriveH4_600Cell`), not asserted blind:
 * folding all 240 E8 roots via `foldE8ToH4L` produces exactly two groups of
 * 120 points at two distinct norms in ratio φ — this is the documented E8→H4
 * fact already stated in e8-h4-fold.ts ("the 240 points have migrated to the
 * two superimposed H4 600-cells, one copy smaller (scaled by golden ratio)
 * than the other", citing the `4_21_polytope` structural identity). The
 * smaller-norm group of 120, normalized to unit length, sits exactly on S³;
 * connecting each vertex to its nearest neighbors (the same minimum-distance
 * edge-extraction technique already used by `getE8PlatonicHulls`) yields a
 * 12-regular graph with exactly 720 edges — the 600-cell's true combinatorics.
 *
 * The flagship image is the genuine E8 mandala: the 240 roots projected via
 * `projectCoxeterPlane2D` (e8-coxeter-plane.ts) onto the exp(±2πi/30)
 * eigenplane of the E8 Coxeter element. That projector is DERIVED from first
 * principles (build the Coxeter element w = s₁…s₈, isolate its 2π/30 eigenplane)
 * and its 30-fold symmetry is test-locked in `e8-coxeter-plane.test.ts` — the
 * 240 points land on eight concentric shells of exactly 30 and map back onto
 * themselves under rotation by 2π/30. Vertices and edges are colored by their
 * concentric shell (0 = innermost … 7 = outermost). (The older
 * `projectPetrie2D` basis is a different, fixed orthonormal projection that
 * does NOT achieve this symmetry; it is not used here — see its caveat in
 * e8-constants.ts and the README.)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	buildStereographic600CellEdges,
	classifyCoxeterShells,
	computeE8Edges,
	foldE8ToH4L,
	generateE8RootSystem,
	getE8PlatonicHulls,
	projectAllCoxeterPlane2D,
	so4RotationHopf,
} from "../src/index";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const galleryDir = join(repoRoot, "gallery");
mkdirSync(galleryDir, { recursive: true });

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
	return n.toFixed(decimals);
}

function dist(a: readonly number[], b: readonly number[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
	return Math.sqrt(s);
}

/** Deterministic HSL -> hex, used only for the platonic-hull small multiples
 * (a plain visual-distinction ramp, not a math claim). */
function hslToHex(h: number, s: number, l: number): string {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0;
	let g = 0;
	let b = 0;
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	const toHex = (v: number) =>
		Math.round((v + m) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function writeSvg(filename: string, svg: string): void {
	const path = join(galleryDir, filename);
	writeFileSync(path, svg, "utf8");
	console.log(`wrote ${path} (${(svg.length / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------------------------
// 1. E8 Coxeter-plane mandala (the verified 30-fold picture)
// ---------------------------------------------------------------------------

/** 8-step shell color ramp (0 = innermost … 7 = outermost), evenly spaced
 *  around the hue wheel so the eight concentric 30-gons read distinctly.
 *  Deterministic (hslToHex expects 0 ≤ h < 360). */
function shellColor(shell: number): string {
	return hslToHex((shell * 360) / 8, 0.7, 0.6);
}

function generateCoxeterMandala(): string {
	const roots = generateE8RootSystem(); // 240 x 8
	const proj2D = projectAllCoxeterPlane2D(roots); // [240][2]
	const shells = classifyCoxeterShells(proj2D); // 0..7 per vertex (8 shells of 30)
	const edges = computeE8Edges(roots); // 6720 [i, j] nearest-root pairs

	const W = 900;
	const H = 900;
	const cx = W / 2;
	const cy = H / 2;
	const maxR = Math.max(...proj2D.map(([x, y]) => Math.hypot(x, y)));
	const pad = 36;
	const scale = (Math.min(W, H) / 2 - pad) / maxR;

	const toPx = ([x, y]: readonly [number, number]): [number, number] => [
		cx + x * scale,
		cy - y * scale, // flip y for conventional "up" orientation
	];

	// Group the 6720 edges into 8 color buckets by their outer endpoint's shell
	// -> 8 <path> elements instead of 6720 <line> elements (much lighter DOM).
	const buckets: string[][] = Array.from({ length: 8 }, () => []);
	for (const [i, j] of edges) {
		const [ax, ay] = toPx(proj2D[i]);
		const [bx, by] = toPx(proj2D[j]);
		const bucket = Math.max(shells[i], shells[j]);
		buckets[bucket].push(
			`M${fmt(ax, 1)},${fmt(ay, 1)} L${fmt(bx, 1)},${fmt(by, 1)}`,
		);
	}
	const edgePaths = buckets
		.map((segs, idx) => {
			if (segs.length === 0) return "";
			return `<path d="${segs.join(" ")}" stroke="${shellColor(idx)}" stroke-width="0.45" stroke-opacity="0.34" fill="none" />`;
		})
		.join("\n  ");

	// Vertex color = its concentric shell (radius class).
	const vertexDots = proj2D
		.map((p, i) => {
			const [px, py] = toPx(p);
			return `<circle cx="${fmt(px)}" cy="${fmt(py)}" r="2.6" fill="${shellColor(shells[i])}" fill-opacity="1" />`;
		})
		.join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The E8 mandala: 240 root vectors and 6720 edges projected onto the Coxeter plane, forming eight concentric 30-gons with exact 30-fold rotational symmetry, colored by concentric shell">
  <title>E8 Coxeter-plane mandala — 240 roots, 8 shells of 30, 30-fold symmetry</title>
  <desc>The 240 E8 root vectors and their 6720 nearest-root edges projected onto the Coxeter plane via projectCoxeterPlane2D — the exp(±2πi/30) eigenplane of the E8 Coxeter element. The roots land on eight concentric shells of exactly 30 (8 x 30 = 240) and the point set is invariant under rotation by 2π/30: genuine 30-fold rotational symmetry, verified in src/__tests__/e8-coxeter-plane.test.ts. Vertices and edges are colored by concentric shell (0 innermost to 7 outermost). Generated deterministically by scripts/generate-gallery.ts from generateE8RootSystem, projectAllCoxeterPlane2D, classifyCoxeterShells, and computeE8Edges.</desc>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0b0b12" />
  ${edgePaths}
  ${vertexDots}
</svg>
`;
}

// ---------------------------------------------------------------------------
// 2. Platonic / Archimedean hull shells (small multiples)
// ---------------------------------------------------------------------------

function generatePlatonicHulls(): string {
	const hulls = getE8PlatonicHulls(); // 8 hulls, ascending radius

	const cols = 4;
	const rows = 2;
	const cell = 220;
	const pad = 18;
	const headerH = 50;
	const W = cols * cell + (cols + 1) * pad;
	const H = headerH + rows * cell + (rows + 1) * pad;

	const panels = hulls
		.map((hull, idx) => {
			const col = idx % cols;
			const row = Math.floor(idx / cols);
			const ox = pad + col * (cell + pad);
			const oy = headerH + pad + row * (cell + pad);
			const cx = ox + cell / 2;
			const cy = oy + cell / 2;
			const color = hslToHex((idx * 360) / 8, 0.75, 0.64);

			// Orthographic drop of the z-axis: (x, y, z) -> (x, y).
			const pts2D: [number, number][] = [];
			for (let i = 0; i < hull.vertexCount; i++) {
				pts2D.push([hull.vertices[i * 3], hull.vertices[i * 3 + 1]]);
			}
			const maxR = Math.max(1e-6, ...pts2D.map(([x, y]) => Math.hypot(x, y)));
			const innerPad = 24;
			const scale = (cell / 2 - innerPad) / maxR;
			const toPx = ([x, y]: readonly [number, number]): [number, number] => [
				cx + x * scale,
				cy - y * scale,
			];

			let edgesSvg = "";
			if (hull.edgeCount > 0) {
				const segs: string[] = [];
				for (let e = 0; e < hull.edgeCount; e++) {
					const o = e * 6;
					const [ax, ay] = toPx([hull.edges[o], hull.edges[o + 1]]);
					const [bx, by] = toPx([hull.edges[o + 3], hull.edges[o + 4]]);
					segs.push(`M${fmt(ax)},${fmt(ay)} L${fmt(bx)},${fmt(by)}`);
				}
				edgesSvg = `<path d="${segs.join(" ")}" stroke="${color}" stroke-width="1.1" stroke-opacity="0.8" fill="none" />`;
			}

			const dotsSvg = pts2D
				.map(([x, y]) => {
					const [px, py] = toPx([x, y]);
					return `<circle cx="${fmt(px)}" cy="${fmt(py)}" r="2.8" fill="${color}" fill-opacity="1" />`;
				})
				.join("");

			const label = `<text x="${cx}" y="${oy + cell + 14}" font-family="ui-monospace,monospace" font-size="11" text-anchor="middle" fill="#a8a8b8">shell ${idx}: r=${hull.radius.toFixed(2)}, n=${hull.vertexCount}</text>`;

			return `<g>${edgesSvg}${dotsSvg}${label}</g>`;
		})
		.join("\n  ");

	const title = `<text x="${W / 2}" y="30" font-family="ui-monospace,monospace" font-size="15" text-anchor="middle" fill="#c8c8d6">E8 → H4 fold: 8 concentric Platonic/Archimedean hulls</text>`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Eight concentric Platonic and Archimedean hull shells recovered from the E8 to H4 fold projection, shown as small multiples ordered by radius">
  <title>E8 → H4 fold: 8 concentric Platonic/Archimedean hulls</title>
  <desc>The 240 E8 roots, folded to 3D via the H4 unimodular fold and ST-axis drop, split into 8 concentric shells of sizes {4, 24, 24, 30, 30, 40, 40, 48}. Each panel is one shell's own vertex/edge structure (z-axis dropped for display), independently scaled to fill its cell. Generated deterministically by scripts/generate-gallery.ts from getE8PlatonicHulls.</desc>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0b0b12" />
  ${title}
  ${panels}
</svg>
`;
}

// ---------------------------------------------------------------------------
// 3. H4 600-cell — stereographic projection, Hopf rotation strip
// ---------------------------------------------------------------------------

/**
 * Derive the H4 600-cell's 120 unit vertices on S³ and its 720-edge skeleton
 * from the package's own E8 → H4 fold, verifying the structure at runtime
 * rather than assuming it (see module doc comment above for the citation).
 */
function deriveH4_600Cell(): {
	verts4D: [number, number, number, number][];
	edges: [number, number][];
} {
	const roots = generateE8RootSystem();
	const folded = roots.map(foldE8ToH4L); // 240 x [4]
	const norms = folded.map((v) => Math.hypot(v[0], v[1], v[2], v[3]));

	const groups: { norm: number; indices: number[] }[] = [];
	for (let i = 0; i < folded.length; i++) {
		const n = norms[i];
		let g = groups.find((cand) => Math.abs(cand.norm - n) < 1e-6);
		if (!g) {
			g = { norm: n, indices: [] };
			groups.push(g);
		}
		g.indices.push(i);
	}
	if (groups.length !== 2 || groups.some((g) => g.indices.length !== 120)) {
		throw new Error(
			`generate-gallery: expected the E8->H4 fold to split 240 roots into ` +
				`exactly two 120-vertex 600-cell copies; got groups of sizes ` +
				`[${groups.map((g) => g.indices.length).join(", ")}]. Refusing to ` +
				`render an unverified structure.`,
		);
	}
	groups.sort((a, b) => a.norm - b.norm);
	const { norm: r, indices } = groups[0]; // the smaller-radius copy

	const verts4D: [number, number, number, number][] = indices.map((i) => {
		const v = folded[i];
		return [v[0] / r, v[1] / r, v[2] / r, v[3] / r];
	});

	// Minimum-pairwise-distance edge skeleton — the same technique already
	// used and tested by getE8PlatonicHulls(), applied here to the 4D S³
	// point set.
	let minDist = Number.POSITIVE_INFINITY;
	for (let i = 0; i < verts4D.length; i++) {
		for (let j = i + 1; j < verts4D.length; j++) {
			const d = dist(verts4D[i], verts4D[j]);
			if (d > 1e-9 && d < minDist) minDist = d;
		}
	}
	const tol = minDist * 1e-3;
	const edges: [number, number][] = [];
	for (let i = 0; i < verts4D.length; i++) {
		for (let j = i + 1; j < verts4D.length; j++) {
			if (Math.abs(dist(verts4D[i], verts4D[j]) - minDist) < tol) {
				edges.push([i, j]);
			}
		}
	}
	if (edges.length !== 720) {
		throw new Error(
			`generate-gallery: expected 720 edges (12-regular, 120 vertices) on ` +
				`the derived 600-cell, got ${edges.length}. Refusing to render an ` +
				`unverified structure.`,
		);
	}

	return { verts4D, edges };
}

function generateH4Rotation(): string {
	const { verts4D, edges } = deriveH4_600Cell();

	const frameCount = 6;
	const thetas = Array.from(
		{ length: frameCount },
		(_, k) => (k * (2 * Math.PI)) / frameCount,
	);
	// The 600-cell's edge subtends ~36° (π/5) on S³ (chord 1/φ => 2·asin(1/2φ)
	// ≈ 36.0°) — 4 segments/edge (9°/sub-arc) already reads as visibly curved
	// while keeping the SVG a reasonable size.
	const segmentsPerEdge = 4;
	const eps = 0.05; // proactively drop segments near the projection pole

	const frames = thetas.map((theta) =>
		buildStereographic600CellEdges({
			verts4D,
			edges,
			rotation: so4RotationHopf(theta),
			segmentsPerEdge,
			scale: 1,
			eps,
		}),
	);

	// One consistent scale across every frame so the rotation reads as
	// motion, not per-frame re-normalization.
	let maxAbs = 1e-6;
	for (const buf of frames) {
		const n = buf.validSegmentCount * 6;
		for (let i = 0; i < n; i += 3) {
			maxAbs = Math.max(
				maxAbs,
				Math.abs(buf.positions[i]),
				Math.abs(buf.positions[i + 1]),
			);
		}
	}

	const cols = 3;
	const rows = 2;
	const cell = 260;
	const pad = 18;
	const headerH = 50;
	const W = cols * cell + (cols + 1) * pad;
	const H = headerH + rows * cell + (rows + 1) * pad;

	const panels = frames
		.map((buf, idx) => {
			const col = idx % cols;
			const row = Math.floor(idx / cols);
			const ox = pad + col * (cell + pad);
			const oy = headerH + pad + row * (cell + pad);
			const cx = ox + cell / 2;
			const cy = oy + cell / 2;
			const innerPad = 18;
			const scale = (cell / 2 - innerPad) / maxAbs;

			const segs: string[] = [];
			for (let s = 0; s < buf.validSegmentCount; s++) {
				const o = s * 6;
				const ax = cx + buf.positions[o] * scale;
				const ay = cy - buf.positions[o + 1] * scale;
				const bx = cx + buf.positions[o + 3] * scale;
				const by = cy - buf.positions[o + 4] * scale;
				segs.push(`M${fmt(ax, 1)},${fmt(ay, 1)} L${fmt(bx, 1)},${fmt(by, 1)}`);
			}
			const path = `<path d="${segs.join(" ")}" stroke="#7be8ff" stroke-width="0.7" stroke-opacity="0.62" fill="none" stroke-linecap="round" />`;

			const thetaLabel = `${(thetas[idx] / Math.PI).toFixed(2)}π`;
			const label = `<text x="${cx}" y="${oy + cell + 14}" font-family="ui-monospace,monospace" font-size="11" text-anchor="middle" fill="#a8a8b8">θ = ${thetaLabel}</text>`;

			return `<g>${path}${label}</g>`;
		})
		.join("\n  ");

	const title = `<text x="${W / 2}" y="30" font-family="ui-monospace,monospace" font-size="15" text-anchor="middle" fill="#c8c8d6">H4 600-cell — stereographic S³ → R³, Hopf rotation</text>`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="H4 600-cell stereographically projected from S3 to R3, six frames at increasing Hopf rotation angle, showing curved great-circle edges">
  <title>H4 600-cell — stereographic projection with a 1-parameter SO(4) Hopf rotation</title>
  <desc>The H4 600-cell (120 vertices, 720 edges, recovered from the E8 root system via the H4 unimodular fold) stereographically projected from S³ to R³ at six increasing Hopf-rotation angles. Edges are curved great-circle arcs on S³, not straight chords. Generated deterministically by scripts/generate-gallery.ts from buildStereographic600CellEdges and so4RotationHopf.</desc>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0b0b12" />
  ${title}
  ${panels}
</svg>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

writeSvg("e8-coxeter-mandala.svg", generateCoxeterMandala());
writeSvg("e8-platonic-hulls.svg", generatePlatonicHulls());
writeSvg("h4-600cell-rotation.svg", generateH4Rotation());

console.log("gallery generation complete.");
