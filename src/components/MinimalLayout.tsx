// Ultra minimal layout to test mono-jsx compatibility
interface MinimalLayoutProps {
  title: string;
  children: any;
}

export const MinimalLayout = ({ title, children }: MinimalLayoutProps) => {
  return (
    <html>
      <head>
        <title>{title}</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
};