---
title: htmx 4 history restore needs the full page, not a fragment
date: 2026-10-19
category: best-practices
module: http
problem_type: best_practice
component: frontend
severity: high
applies_when:
  - "A server decides between a fragment and a full page from the HX-Request header"
  - "An app moves from htmx 1 or 2 to htmx 4"
  - "Client code binds listeners to elements inside body or listens to htmx history events"
retire_when: "htmx changes how history restore builds its request; check dist/htmx.js #restoreHistory in a newer htmx.org release"
tags: [htmx, htmx-4, history, back-button, fragment, hx-request-type]
---

# htmx 4 history restore needs the full page, not a fragment

## Context

This blog moved from htmx 1.9.10 to htmx 4.0.0. Under htmx 1, the server
sent a fragment for every request with `HX-Request: true`. The browser
restored back and forward entries from a local snapshot, so no request
reached the server.

htmx 4 has no snapshot. It fetches the page again on back and forward. A
reading of the htmx.org 4.0.0 source showed the request details. The source
is the file dist/htmx.js in the htmx.org npm package (external; this repo
vendors only the minified build at `public/js/htmx.min.js`), function
`#restoreHistory`:

- The restore calls `ajax('GET', path, { target: body, swap: 'outerSync', request: { headers: { 'HX-History-Restore-Request': 'true' } } })`.
- `ajax` runs `Object.assign(ctx, options)`, which replaces the request
  context. So the core headers, including `HX-Request`, are not sent.
- A request whose target is `document.body` gets `HX-Request-Type: full`.
  A request into a smaller target gets `partial`.
- The `outerSync` swap calls `replaceChildren` on `body`. Every element
  inside `body` is new after a restore.

This was found by source reading before the release. It was not observed in
a browser. The browser check was still open when this doc was written.

## Guidance

1. Send a fragment only for a partial htmx request. The rule is in
   `src/http/view.ts:67-69`:

   ```ts
   export const isHtmxRequest = (req: Request): boolean =>
     req.headers.get("HX-Request") === "true" &&
     req.headers.get("HX-Request-Type") !== "full";
   ```

2. Name both headers in `Vary` (`src/http/view.ts:100`), so a cache keeps
   the fragment and the full page apart.
3. Code that renders fragments without a browser must send the same header.
   The static builder sets `HX-Request-Type: partial` for its fragment
   renders (`src/domain/static-builder.ts:66`).
4. After a restore, bind the element listeners again. `public/js/site.js`
   stores the path on `htmx:before:history:restore` (line 111). On the next
   `htmx:after:swap` it restores the scroll position and calls
   `initTheme()`, `initPalette()`, and `Search.init()` again (lines
   129-141). Listeners on `document` or `window` survive the swap and need
   no second bind.
5. Do not save the scroll position in `htmx:before:request` during a
   restore (`site.js:119`). At that point `location` already shows the
   destination, so the save would store the old page's position under the
   new path.

## Why This Matters

A server that keys on `HX-Request` alone still works for a restore, because
`HX-Request` is absent. But the next refactor that adds `HX-Request` back,
or a proxy that copies headers, would send a fragment into `body`. The
whole page would then show only the content area. The listener problem is
silent: the theme toggle and search stop working after the back button,
and no error appears.

## When to Apply

- Every htmx 4 app whose server returns fragments and full pages from the
  same URL.
- Every client script that binds to elements inside `body`.

## Examples

Route tests pin the rule in `tests/http/routes_test.tsx`:

- `HX-Request: true` without `HX-Request-Type` gives a fragment.
- `HX-Request-Type: partial` gives a fragment.
- `HX-Request-Type: full` gives the full page.
- `HX-History-Restore-Request: true` with `HX-Request-Type: full` (the
  real restore request) gives the full page.

## Related

- `docs/plans/2026-10-18-phase-0-spec.md` (unit U1, htmx upgrade)
