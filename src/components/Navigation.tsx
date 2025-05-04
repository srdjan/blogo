/**
 * Navigation component for the blog
 * Demonstrates proper mono-jsx usage
 */

type NavLinkProps = {
  href: string;
  currentPath: string;
  children: unknown;
};

export const NavLink = ({ href, currentPath, children }: NavLinkProps) => {
  const isActive = currentPath === href;
  
  return (
    <a
      href={href}
      class={`link${isActive ? ' active' : ''}`}
      hx-get={href}
      hx-target="#content-area"
      hx-swap="innerHTML"
      hx-push-url="true"
    >
      {children}
    </a>
  );
};

type NavigationProps = {
  currentPath: string;
};

export const Navigation = ({ currentPath }: NavigationProps) => {
  return (
    <nav>
      <div class="nav-links">
        <NavLink href="/" currentPath={currentPath}>Home</NavLink>
        <NavLink href="/tags" currentPath={currentPath}>Tags</NavLink>
        <NavLink href="/about" currentPath={currentPath}>About</NavLink>
        
        <button
          type="button"
          class="search-toggle link"
          aria-label="Search"
          aria-expanded="false"
          onClick="document.getElementById('search-modal').style.display='flex'"
        >
          Search
        </button>
        
        <a href="/feed.xml" class="link">RSS</a>
      </div>
    </nav>
  );
};
