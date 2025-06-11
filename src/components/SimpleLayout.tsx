// Minimal Layout component for mono-jsx testing
interface SimpleLayoutProps {
  title: string;
  children: any;
}

export const SimpleLayout = ({ title, children }: SimpleLayoutProps) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>{title}</title>
        <link rel="stylesheet" href="/css/main.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a> | <a href="/tags">Tags</a> | <a href="/about">About</a>
        </nav>
        {children}
      </body>
    </html>
  );
};