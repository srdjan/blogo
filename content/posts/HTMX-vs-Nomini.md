---
title: "HTMX vs Nomini: Clash of Titans"
date: 2025-11-22
tags: [Web, HTMX, Nomini, Architecture]
excerpt: I spent a weekend exploring whether to swap HTMX for Nomini in this blog. Here's why I'm staying put—and when Nomini might actually make sense.
---

I've been running this blog on HTMX for a while now, and honestly, it works
beautifully. But like any engineer with some extra weekend time, I started
wondering: could I make it even simpler?

Enter Nomini—a tiny 2kb library that promises "boring HTML + islands of
reactivity + server-driven pages." That philosophy sounds _exactly_ like what
I'm after. This means maybe I could drop HTMX entirely, shrink my JS bundle, and
keep things minimal. Perfect, right?

Well, not quite. Here's what I learned.

## What I'm Actually Using HTMX For

Let me disclose about my HTMX usage first, related to this comparison. I'm not
using 90% of what HTMX offers. No forms, no triggers, no server-sent events, no
WebSockets. None of that.

What I _am_ using:

**SPA-like navigation without the SPA nonsense.** When you click a link in the
nav or a tag, HTMX intercepts it, fetches the new content from the server, swaps
in just the content area, and updates the browser history. The server still
renders the HTML, I just swap the content portion client-side.

**Scroll restoration that actually works.** Hit back, and you're exactly where
you left off. This is surprisingly tricky to get right, and HTMX handles it
cleanly.

**History integration.** Forward, back, refresh—everything works like a normal
website, just faster.

That's it. To me is interesting that such a simple use case covers maybe 10% of
HTMX's capabilities, but it does it perfectly.

## What Nomini Actually Is

Nomini takes a different approach entirely. It's not trying to be HTMX. It's
focused on **reactive data binding and local interactivity**.

The cool parts:

You can sprinkle `nm-data` on an element to create a reactive scope:

```html
<div nm-data="count: 0">
  <p nm-bind="textContent: () => count"></p>
  <button nm-on="click: () => count++">Increment</button>
</div>
```

That's it—no build step, no virtual DOM, no framework overhead. Just reactive
HTML. The syntax is surprisingly clean.

For AJAX, Nomini gives you `$get` and `$post` helpers that automatically bundle
up your reactive data and swap HTML fragments based on element IDs. Very similar
to HTMX's partial updates, but you wire it yourself.

The philosophy is solid: keep HTML boring, add reactivity only where you need
it, let the server do the heavy lifting.

## Here's the Problem

Nomini doesn't have routing. Or history management. Or navigation lifecycle
events.

Look at what HTMX gives me with `hx-get`, `hx-target`, `hx-swap`, and
`hx-push-url`:

```html
<a
  href="/tags"
  hx-get="/tags"
  hx-target="#content-area"
  hx-swap="innerHTML"
  hx-push-url="true"
>
  Tags
</a>
```

That one link definition handles:

- Intercepting the click
- Fetching the new page
- Extracting and swapping the content
- Updating the URL
- Snapshotting the page for history
- Managing scroll position

With Nomini, I'd have to write all of that myself. Sure, I could use Nomini's
`$get` helper for the fetch part, but I'd still need to:

- Set up delegated click handlers for all nav links
- Manually call `history.pushState`
- Implement my own scroll restoration
- Handle `popstate` events for back/forward
- Recreate the content extraction logic
- Wire up all the lifecycle hooks I depend of

This is exactly the code HTMX is _removing_ for me. Swapping to Nomini means I'd
be reimplementing a mini-HTMX on top of Nomini.

## Real Talk: What Each Tool Is Good At

**HTMX shines at:**

- App-wide navigation with minimal code
- History and scroll management
- Declarative partial updates
- "Make my whole site feel like a SPA" use cases

**Nomini shines at:**

- Small interactive widgets with local state
- Form validation and live updates
- Inline reactivity without a build step
- "Add a bit of interactivity here and there" use cases

For Blogo's navigation layer, HTMX is doing exactly what it was designed for.
Nomini would be fighting uphill.

But here's the interesting bit: if I wanted to add a live search with filter
chips, or a comment form with inline validation, or some interactive data
visualization? Nomini would be _perfect_ for that. Much better fit than bolting
React or Alpine onto HTMX.

## The Verdict

I'm keeping HTMX for navigation. It's battle-tested, it handles edge cases I
haven't even thought about, and it does exactly what I need with almost no code
on my part.

But I'm genuinely impressed with Nomini's approach. The reactive binding syntax
is elegant, the size is tiny, and the philosophy aligns perfectly with
server-driven architecture. I can see myself reaching for it when I need local
interactivity islands.

Sometimes the best architecture decision is recognizing that different tools
solve different problems—and not forcing a square peg into a round hole just
because it's newer or smaller.

I explored this question for months (on and off between espressos), and the
answer turned out to be simple: use the right tool for the job. HTMX for
navigation, Nomini for reactivity, vanilla JS for everything else.
