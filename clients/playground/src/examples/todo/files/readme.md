# Kaset Playground — Todos

Welcome to a really weird todo app!

It lives in plain Markdown files, but it also has a secret: an agent that can edit your todos right alongside you.

## ✨ What's going on here?

> Kaset [kaˈset] is an open source toolkit that helps you add coding agents directly to your webapp. It uses the browser's file system api to read and edit files.

In this version of the playground, users can only interact with their todo files, but I am working on application state adapters, user created plugins, mods and more.

If you have ideas or questions, reach out here: https://github.com/pufflyai/kaset/discussions

## 📂 How it's set up

- `todos/` → every list is a Markdown file (`work.md`, `personal.md`, etc.).
  - `- [ ]` means not done.
  - `- [x]` means donezo.
- `state.json` → lightweight state the UI and agents share (e.g., which list is open). Agents can tweak it when they create or switch lists.
- `agents.md` → rules for the agent. Agents obey. Mostly.
