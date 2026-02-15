# Publishing Blogo to the AT Protocol

This guide walks through connecting Blogo to the AT Protocol network using the Standard.site lexicon. Once configured, your blog posts are stored as records on your Personal Data Server (PDS), giving you decentralized content ownership and interoperability with AT Protocol clients.

Everything is opt-in. If you never set the environment variables, the blog works exactly as before.

## Prerequisites

You need a Bluesky account (or an account on any AT Protocol PDS). The default PDS is `bsky.social`, but any compliant PDS works.

## 1. Obtain your credentials

Three values are required: your DID, your handle, and an app password.

### Find your DID

Your DID is a permanent identifier that does not change even if you change your handle. To find it, resolve your handle:

```
curl https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=yourhandle.bsky.social
```

The response looks like:

```json
{"did":"did:plc:abcdef123456"}
```

Copy the `did` value.

### Create an app password

Go to Bluesky Settings > Privacy and Security > App Passwords and create a new one. Give it a name like "blogo" so you can identify it later. Copy the generated password immediately - it is only shown once.

App passwords have the same access as your main password but can be revoked individually. Never use your main account password.

## 2. Configure environment variables

Set these in your shell, `.env` file, or deployment platform secrets:

```bash
ATPROTO_DID=did:plc:abcdef123456          # Required - your DID
ATPROTO_HANDLE=yourhandle.bsky.social      # Required - your handle
ATPROTO_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx   # Required - the app password
ATPROTO_SERVICE=https://bsky.social        # Optional - defaults to bsky.social
```

Do not commit these values to the repository. For local development, export them in your shell session or use a `.env` file (already in `.gitignore`).

Two additional variables affect the published metadata:

```bash
PUBLIC_URL=https://yourdomain.com          # Base URL written into publication records
BLOG_TITLE=Blogo                           # Publication name on the network
BLOG_DESCRIPTION=A minimal blog            # Publication description
```

## 3. Publish your posts

```bash
deno task at:publish
```

This command does two things in sequence:

1. Creates or updates a `site.standard.publication` record with rkey `self` on your PDS. This record represents your blog as a whole and contains the name, URL, and description.

2. Reads every `.md` file in `content/posts/`, extracts frontmatter and raw markdown, and creates a `site.standard.document` record for each post. The record key is derived from the slug (e.g., the post `my-first-post.md` gets rkey `my-first-post`).

The output tells you how many posts were published:

```
Published: 43, Skipped: 0, Errors: 0
```

Publishing is idempotent. Running it again overwrites existing records with the current file contents. There is no concept of a draft - every file in the posts directory gets published.

### What gets stored on the PDS

Each document record contains:

- `title` - from frontmatter
- `publishedAt` - from the `date` field, as ISO 8601
- `path` - the URL path, e.g. `/posts/my-first-post`
- `description` - from the `excerpt` field, if present
- `content` - the raw markdown body, stored as `site.standard.content.markdown`
- `textContent` - a plain-text version of the markdown (stripped of syntax), truncated to 10,000 characters
- `tags` - from frontmatter, if present
- `updatedAt` - from the `modified` field, if present

The content is stored as raw markdown, not HTML. AT Protocol clients that understand the Standard.site lexicon can render it however they choose.

## 4. Verify the integration

Verification proves to Standard.site clients that your website and your PDS account are linked. Two mechanisms are involved, and both are set up automatically when the environment variables are present.

### Domain verification endpoint

When the server starts with AT Protocol configured, it registers a route at:

```
GET /.well-known/site.standard.publication
```

This returns the publication AT-URI as plain text:

```
at://did:plc:abcdef123456/site.standard.publication/self
```

### Document link tags

Each post page includes a `<link>` tag in the HTML `<head>`:

```html
<link rel="site.standard.document" href="at://did:plc:abcdef123456/site.standard.document/my-first-post">
```

This links the rendered HTML page to its corresponding record on the PDS.

### Running the verification check

Start the server with AT Protocol credentials:

```bash
deno task dev
```

In another terminal:

```bash
PUBLIC_URL=http://localhost:8000 deno task at:verify
```

Expected output:

```
[PASS] AT Protocol configured for did:plc:abcdef123456
[PASS] Well-known endpoint returns correct AT-URI
[PASS] Post page contains AT Protocol link tag
```

If any check fails, the output tells you what was expected and what was found.

For production verification, set `PUBLIC_URL` to your live domain:

```bash
PUBLIC_URL=https://yourdomain.com deno task at:verify
```

## 5. Pull content from PDS

To download all documents from your PDS and write them as markdown files:

```bash
deno task at:pull
```

This lists all `site.standard.document` records on your PDS, converts each one back to a markdown file with YAML frontmatter, and writes it to `content/posts/`.

By default, files that already exist locally are skipped. To overwrite local files with the PDS version:

```bash
deno task at:pull -- --force
```

Pulling is useful for:

- Syncing content across machines
- Recovering content if local files are lost
- Importing content that was published from a different client

The conversion handles three content types: `site.standard.content.markdown` (uses the value directly), `site.standard.content.html` (stores the HTML as the body), and unknown types (falls back to `textContent`).

## 6. Static builds with AT Protocol

The static site builder (`deno task build`) respects AT Protocol configuration. If the environment variables are set at build time:

- The `_site/.well-known/site.standard.publication/index.html` file is generated with the publication AT-URI
- Each post's `index.html` includes the `<link rel="site.standard.document">` tag

If the variables are not set, these are omitted and the static site works without AT Protocol references.

## Architecture notes

### No SDK dependency

The AT Protocol client uses raw `fetch()` against XRPC endpoints. The XRPC protocol is straightforward HTTP: authenticate with `com.atproto.server.createSession` to get a JWT, then use `Authorization: Bearer {jwt}` for subsequent calls. The four operations used are `putRecord`, `getRecord`, `listRecords`, and `deleteRecord`, all mapping to standard XRPC endpoints.

### Standard.site lexicon

The implementation targets these lexicon schemas:

| Collection | Description |
|---|---|
| `site.standard.publication` | Blog identity record (one per blog, rkey `self`) |
| `site.standard.document` | Individual post record (one per post, rkey from slug) |

Content is stored using the `site.standard.content.markdown` type, which preserves the raw markdown for maximum portability.

### File layout

```
src/
  atproto/
    types.ts          # Standard.site lexicon TypeScript types
    mapping.ts        # Post <-> StandardDocument bidirectional conversion
  config/
    atproto.ts        # Environment variable parsing (returns null when unconfigured)
  ports/
    atproto.ts        # AtProtoClient interface + fetch-based implementation
    writer.ts         # FileWriter interface (used by pull and static build)
  domain/
    atproto.ts        # AtProtoService: publish/pull orchestration
  app/
    at-publish.ts     # CLI: deno task at:publish
    at-pull.ts        # CLI: deno task at:pull
    at-verify.ts      # CLI: deno task at:verify
```

### Error handling

All operations return `AppResult<T>` (the project's Result type). Network errors, parse errors, and file I/O errors are captured as data, never thrown. The CLI entry points pattern-match on the result and print human-readable messages before exiting with the appropriate code.

## Command reference

| Command | What it does | Requires AT config |
|---|---|---|
| `deno task at:publish` | Publishes all posts to PDS | Yes |
| `deno task at:pull` | Downloads documents from PDS to markdown files | Yes |
| `deno task at:pull -- --force` | Same as above, overwrites existing local files | Yes |
| `deno task at:verify` | Checks verification endpoint and link tags | Yes |
| `deno task dev` | Starts dev server (AT features activate when env vars set) | No |
| `deno task build` | Generates static site (includes AT metadata when configured) | No |

## Troubleshooting

**"AT Protocol not configured"** - One or more of `ATPROTO_DID`, `ATPROTO_HANDLE`, or `ATPROTO_APP_PASSWORD` is missing. All three are required.

**"Authentication failed (401)"** - The handle or app password is wrong. Verify that the handle matches the account the app password belongs to. If you recently changed your handle, use the new one.

**"Authentication failed (400)"** - The service URL might be wrong. If your account is on a PDS other than `bsky.social`, set `ATPROTO_SERVICE` to the correct URL.

**Well-known endpoint returns 404** - The AT Protocol environment variables are not set in the server process. Make sure they are exported before running `deno task dev`.

**Post page missing link tag** - Same cause as above. The link tag is only rendered when `ATPROTO_DID` is available at server startup.

**Pull writes empty files** - The document on the PDS may have no `content` field. The converter falls back to `textContent` if available, which is a plain-text approximation.
