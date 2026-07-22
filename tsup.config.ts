import { defineConfig } from "tsup";

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: ["cjs", "esm"],
	target: "es2022",
	dts: true,
	sourcemap: false,
	clean: true,
});
