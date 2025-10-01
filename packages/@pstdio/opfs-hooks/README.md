# @pstdio/opfs-hooks

[![npm version](https://img.shields.io/npm/v/@pstdio/opfs-hooks.svg?color=blue)](https://www.npmjs.com/package/@pstdio/opfs-hooks)
[![license](https://img.shields.io/npm/l/@pstdio/opfs-hooks)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fopfs-hooks)](https://bundlephobia.com/package/%40pstdio%2Fopfs-hooks)

React hooks for working with the browser's Origin Private File System (OPFS).

For additional information, please refer to the [documentation](https://pufflyai.github.io/kaset/packages/opfs-hooks).

## Quick Start

### Installation

```bash
npm i @pstdio/opfs-hooks
```

### Usage

```tsx
import { useFolder, useFileContent } from "@pstdio/opfs-hooks";

function Example() {
  const { rootNode } = useFolder("docs");
  const { content } = useFileContent("docs/readme.txt");

  return (
    <div>
      <pre>{JSON.stringify(rootNode, null, 2)}</pre>
      <pre>{content}</pre>
    </div>
  );
}
```

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
