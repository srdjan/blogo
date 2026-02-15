import { createAtProtoConfig } from "../config/atproto.ts";

async function main() {
  const atConfig = createAtProtoConfig();

  // Check 1: Config exists
  if (!atConfig) {
    console.log("[FAIL] ATPROTO_DID is not set");
    Deno.exit(1);
  }
  console.log(`[PASS] AT Protocol configured for ${atConfig.did}`);

  const publicUrl = Deno.env.get("PUBLIC_URL") ||
    "https://blogo.timok.deno.net";
  const expectedUri = `at://${atConfig.did}/site.standard.publication/self`;

  // Check 2: Well-known endpoint
  try {
    const res = await fetch(
      `${publicUrl}/.well-known/site.standard.publication`,
    );
    if (!res.ok) {
      console.log(
        `[FAIL] Well-known endpoint returned ${res.status}`,
      );
    } else {
      const body = (await res.text()).trim();
      if (body === expectedUri) {
        console.log("[PASS] Well-known endpoint returns correct AT-URI");
      } else {
        console.log(
          `[FAIL] Well-known endpoint returned "${body}", expected "${expectedUri}"`,
        );
      }
    }
  } catch (e) {
    console.log(
      `[FAIL] Could not reach well-known endpoint: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  // Check 3: Document link tag on a post page
  try {
    const indexRes = await fetch(publicUrl);
    if (!indexRes.ok) {
      console.log(`[FAIL] Could not fetch homepage (${indexRes.status})`);
    } else {
      const html = await indexRes.text();
      const postMatch = html.match(/href="(\/posts\/[^"]+)"/);
      if (!postMatch || !postMatch[1]) {
        console.log("[SKIP] No post links found on homepage");
      } else {
        const postUrl = `${publicUrl}${postMatch[1]}`;
        const postRes = await fetch(postUrl);
        if (!postRes.ok) {
          console.log(`[FAIL] Could not fetch post page (${postRes.status})`);
        } else {
          const postHtml = await postRes.text();
          if (
            postHtml.includes('rel="site.standard.document"')
          ) {
            console.log("[PASS] Post page contains AT Protocol link tag");
          } else {
            console.log(
              '[FAIL] Post page missing <link rel="site.standard.document"> tag',
            );
          }
        }
      }
    }
  } catch (e) {
    console.log(
      `[FAIL] Could not verify post pages: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

if (import.meta.main) {
  main();
}
