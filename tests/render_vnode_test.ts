import { assertEquals } from "@std/assert";
import { renderVNodeForTest as render } from "../src/http/render-vnode.ts";

const el = (type: string, children: unknown) => ({ type, props: { children } });

Deno.test("script text renders raw", () => {
  assertEquals(
    render(el("script", 'var t=localStorage.getItem("theme")&&1;')),
    '<script>var t=localStorage.getItem("theme")&&1;</script>',
  );
});

Deno.test("script text cannot close the element early", () => {
  assertEquals(
    render(el("script", '{"name":"</script><b>x</b>"}')),
    '<script>{"name":"<\\/script><b>x<\\/b>"}</script>',
  );
});

Deno.test("style text renders raw", () => {
  assertEquals(
    render(el("style", 'a>b{content:"&"}')),
    '<style>a>b{content:"&"}</style>',
  );
});

Deno.test("other element text is still escaped", () => {
  assertEquals(
    render(el("p", '<b>"&"</b>')),
    "<p>&lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;</p>",
  );
});
