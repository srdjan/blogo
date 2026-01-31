---
title: "Two Philosophies for Agent Memory"
date: 2026-01-31
tags: [AI, Agentic Workflows, AI-Memory]
excerpt: Agentic memory is a technique used in AI agents that integrates long-term and short-term memory to enable persistence, allowing LLMs to store, retrieve, update, and summarize information across conversations, similar to human memory.
---

Most teams building AI agents eventually hit the same wall: the agent forgets what it learned yesterday, contradicts itself between sessions, or hallucinates context that never existed.

I've been experimenting with two architecturally distinct approaches: [memdb-lite](https://github.com/srdjan/memdb-lite) (file-based mandatory recall) and [memdb](https://github.com/srdjan/memdb) (temporal graph with canonical resolution).

The obvious move is to add "memory." But this is where the approaches diverge sharply.

## The Minimalist Contract

One approach treats memory as **transparent files plus mandatory recall**. Memory lives in plain Markdown—`MEMORY.md` for curated knowledge, daily logs for temporal context. The database is derived: SQLite indexes for search, optional embeddings, nothing canonical.

The reliability mechanism isn't sophisticated canonicalization. It's a behavioral contract: before answering questions about prior context, the agent *must* search memory. The enforcement happens at the protocol layer—MCP tools with explicit recall obligations.

This creates an interesting property: you can debug memory by opening files. You can fix hallucinations by editing text. The agent's "knowledge" is literally `git diff`-able.

The trade-off is discipline. Every agent runtime needs to honor the contract. There's no automatic conflict resolution, no derived truth layer. What you write is what you get.

## The World-Model Substrate

The alternative approach treats memory as a **temporal knowledge graph with two clocks**: an event clock for what happened (immutable evidence), and a state clock for what's true now (derived canonical facts).

Here, reliability comes from architecture. Agents emit *observed* facts with provenance—every assertion links to the event that justified it. A resolver produces *canonical* facts by weighing conflicts, synthesizing timelines, closing intervals. Downstream agents read only the canonical lane.

This enables something the file-based approach cannot: multiple agents writing simultaneously while maintaining consistency. The coordination happens through facts (`work_claimed_by`, `work_affects`), resolution policies auto-close conflicts, and the state-clock endpoints serve truth without requiring every agent to implement deduplication logic.

The cost is opacity. Canonical facts are *derived*—you can trace provenance through events, but you can't just edit the answer. The system decides truth through policy.

## Where Each Fits

The file-based approach works when you control the agent runtime and value transparency. If you're building a single coding assistant or a tightly-scoped agent where memory should be human-readable and editable, mandatory recall plus Markdown is enough. It's the lightest viable memory that doesn't forget.

The graph approach becomes necessary when you're coordinating multiple agents, need audit trails for compliance contexts, or when "what's true now" requires resolving contradictory observations across sessions. It's infrastructure for sustained agent collaboration, not a feature you add to one assistant.

Both share a insight: memory isn't about perfect state management. It's about making forgetting expensive enough that agents retrieve before they answer.

The choice depends on whether you're building a tool or a platform—and whether you can afford the complexity of always knowing why something is true.