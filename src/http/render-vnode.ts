import { Fragment as JsxFragment } from "mono-jsx/jsx-runtime";

const VNODE_SYMBOL = Symbol.for("jsx.vnode");

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isVNode = (v: unknown): v is [unknown, Record<string, unknown>, symbol] =>
  Array.isArray(v) && typeof v[2] === "symbol" && (
    v[2] === VNODE_SYMBOL || String(v[2]).includes("jsx.vnode")
  );

const renderAttrs = (props: Record<string, unknown>): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || value === false || value === undefined || value === null) {
      continue;
    }
    if (value === true) {
      parts.push(` ${key}`);
      continue;
    }
    if (key === "style" && typeof value === "object" && value !== null) {
      const styleStr = Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        const kebab = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        return `${kebab}:${v}`;
      }).join(";");
      parts.push(` style="${escapeHtml(styleStr)}"`);
      continue;
    }
    parts.push(` ${key}="${escapeHtml(String(value))}"`);
  }
  return parts.join("");
};

const voidEls = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export const renderVNode = (node: unknown): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return escapeHtml(String(node));

  if (isVNode(node) || (Array.isArray(node) && typeof node[2] === "symbol")) {
    const [tag, props = {}] = node;
    const children = (props as { children?: unknown }).children;

    // Raw HTML node (created by html``)
    if (typeof tag === "symbol" && (props as Record<string, unknown>).innerHTML) {
      return String((props as Record<string, unknown>).innerHTML);
    }

    // Fragment
    if (tag === JsxFragment || typeof tag === "symbol") {
      return renderVNode(children);
    }

    // Function component
    if (typeof tag === "function") {
      return renderVNode(tag(props));
    }

    // Native element
    if (typeof tag === "string") {
      const attrs = renderAttrs(props as Record<string, unknown>);
      if (voidEls.has(tag)) {
        return `<${tag}${attrs}>`;
      }
      const inner = isVNode(children)
        ? renderVNode(children)
        : Array.isArray(children)
        ? children.map(renderVNode).join("")
        : renderVNode(children);
      return `<${tag}${attrs}>${inner}</${tag}>`;
    }
  }

  if (Array.isArray(node)) {
    return node.map(renderVNode).join("");
  }

  return escapeHtml(String(node));
};

// Exported for unit tests
export const renderVNodeForTest = renderVNode;
