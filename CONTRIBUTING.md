# Contributing

Thanks for your interest in improving this package.

## Ground rules

- Be respectful — see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
- Report security issues privately — see [SECURITY.md](./SECURITY.md). Never
  open a public issue for a vulnerability.
- By submitting a contribution you agree it is licensed under the repository's
  [Apache License 2.0](./LICENSE).

## Filing issues

- Search existing issues first.
- For bugs: include a minimal reproduction, the package + version, your
  runtime (Node version, browser), and expected vs. actual behavior.
- For features: describe the use case before the implementation.

## Pull requests

1. Fork and branch from `main`.
2. Keep changes focused — one concern per PR.
3. Match the existing code style.
4. Add or update tests for behavior changes.
5. Make sure `pnpm build`, `pnpm test`, and `pnpm typecheck` pass.
6. Write a clear PR description: what changed and why.

## Local development

```sh
pnpm install
pnpm build          # tsup — emits dist/ (ESM + CJS + .d.ts)
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
```

## Commit sign-off

Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/).
Sign your commits with `git commit -s`.
