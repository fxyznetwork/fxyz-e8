# @fxyz/e8

[![CI](https://github.com/fxyznetwork/fxyz-e8/actions/workflows/ci.yml/badge.svg)](https://github.com/fxyznetwork/fxyz-e8/actions/workflows/ci.yml)

A pure-math TypeScript toolkit for the E8 root system and its H4 (600-cell)
sub-structure: root-system generation, multiple 2D/3D projections, hull
extraction, and folding between E8 and H4. Zero runtime dependencies, zero
rendering dependencies — the output is plain numbers (`number[]`,
`Float32Array`, `Float64Array`) that any renderer (three.js, WebGPU, a plot
library, a CLI) can consume.

## What it does

- **E8 root-system generation** — the 240 root vectors of the E8 exceptional
  Lie group in 8 dimensions (`e8-geometry.ts`), plus their edge adjacency
  (6,720 edges, each vertex has 56 neighbors).
- **Multiple projections** — a Petrie/Coxeter-eigenplane 2D projection (the
  "mandala" view), a legacy Platonic-solid 3D basis, and a first-principles
  3D projection via the H4 unimodular fold + axis drop (`e8-projections.ts`,
  `e8-3d-fold-projection.ts`).
- **E8 → H4 folding** — the explicit 8×8 folding matrix from Moxness (2014)
  that rotates E8 vertices into copies of the H4 600-cell, plus its
  unimodular (determinant = 1) form (`e8-h4-fold.ts`).
- **H4 600-cell stereographic projection** — projects the 600-cell from S³
  to ℝ³ with a 1-parameter SO(4) rotation, producing curved (great-circle)
  edges rather than straight chords (`h4-stereographic.ts`).
- **Hull / shell extraction** — classifies the 240 projected roots into
  concentric Platonic/Archimedean hulls, both via k-means (5 or 8 shells)
  and via the exact 8-shell radial multiset `{4, 24, 24, 30, 30, 40, 40, 48}`
  recovered by the fold projection (`e8-geometry.ts`, `e8-platonic-hulls.ts`,
  `e8-edge-norms.ts`).
- **Fold-morph interpolation** — precomputed endpoint buffers for animating
  between the 2D Petrie mandala and the 3D H4 fold, plus a CPU lerp
  implementation for parity testing or non-shader consumers
  (`e8-fold-morph.ts`).

## Install

```sh
npm install @fxyz/e8
# or
pnpm add @fxyz/e8
```

## Usage

```ts
import {
	generateE8RootSystem,
	generateE8Vertices8Hull,
	projectTo3DViaFold,
	getE8PlatonicHulls,
} from "@fxyz/e8";

// The 240 root vectors of E8, in 8 dimensions.
const roots = generateE8RootSystem(); // number[240][8]

// Project to 3D via the H4 unimodular fold + ST-axis drop.
const positions3D = projectTo3DViaFold(roots); // [number, number, number][240]

// Fully-typed vertices with paper-accurate 8-hull classification.
const vertices = generateE8Vertices8Hull();
// vertices[i] = { index, coords8D, position3D, norm3D, hull }

// Or go straight to the 8 concentric hulls as GPU-ready buffers.
const hulls = getE8PlatonicHulls();
// hulls[i] = { index, radius, vertexCount, vertices: Float32Array, edges: Float32Array, ... }
```

```ts
import {
	stereographicS3ToR3,
	so4RotationHopf,
	buildStereographic600CellEdges,
} from "@fxyz/e8";

// Stereographically project a point on S³ (the H4 600-cell's ambient
// sphere) to R³, after a 1-parameter SO(4) rotation.
const rotation = so4RotationHopf(Math.PI / 4);
const p = stereographicS3ToR3([0.5, 0.5, 0.5, 0.5]);
```

See each module's doc comment for the full API and the math it implements.

## Sources

This library is a transcription and composition of published mathematics,
not novel research. Primary sources:

- H. S. M. Coxeter, *Regular Polytopes*, 3rd ed. (Dover, 1973) — the 600-cell
  construction (§22.4) and Petrie polygon (§13.4).
- J. G. Conway & N. J. A. Sloane, *Sphere Packings, Lattices and Groups*
  (Springer, 3rd ed.) — the E8 lattice theta function (Ch. 4, Table 4.9).
- J. G. Moxness, *The 3D Visualization of E8 Using an H4 Folding Matrix*
  (2014) — the H4 folding matrix (`H4_FOLD_MATRIX`).
- J. G. Moxness, *Unimodular rotation of E8 to H4 600-cells* (2019,
  vixra:1910.0345) — the unimodular form (`H4_UNI_MATRIX`, determinant 1)
  and the CNOT/SWAP quantum-computing derivation.
- J. G. Moxness, *3D Polytope Hulls of E8* (2020) — the 8-shell radial
  multiset and the platonic/Archimedean hull structure.
- J. G. Moxness, "E8 and H4 in QM and QC" (undated preprint) — the H4 /
  H4φ sub-lattice ring partition and the paper-faithful edge-norm color
  classes.
- M. Koca, M. Al-Ajmi, N. K. Koca, "Polyhedra obtained from Coxeter groups
  and quaternions", arXiv:1204.4567 (2012).
- H. Hopf, "Über die Abbildungen der dreidimensionalen Sphäre auf die
  Kugelfläche" (1931) — the Hopf fibration underlying the 1-parameter SO(4)
  rotations used in the stereographic projection.

Where a projection basis or matrix is transcribed from a paper (rather than
derived first-principles in this code), the module doc comment says so and
notes any known numerical caveats (e.g. `MOXNESS_BASIS` is a legacy,
non-orthonormal transcription kept for parity testing — prefer
`projectTo3DViaFold`, which is derived from first principles and recovers
the published 8-shell multiset exactly).

## Development

```sh
pnpm install
pnpm build      # tsup — emits dist/ (ESM + CJS + .d.ts)
pnpm test       # vitest
pnpm typecheck  # tsc --noEmit
```

## Status

Pre-1.0. The public API may change between minor versions until 1.0.

## Provenance

Extracted from the [ƒxyz](https://fxyz.network) network monorepo, where this
module underlies the E8/H4 lattice geometry used in its 3D visualizations.
The network itself — its economics, member layer, and product code — stays
private; this package is the general-purpose math underneath it.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md)
and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). For security reports, see
[SECURITY.md](./SECURITY.md).

## License

[Apache License 2.0](./LICENSE) — see also [NOTICE](./NOTICE).
