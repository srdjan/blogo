# Repository Guidelines

## Project Structure

- `src/` – Deno TypeScript app. Key areas: `app/` (entrypoint), `http/` (router,
  server, middleware), `domain/` (content/config/analytics services),
  `components/` (mono‑jsx views), `ports/` (adapters like cache/filesystem),
  `utils/` and `lib/` (shared helpers/types).
- `content/posts/` – Markdown posts with YAML frontmatter. Slugs are kebab‑case
  filenames (e.g., `my-post-title.md`).
- `public/` – Static assets served as‑is (CSS, JS, images).
- `tests/` – Deno tests mirroring `src/` modules; `_test.ts` suffix.
- `scripts/` – Maintenance tools (frontmatter checks, tag listing).
- `docs/` – Design notes and longer architecture docs.

## Build, Test, and Development Commands

Use Deno tasks from `deno.json`:

- `deno task dev` – Run server in watch mode for local development.
- `deno task start` – Start production server.
- `deno task check` – Type‑check `src/app/main.ts`.
- `deno task test` / `deno task test:watch` – Run full test suite.
- `deno task smoke` – Fast subset used by hooks.
- `deno task fmt` / `deno task lint` – Format and lint code.
- `deno task frontmatter:check` – Validate post frontmatter.
- `deno task setup` – Create default folders and download HTMX.

## Coding Style & Naming Conventions

- Formatting is enforced by `deno fmt` (2‑space indent, 80‑col line width). Run
  `deno task fmt` before PRs.
- Keep semicolons and explicit `.ts`/`.tsx` import extensions as in existing
  code.
- File naming: kebab‑case for non‑component files (`render-vnode.ts`),
  PascalCase for JSX components in `components/` matching exported symbols
  (`PostView.tsx`).
- Prefer small, pure functions and dependency injection (see `create*Service`
  patterns).

## Testing Guidelines

- Tests use Deno’s built‑in runner and `@std/assert`.
- Name tests `*_test.ts` and colocate under `tests/` following module structure.
- Ensure `deno task test` passes; hooks also require `deno task smoke`.

## Commit & Pull Request Guidelines

- Commit messages in history are short, verb‑led summaries (e.g., “fixed
  counting”, “added more blog posts”). Follow that style: one line, imperative,
  scoped if helpful.
- PRs should include: a brief summary, linked issue (if any), and screenshots
  for UI/content changes. Note any new env vars or tasks.

## Configuration Tips

Local settings live in `.env`; common vars include `DENO_ENV`, `PORT`,
`PUBLIC_URL`, `BLOG_TITLE`, `POSTS_DIR`, and `POSTS_PER_PAGE`. Don’t commit
secrets.
