import { assertStringIncludes, assert } from "@std/assert";
import { renderVNodeForTest } from "../../src/http/render-vnode.ts";
import { PostList } from "../../src/components/PostList.tsx";
import { createSlug } from "../../src/lib/types.ts";
import type { Post } from "../../src/lib/types.ts";

Deno.test("renderVNode handles single vnode child without exposing symbols", () => {
  const samplePosts: readonly Post[] = [{
    title: "Sample",
    date: "2024-01-01",
    slug: createSlug("sample"),
    content: "",
    formattedDate: "",
    viewCount: 3,
  }];

  const vnode = <PostList posts={samplePosts} />;
  const html = renderVNodeForTest(vnode);

  assertStringIncludes(html, "<article");
  assertStringIncludes(html, "Sample");
  assert(!html.includes("Symbol("));
  assert(!html.includes("[object Object]"));
});

Deno.test("renderVNode renders fragments", () => {
  const fragment = <>
    <div>A</div>
    <div>B</div>
  </>;

  const html = renderVNodeForTest(fragment);
  assertStringIncludes(html, "<div>A</div><div>B</div>");
});
