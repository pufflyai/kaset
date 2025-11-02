# @pstdio/opfs-sync

[![npm version](https://img.shields.io/npm/v/@pstdio/opfs-sync.svg?color=blue)](https://www.npmjs.com/package/@pstdio/opfs-sync)
[![license](https://img.shields.io/npm/l/@pstdio/opfs-sync)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fopfs-sync)](https://bundlephobia.com/package/%40pstdio%2Fopfs-sync)

Sync the browser's OPFS with a remote storage provider. Includes a Supabase adapter and a minimal interface for custom backends.

For additional information, please refer to the [documentation](https://kaset.dev/packages/opfs-sync).

## Quick Start

### Installation

```bash
npm i @pstdio/opfs-sync
# optional: remote provider SDK, e.g.
npm i @supabase/supabase-js
```

### Usage

```ts
import { OpfsSync } from "@pstdio/opfs-sync";

const localDir = await navigator.storage.getDirectory();
const sync = new OpfsSync({ localDir, remote: /* your provider */ });
await sync.initialSync();
```

## Notes & limitations

- Runs entirely in the browser and uses last-writer-wins conflict resolution.

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
