---
title: The default YAML schema rolls impossible dates over before validation
date: 2026-10-19
category: logic-errors
module: content
problem_type: logic_error
component: service_layer
symptoms:
  - "Frontmatter date 2025-02-30 passes validation and shows as 2 March"
  - "A calendar check in the validator never fires for real post files"
  - "An unquoted modified date is rejected with 'Modified date must be a string'"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
retire_when: "@std/yaml stops resolving timestamps in its default schema; check by parsing 'date: 2025-02-30' with the default schema"
tags: [yaml, std-yaml, frontmatter, dates, validation, core-schema]
---

# The default YAML schema rolls impossible dates over before validation

## Problem

Post frontmatter is YAML. With the default schema, `@std/yaml` turns an
unquoted `date: 2025-02-30` into a JavaScript `Date` for 2025-03-02. The
validator receives a valid date, so an impossible date in a post is never
reported.

## Symptoms

- `date: 2025-02-30` passes validation and the post shows 2 March.
- A calendar check added to the validator works in unit tests that pass
  strings, but never fires for real post files, because all posts use
  unquoted dates.
- An unquoted `modified: 2025-01-16` becomes a `Date`, and the validator
  rejects it with `Modified date must be a string`.

## What Didn't Work

- A round-trip calendar check in the validator alone. It caught
  `"2025-02-30"` as a string, but the parser had already changed the value
  for every real post. A review found this before the fix was released.

## Solution

Parse frontmatter with the YAML core schema. The core schema does not
resolve timestamps, so dates stay strings, and the validator sees the text
as written. Booleans, numbers, and lists still parse as before.

```ts
// src/domain/content.ts:500
const meta = parseYaml(frontmatter, { schema: "core" }) as Record<string, unknown>;
```

`scripts/check_frontmatter.ts:39` uses the same option. AT Protocol
publishing reuses `parseFrontmatter` from `src/domain/content.ts`, so it
gets the same behavior.

Then reject a date whose calendar round trip differs
(`src/domain/validation.ts:87`):

```ts
const isCalendarDate = (value: string): boolean => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
};
```

The explicit `T00:00:00Z` keeps the check independent of the host time
zone.

## Why This Works

The rollover happens inside the parser, before any project code runs. A
check after parsing cannot see the original text. Changing the parser
schema removes the conversion, so the validator gets the original string.

## Prevention

- Parse every frontmatter block through one function (`parseFrontmatter`)
  with the core schema. Do not add a second YAML parse call for posts.
- Test the whole path from raw text, not only the validator. The content
  service tests in `tests/domain/content_service_test.ts` include an
  unquoted `date: 2025-02-30` that must give a validation error, and an
  unquoted `modified: 2025-01-16` that must pass.
- Run `deno task frontmatter:check` after a parser change. All 48 posts
  passed after this fix.

## Related Issues

- `docs/plans/2026-10-18-phase-3-spec.md` (unit B11 and its correction)
