// Breadcrumb utilities
import type { BreadcrumbItem } from "../lib/types.ts";

export function generateBreadcrumbs(path: string, title?: string): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { name: "Home", href: "/" }
  ];

  if (path.startsWith('/posts/')) {
    items.push({ name: "Posts", href: "/posts" });
    if (title) {
      items.push({ name: title, href: path });
    }
  } else if (path.startsWith('/tags/')) {
    const tag = path.replace('/tags/', '');
    items.push({ name: "Tags", href: "/tags" });
    items.push({ name: `#${tag}`, href: path });
  } else if (path === '/about') {
    items.push({ name: "About", href: "/about" });
  } else if (path === '/search') {
    items.push({ name: "Search", href: "/search" });
  } else if (path === '/rss') {
    items.push({ name: "RSS", href: "/rss" });
  } else if (path.startsWith('/rss/topic/')) {
    const topic = path.replace('/rss/topic/', '').replace(/-/g, ' ');
    items.push({ name: "RSS", href: "/rss" });
    items.push({ name: topic, href: path });
  }

  return items;
}
