---
title: Your App as a Filesystem
---

:::info
This section is work in progress
:::

# Your App as a Filesystem

## What is OPFS?

The Origin Private File System (OPFS) is a browser-native file system that provides:

- **Private, persistent storage** that's invisible to users but accessible to your web app
- **High-performance file operations** with direct file handles and streaming capabilities
- **Sandbox security** with no cross-origin access concerns
- **Large storage capacity** typically much larger than localStorage or IndexedDB quotas

OPFS is perfect for applications that need to handle large files, perform complex file operations, or provide file-system-like experiences in the browser.
