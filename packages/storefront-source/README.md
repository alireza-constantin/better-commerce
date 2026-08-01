# Better Commerce storefront source catalogue

This package distributes editable presentation source under ADR-0012. It is
not a runtime UI library: the installer copies selected files into a merchant
storefront repository and records their provenance in
`better-commerce.source.json`.

During platform development, run it from the monorepo root:

```bash
pnpm --filter @better-commerce/storefront-source catalogue list
pnpm --filter @better-commerce/storefront-source catalogue add product-grid --version 1.0.0 --root ../merchant-store
pnpm --filter @better-commerce/storefront-source catalogue status --root ../merchant-store
pnpm --filter @better-commerce/storefront-source catalogue diff product-grid --to 1.0.2 --root ../merchant-store
pnpm --filter @better-commerce/storefront-source catalogue add product-grid --version 1.0.2 --root ../merchant-store
pnpm --filter @better-commerce/storefront-source catalogue add next-product-grid-page --version 1.0.2 --root ../merchant-store
```

The initial release installs a portable React Product grid. It does not modify
the merchant's `package.json` or lockfile, and it never overwrites an existing
file. Install the listed runtime dependencies explicitly in the merchant
repository.

`diff` performs a three-way comparison between the originally installed
catalogue source, the current merchant file, and a selected newer catalogue
release. It reports safe updates and conflicts but never writes an update.

The initial Next.js App Router recipe is optional and explicitly depends on the
portable Product grid. It is a copied route file, not a universal React Server
Component or a framework requirement.
