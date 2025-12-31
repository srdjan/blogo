import { Fragment as JsxFragment } from "hsx/jsx-runtime";

// Symbol for raw HTML marker
const RAW_HTML_MARKER = Symbol.for("hsx.rawHtml");

// HSX VNode structure
type HsxVNode = {
  readonly type?: string | ((...args: unknown[]) => unknown);
  readonly props?: Record<string, unknown>;
};

// Raw HTML node type
type RawHtmlNode = {
  readonly [RAW_HTML_MARKER]: true;
  readonly content: string;
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Check if node is HSX VNode (object with props)
const isHsxVNode = (v: unknown): v is HsxVNode =>
  v !== null &&
  typeof v === "object" &&
  "props" in v;

// Check if node is raw HTML marker
const isRawHtml = (v: unknown): v is RawHtmlNode =>
  v !== null &&
  typeof v === "object" &&
  RAW_HTML_MARKER in v;

// HSX semantic alias to HTMX attribute mapping
const htmxAliasMap: Record<string, string> = {
  get: "hx-get",
  post: "hx-post",
  put: "hx-put",
  patch: "hx-patch",
  delete: "hx-delete",
  target: "hx-target",
  swap: "hx-swap",
  pushUrl: "hx-push-url",
  trigger: "hx-trigger",
};

const renderAttrs = (props: Record<string, unknown>): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || value === false || value === undefined || value === null) {
      continue;
    }

    // Handle HSX behavior="boost" → hx-boost
    if (key === "behavior" && value === "boost") {
      parts.push(` hx-boost="true"`);
      continue;
    }

    // Map HSX semantic aliases to HTMX attributes
    const attrName = htmxAliasMap[key] ?? key;

    if (value === true) {
      parts.push(` ${attrName}`);
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
    parts.push(` ${attrName}="${escapeHtml(String(value))}"`);
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

  // Raw HTML node (created by html())
  if (isRawHtml(node)) {
    return node.content;
  }

  // HSX VNode: { type?, props }
  if (isHsxVNode(node)) {
    const { type, props = {} } = node;
    const children = props.children;

    // Fragment (no type property, or type is Fragment function)
    if (type === undefined || type === JsxFragment) {
      return renderVNode(children);
    }

    // Function component
    if (typeof type === "function") {
      return renderVNode(type(props));
    }

    // Native element
    if (typeof type === "string") {
      const attrs = renderAttrs(props);
      if (voidEls.has(type)) {
        return `<${type}${attrs}>`;
      }
      const inner = Array.isArray(children)
        ? children.map(renderVNode).join("")
        : renderVNode(children);
      return `<${type}${attrs}>${inner}</${type}>`;
    }
  }

  // Array of nodes
  if (Array.isArray(node)) {
    return node.map(renderVNode).join("");
  }

  return escapeHtml(String(node));
};

/**
 * Create a raw HTML node that bypasses escaping.
 * Use only with sanitized content (e.g., from DOMPurify).
 */
export const html = (content: string): RawHtmlNode => ({
  [RAW_HTML_MARKER]: true,
  content,
});

// Exported for unit tests
export const renderVNodeForTest = renderVNode;
