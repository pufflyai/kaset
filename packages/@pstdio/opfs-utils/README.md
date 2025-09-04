# @pstdio/opfs-utils

[![npm version](https://img.shields.io/npm/v/@pstdio/opfs-utils.svg?color=blue)](https://www.npmjs.com/package/@pstdio/opfs-utils)
[![license](https://img.shields.io/npm/l/@pstdio/opfs-utils)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fopfs-utils)](https://bundlephobia.com/package/%40pstdio%2Fopfs-utils)

Small utilities for working with the browser's Origin Private File System (OPFS).

For additional information, please refer to the [documentation](https://pufflyai.github.io/kaset/packages/opfs-utils).

## Quick Start

### Installation

```bash
npm i @pstdio/opfs-utils
```

### Usage

```ts
import { ls } from "@pstdio/opfs-utils";

const root = await navigator.storage.getDirectory();
await ls(root);
```

## Notes & limitations

- Requires a secure context and browser support for the File System Access API.

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
