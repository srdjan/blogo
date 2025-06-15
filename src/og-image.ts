// SVG-based Open Graph image generation
export function generateOGImage(
  title: string,
  subtitle?: string,
  tags?: string[]
): string {
  // Clean title for display (remove " - Blog" suffix if present)
  const cleanTitle = title.replace(/ - Blog$/, '');
  
  // Truncate title if too long
  const displayTitle = cleanTitle.length > 50 
    ? cleanTitle.substring(0, 47) + '...' 
    : cleanTitle;
    
  const displaySubtitle = subtitle && subtitle.length > 80
    ? subtitle.substring(0, 77) + '...'
    : subtitle;
    
  // Display up to 3 tags
  const displayTags = tags ? tags.slice(0, 3) : [];

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1200" height="630" fill="#ffffff"/>
  
  <!-- Border -->
  <rect x="0" y="0" width="1200" height="630" fill="none" stroke="#000000" stroke-width="8"/>
  
  <!-- Grid pattern for texture -->
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#grid)" opacity="0.3"/>
  
  <!-- Header Section -->
  <rect x="50" y="50" width="1100" height="80" fill="#000000"/>
  <text x="100" y="105" font-family="ui-monospace, 'SF Mono', Monaco, monospace" font-size="36" font-weight="bold" fill="#ffffff">
    BLOG
  </text>
  <text x="1050" y="105" font-family="ui-monospace, 'SF Mono', Monaco, monospace" font-size="24" fill="#ffffff" text-anchor="end">
    timok.deno.net
  </text>
  
  <!-- Main Title -->
  <text x="100" y="220" font-family="ui-monospace, 'SF Mono', Monaco, monospace" font-size="48" font-weight="bold" fill="#000000">
    ${escapeXml(displayTitle)}
  </text>
  
  <!-- Subtitle -->
  ${displaySubtitle ? `
  <text x="100" y="280" font-family="ui-monospace, 'SF Mono', Monaco, monospace" font-size="28" fill="#333333">
    ${escapeXml(displaySubtitle)}
  </text>
  ` : ''}
  
  <!-- Tags -->
  ${displayTags.length > 0 ? `
  <g transform="translate(100, ${displaySubtitle ? 340 : 300})">
    ${displayTags.map((tag, index) => `
    <g transform="translate(${index * 150}, 0)">
      <rect x="0" y="0" width="${tag.length * 12 + 20}" height="40" fill="#000000" rx="20"/>
      <text x="${tag.length * 6 + 10}" y="26" font-family="ui-monospace, 'SF Mono', Monaco, monospace" 
            font-size="18" fill="#ffffff" text-anchor="middle">
        #${escapeXml(tag)}
      </text>
    </g>
    `).join('')}
  </g>
  ` : ''}
  
  <!-- Footer decoration -->
  <rect x="100" y="520" width="1000" height="4" fill="#000000"/>
  <text x="100" y="560" font-family="ui-monospace, 'SF Mono', Monaco, monospace" font-size="20" fill="#666666">
    Claude &amp; Srdjan vibe coded together...
  </text>
  
  <!-- Corner decoration -->
  <circle cx="1100" cy="530" r="50" fill="none" stroke="#000000" stroke-width="2"/>
  <text x="1100" y="540" font-family="ui-monospace, 'SF Mono', Monaco, monospace" font-size="24" 
        fill="#000000" text-anchor="middle">⊣˚∆˚⊢</text>
</svg>`;

  return svg;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Generate default homepage OG image
export function generateDefaultOGImage(): string {
  return generateOGImage(
    "Blog",
    "A minimal blog built with mono-jsx, Deno & TypeScript",
    ["WebDev", "TypeScript", "Deno"]
  );
}