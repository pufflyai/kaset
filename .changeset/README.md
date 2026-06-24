# Changesets

Use Changesets to record package-facing changes and publish packages from `main`.

```bash
bun run changeset
```

The release workflow creates a version PR when changesets exist. After that PR is merged, the same workflow publishes changed packages with:

```bash
bun run publish-packages
```

Publishing requires an `NPM_TOKEN` repository secret with access to the public packages.
