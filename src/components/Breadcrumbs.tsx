// Breadcrumb navigation component with Schema.org markup

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function createBreadcrumbs(props: BreadcrumbsProps) {
  const { items } = props;
  
  // Generate JSON-LD structured data for breadcrumbs
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `https://blogo.timok.deno.net${item.href}`
    }))
  };

  return (
    <>
      <nav aria-label="Breadcrumb" class="breadcrumbs">
        <ol class="breadcrumb-list">
          {items.map((item, index) => (
            <li key={index} class="breadcrumb-item">
              {index < items.length - 1 ? (
                <>
                  <a href={item.href} class="breadcrumb-link">
                    {item.name}
                  </a>
                  <span class="breadcrumb-separator" aria-hidden="true"> / </span>
                </>
              ) : (
                <span class="breadcrumb-current" aria-current="page">
                  {item.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      
      {/* Structured data for SEO */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData, null, 2)}
      </script>
    </>
  );
}

// Helper function to generate breadcrumbs for different page types
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
  }

  return items;
}