# Public Package Release

This runbook releases the MIT-licensed Better Commerce packages to the public
npm registry:

- `@better-commerce/sdk`;
- `@better-commerce/storefront-core`;
- `@better-commerce/storefront-source`.

The API, Admin, merchant storefront repositories, configuration, secrets, and
deployment artifacts are not npm packages and remain outside this release.

## One-time setup

1. Create the free public npm organization `better-commerce`.
2. Enable 2FA on every npm account with publish authority.
3. Create a granular npm token limited to staging releases for the
   `@better-commerce` scope. Do not enable bypass 2FA.
4. Create the protected GitHub Environment `npm-package-staging` and save that
   token as `NPM_STAGE_TOKEN`. Do not put it in repository or organization-wide
   secrets available to ordinary pull-request workflows.
5. Protect the default branch and allow only reviewed `packages-v*` tags to
   reach the release workflow.

The publish workflow uses npm 11.18.0 because staged publishing requires npm
11.15.0 or newer. It can stage a version but cannot make it public; npm 2FA
approval remains mandatory.

## First release bootstrap

npm cannot stage a package that does not already exist. Publish each initial
`0.1.0` package manually, in dependency order, from a clean reviewed release
commit. This asks for your npm 2FA code and is the only direct publishing step.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm release:check

pnpm --filter @better-commerce/sdk publish --access public
pnpm --filter @better-commerce/storefront-core publish --access public
pnpm --filter @better-commerce/storefront-source publish --access public
```

Before each command, inspect the package tarball. The generated package must
not contain secrets, merchant source, credentials, local environment files, or
unintended test data.

```bash
pnpm --filter @better-commerce/sdk pack --pack-destination .artifacts
pnpm --filter @better-commerce/storefront-core pack --pack-destination .artifacts
pnpm --filter @better-commerce/storefront-source pack --pack-destination .artifacts
```

After the three packages are public, install them in a disposable storefront
repository and build it before treating `0.1.0` as ready for merchants.

## Later releases

1. Make and review the intended package changes on a normal branch.
2. Update affected package versions with SemVer; never reuse a published or
   staged version.
3. Run the full verification commands from the first-release section.
4. Merge the release commit, then create and push an annotated tag such as
   `packages-v0.1.1` on that exact commit.
5. GitHub Actions validates every workspace and stages each package in
   dependency order. It stages the pnpm-created tarballs so workspace
   dependencies are resolved to real package versions before npm receives them.
6. On npm, open the **Staged Packages** tab, inspect each artifact, and approve
   SDK, storefront core, then storefront source with 2FA.
7. Install the released versions in a disposable consumer repository and record
   the API and package versions in merchant release notes.

## Token rotation or suspected exposure

1. Immediately revoke the affected npm staging token.
2. Replace `NPM_STAGE_TOKEN` in the protected GitHub Environment.
3. Review npm staging history and GitHub workflow runs.
4. Reject unexpected staged packages with npm 2FA.
5. If a public version is compromised, do not overwrite it. Deprecate it,
   publish a corrected higher version, and upgrade consumers through reviewed
   dependency changes.

## Non-negotiable rules

- Every published package is public and MIT licensed.
- The initial release is manually published with 2FA; later releases are staged
  by CI and explicitly approved with 2FA.
- Package versions are immutable; never unpublish and reuse a version.
- Tokens never enter Git, `.env.example`, source provenance files, or chat.
- Merchant repositories own their source and configuration; public packages
  contain only reusable platform contracts and presentation examples.
