---
title: The Compiler Should Be the Boss of the AI Agent
date: 2026-06-29
tags: [Zig, Compilers, AI]
excerpt: ZigTS uses Pi as a compiler-guided coding agent, where the model drafts code but the compiler decides what survives.
---

> ZigTS is the strict TypeScript layer on top of [zigttp](https://github.com/srdjan/zigttp), the experimental JavaScript runtime we've been building from scratch in Zig. If this is your first stop, the [intro post](/blog/zigttp-server-pure-zig-javascript-runtime) covers the runtime. This one is about Pi, the coding agent that lives inside the compiler.

I like AI coding agents, but I don't fully trust them. This is not dramatic statement, it is just engineering. Models are great at producing plausible code. Compilers are great at being annoying in exactly the useful way.

So for ZigTS, the interesting idea is not "we have an AI agent." Everybody has an AI agent now. The cool part is this: Pi sits inside the compiler workflow, and the compiler stays the authority.

Pi can write code. But ZigTS checks it, rejects it, repairs it, and only accepts it when the compiler can prove the important properties. That changes the whole shape of the loop.

## The Agent Does Not Start From Blank Page

A normal coding agent gets a prompt like:

```text
Add a route that returns the current user.
```

Then it guesses. Maybe it knows the framework. Maybe it remembers the route API. Maybe it invents one. You get a draft, then compiler complains, then the model tries again. This works, but it can burn tokens like an old Mercedes burns fuel.

In ZigTS, we do something more boring and much better.

Before Pi writes code, the compiler classifies the request:

```text
user asks for route      -> route workflow
user asks for JWT auth   -> auth workflow
user asks for SQL        -> SQL workflow
user asks to fix proof   -> proof repair workflow
user asks for env vars   -> env workflow
```

Then the compiler injects deterministic guidance into the agent context. Not vibes, not "please be careful," but actual ZigTS-specific workflow notes.

For example, if the user asks for JWT auth, Pi is reminded to use the current `zigttp:auth` and `zigttp:env` shape, to read secrets through environment APIs, to check `Result.ok`, and to avoid fallback secrets. If the user asks for SQL, Pi gets the registered-query path and the named-parameter rules.

This means the first draft starts much closer to real ZigTS code.

To me is interesting that this is not trying to make the model smarter in general. It makes the task smaller and more constrained.

## The Compiler Is the Reviewer

Pi has a ZigTS-specific persona, skills, prompt templates, and in-process tools. That part is useful. But it is still the soft part of the system.

The hard part is the compiler loop:

```text
user request
  -> classify task
  -> inject workflow guidance
  -> Pi drafts code
  -> parser checks syntax
  -> analyzer checks ZigTS rules
  -> strict semantics checks supported behavior
  -> proof loop checks properties
  -> veto bad patches
  -> repair tools propose fixes
  -> accept only proven code
```

That last part matters. The model does not get final say.

If Pi generates code that looks nice but violates ZigTS semantics, the compiler rejects it. If it leaks a secret, mishandles a `Result`, misses an optional, or creates a route that cannot satisfy the declared spec, the patch does not pass just because it sounded confident.

The compiler can say no.

This is exactly the relationship I want between AI and systems code. Let model be creative. Let compiler be strict.

## A Tiny Example

Imagine the user asks:

```text
Add a /profile route that requires JWT auth.
```

A generic model might produce something like this:

```ts
const secret = env("JWT_SECRET") || "dev-secret";
const user = verifyJwt(req.headers.get("authorization"), secret);

router.get("/profile", () => Response.json({ user }));
```

This looks fine at a glance. It is also the kind of code that makes release engineers develop eye twitch. A fallback secret, no result check, probably the wrong auth shape, maybe the wrong router API.

In the ZigTS loop, Pi gets guided toward the actual pattern:

```ts
import { env } from "zigttp:env";
import { verifyJwt } from "zigttp:auth";
import { route } from "zigttp:router";

export default route([
  {
    method: "GET",
    path: "/profile",
    handler(req: Request): Response {
      const secret = env("JWT_SECRET");
      const token = req.headers.get("authorization");

      const result = verifyJwt(token, secret);
      if (!result.ok) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      return Response.json({ user: result.value });
    },
  },
]);
```

This is still just a draft. The real work starts next: ZigTS parses it, analyzes it, checks strict supported semantics, and runs it through the proof/veto path. If some API detail is wrong, or if the code violates the active contract, the loop catches it before user accepts the patch.

The agent can also ask compiler-native repair tools for a candidate fix without writing files. So Pi can explore a repair, inspect the proposed content, and only apply it when the compiler path agrees.

## Why This Reduces Model Back-And-Forth

The expensive part of agentic coding is not one model call. It is the sad loop:

```text
draft -> fail -> explain error -> draft again -> fail differently -> retry
```

Sometimes this is because the model is bad. More often it is because the model has too much freedom and too little local truth.

ZigTS has a lot of local truth:

- which JavaScript/TypeScript subset is supported
- which virtual modules exist
- how `Result` and optional handling should work
- which specs must be proven
- what strict mode rejects
- what a handler is allowed to do

So we put that truth close to the agent.

Pi still uses language-model reasoning, but the compiler narrows the lane before generation and enforces the lane after generation. This means fewer nonsense drafts, fewer retries, and less "almost right" code.

I worked with this pattern enough to appreciate how simple it feels when it works. The model writes. The compiler checks. The repair loop tightens. The user sees a patch that already survived the checks that matter.

## Real Talk: This Is Not Magic

This does not make AI perfect. It also does not remove the need for good APIs, good docs, and good tests.

The classifier can miss intent. The workflow hints need to stay current with the actual ZigTS APIs. The repair tools need sharp boundaries, because a tool that writes too eagerly is just another way to make a mess faster.

And there is a design tradeoff: the more opinionated the compiler guidance becomes, the more you must maintain it like product code. Prompt text becomes part of the compiler surface. Skills become testable artifacts. Agent behavior needs regression tests.

I'll take that trade any day. Because the alternative is worse: a general chatbot pretending to know your compiler.

## The Shape I Like

The pattern I want more of is this:

```text
AI proposes.
Compiler disposes.
Tools repair.
Proof decides.
```

This is one of rare examples where "agentic" does not mean "let the model run around with shell access and hope." It means giving the model a narrow expert role inside a deterministic system.

Pi is not meant to be a general programming buddy. Pi is meant to be a very good ZigTS coder. The compiler teaches it the local rules before it starts, then checks every important claim after it writes.

That is the big idea: not AI replacing compiler discipline, but AI being shaped by it.

Like good espresso, it is simple on surface and very picky underneath.
