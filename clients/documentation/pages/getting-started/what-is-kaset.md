---
title: What is Kaset
---

# What is Kaset?

**Kaset** is an open-source toolkit to turn your webapp into a filesystem that coding agents can interact with, client-side.

**Kaset** has a few core goals:

1. Provide tools for working with file systems directly in the browser. Think `ls`, `grep`, etc. Check out [@pstdio/opfs-utils](/packages/opfs-utils) for more details.
2. Deliver a coding agent that runs natively in the browser. Most existing solutions only work server-side. See [Meet KAS](/concepts/kas).
3. Offer tools to help you synchronize your application with OPFS — whether it’s [artifacts](/concepts/artifacts), [application state](/concepts/app-state), or even your [UI](/concepts/ui).
4. Provide tools for tracking and controlling edits, with authorization gates and version control. So that every agent action remains auditable, and reversible.

## Your app as a Filesystem

You can expose your app’s functionality to agents in many ways — APIs, tool catalogs, or protocols like MCP. These work well for clear, well-defined actions.

But when tasks get fuzzier (like creating a theme, modding a UI, or building plugins) managing dozens of specialized tools quickly breaks down.

A filesystem model gives agents a simpler, more flexible interface:

- Agents are already good at reading, searching, and editing files to build the context they need.
- Open-ended requests are easier to express as file edits than as rigid tools.
- Kaset’s approach: model your app as files (state, config, UI, artifacts), and let agents work directly with them. Use MCP or tools for the few things that files can’t capture.

Example project structure from the playground:

```
.
├── agents.md
└── todos/
    ├── todo1.md
    └── todo2.md
```

Still unclear? Check out [Your App as a Filesystem](/concepts/filesystem)

## Benefits

1. **Plug-and-play agents**
   Because your app is modeled as a filesystem (state/config/UI as files), any capable coding agent can read, search, and edit those files. You can drop in, swap, or upgrade agents without redesigning tool APIs—they already know how to operate in this environment.

2. **Cheaper compute (no VMs in the cloud)**
   Running agents locally avoids paying for dedicated servers or virtual machines. Your users’ browsers and devices handle the heavy lifting, dramatically lowering operational costs.

3. **Cheaper token use (LLMs on the user’s machine)**
   If the model runs locally (e.g., via WebGPU or WASM), no tokens need to be sent to a hosted LLM service.

4. **More customizable**
   Each user can tune, extend, or even fork the agent to match their workflow without waiting for centralized updates. This unlocks personalization that server-side solutions struggle to provide.

5. **Unlocks new capabilities for your web app**
   Client-side agents can directly interact with the app’s state, UI, and files, enabling things like real-time UI mods, local-first plugins, offline workflows, or personalized dashboards.

## Downsides

1. **App restructuring required**
   To get the most out of Kaset, you’ll likely need to reshape parts of your app into a file-based model (state, config, UI as files). This adds upfront design work.

2. **Transparent prompts**
   Because the agent runs fully in the browser, its system prompt and instructions are visible to the user. This limits use cases where you want hidden or proprietary agent logic.

3. **User-side persistence**
   State lives in the user’s storage (e.g., OPFS). This can make syncing across devices or accounts more complex compared to a centralized backend.

---

Still unclear? Check out [our playground](https://kaset.dev).
