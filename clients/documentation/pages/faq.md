---
title: FAQ
---

# Frequently Asked Questions

## 🔒 Is this secure?

Yes, provided you treat the agent as a potentially misaligned third party and take appropriate precautions:

- **Always** run agent-generated code in a sandbox.
- **Never** allow the agent to make unrestricted requests to untrusted targets.

We’re also working on features to make secure defaults easier out of the box.

## 💥 Can the agent cause irreversible damage?

Kaset integrates with isomorphic-git to track every change made by agents.
This gives your users version control “for free” and makes it simple to review, roll back, or revert unwanted edits, so changes are never truly irreversible.

## 🔌 Can’t I just expose my functionality via MCP?

Absolutely. In fact, for some well-defined use cases, MCP may be the simplest path.

Where Kaset shines is in fuzzier or more open-ended tasks—like creating a custom theme, modding an interface, or building plugins directly inside your app.

In these cases, file-based environments give agents more flexibility than rigid RPC-style APIs.
