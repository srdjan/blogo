import { expandGlob } from "jsr:@std/fs/expand-glob";

const tags = new Map<string, number>();

for await (const f of expandGlob("content/posts/*.md")) {
  const text = await Deno.readTextFile(f.path);
  const m = text.match(/^---[\s\S]*?^---/m);
  if (!m) continue;
  const fm = m[0];
  const line = fm.split("\n").find((l) => l.trim().startsWith("tags:"));
  if (!line) continue;
  const inner = line.replace(/^.*\[/, "").replace(/\].*$/, "");
  inner
    .split(",")
    .map((s) => s.trim().replace(/^"|^'|`|"$|'$|`$/g, ""))
    .filter(Boolean)
    .forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
}

const list = [...tags.entries()].sort((a, b) => b[1] - a[1]);
for (const [t, c] of list) console.log(`${c}\t${t}`);

