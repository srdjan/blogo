// New mono-jsx entry point
import { Layout } from "./src/components/Layout.tsx";
import { SimpleLayout } from "./src/components/SimpleLayout.tsx";
import { MonoLayout } from "./src/components/MonoLayout.tsx";
import { MinimalLayout } from "./src/components/MinimalLayout.tsx";
import { createBlogLayout } from "./src/utils/layout-helpers.tsx";

export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    
    console.log(`mono-jsx: ${req.method} ${url.pathname}`);
    
    // Handle static files
    if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
      try {
        // Files are in public/ directory, so map /css/main.css to public/css/main.css
        const filePath = `public${url.pathname}`;
        console.log(`Trying to serve static file: ${filePath}`);
        
        const file = await Deno.readFile(filePath);
        const ext = filePath.split('.').pop();
        
        let contentType = 'text/plain';
        if (ext === 'css') contentType = 'text/css';
        else if (ext === 'js') contentType = 'application/javascript';
        else if (ext === 'html') contentType = 'text/html';
        
        return new Response(file, {
          headers: { 'Content-Type': contentType }
        });
      } catch (error) {
        console.log(`Static file not found: ${url.pathname}, error:`, error.message);
        return new Response('File not found', { status: 404 });
      }
    }
    
    // Handle test route with full blog layout
    if (url.pathname === '/mono-test') {
      return createBlogLayout(
        {
          title: "Layout Test - Blog",
          description: "Testing the full blog layout helper function",
          path: url.pathname
        },
        <main>
          <h1>🎉 Full Blog Layout Working!</h1>
          <p>This page uses the complete blog layout with all features:</p>
          <ul>
            <li>✅ Unicode symbols in navigation</li>
            <li>✅ HTMX attributes</li>
            <li>✅ Search modal</li>
            <li>✅ SVG icons</li>
            <li>✅ Active navigation states</li>
            <li>✅ All CSS and JavaScript</li>
          </ul>
          <p>Try clicking the navigation links and search button!</p>
        </main>
      );
    }
    
    // Handle root route with blog layout
    if (url.pathname === '/') {
      return createBlogLayout(
        {
          title: "Blog - Home",
          description: "A minimal blog built with mono-jsx",
          path: url.pathname
        },
        <main>
          <h1>🏠 Welcome to the Blog</h1>
          <p>This is the home page using the mono-jsx blog layout helper function.</p>
          <section>
            <h2>Features Working:</h2>
            <ul>
              <li>✅ Full blog layout with navigation</li>
              <li>✅ HTMX for dynamic navigation</li>
              <li>✅ Search functionality</li>
              <li>✅ Unicode symbols and styling</li>
              <li>✅ Helper function approach</li>
            </ul>
          </section>
        </main>
      );
    }

    // Handle tags route with blog layout
    if (url.pathname === '/tags') {
      return createBlogLayout(
        {
          title: "Tags - Blog",
          description: "Browse posts by tags",
          path: url.pathname
        },
        <main>
          <h1>📌 Tags</h1>
          <p>This is a placeholder for the tags page using blog layout.</p>
          <p>Navigation should highlight "Tags" as active.</p>
        </main>
      );
    }

    // Handle about route with blog layout
    if (url.pathname === '/about') {
      return createBlogLayout(
        {
          title: "About - Blog",
          description: "About this blog",
          path: url.pathname
        },
        <main>
          <h1>ℹ️ About</h1>
          <p>This is a placeholder for the about page using blog layout.</p>
          <p>Navigation should highlight "About" as active.</p>
        </main>
      );
    }
    
    // For all other routes, return 404 with more info
    return new Response(`Route not found in mono-jsx app: ${url.pathname}`, { status: 404 });
  },
};