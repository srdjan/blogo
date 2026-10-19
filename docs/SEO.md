# Blogo SEO Implementation

This document describes the SEO features that Blogo implements. Each claim in
the first two sections matches the code at the time of writing.

## Implemented SEO Features

### Core Meta Tags and Open Graph

`src/components/Layout.tsx` renders these tags:

- Open Graph tags with fallbacks
- Twitter Card tags (`summary_large_image`)
- A canonical URL for each page
- A meta description from the post excerpt
- Article tags for posts: published time, modified time, author, tags, section
- A robots meta tag
- Theme color and locale

### Structured Data (JSON-LD)

- `BlogPosting` schema for posts
- `WebSite` schema for other pages
- Organization markup for the publisher
- Author, dates, and keywords for posts

### Generated Files

- Open Graph images for posts at `/images/og/{slug}.svg`
- Default Open Graph image at `/images/og-default.svg`
- XML sitemap at `/sitemap.xml` with `lastmod` dates
- RSS feeds at `/feed.xml` and `/rss.xml`
- `robots.txt` with a sitemap reference

### Web App Manifest

- Manifest at `/manifest.json`
- Icons in SVG format

### Performance

- A preload hint for the JetBrains Mono font
- Pages without client-side rendering
- Fingerprinted static assets in the static build

## Helpers That No Page Uses Yet

Two modules in `src/utils/` are tested helpers. No page calls them yet. The
project kept them on purpose (decision D4).

- `src/utils/seo-helpers.ts` contains `analyzeSEO`, `generateFAQSchema`, and
  `generateHowToSchema`.
- `src/utils/reading-time.ts` contains `calculateReadingTime` and
  `getReadingTimeMeta`.

The site does not render a reading-time display. The site does not render a
breadcrumb navigation or a breadcrumb schema. The file
`src/components/Breadcrumbs.tsx` does not exist.

## Content Guidelines

### Blog Post Frontmatter

Each post can include these fields:

```yaml
title: "Descriptive Title (30-60 characters)"
date: 2025-01-01
modified: 2025-01-02 # Optional
tags: [Tag1, Tag2, Tag3]
excerpt: "Compelling meta description (120-160 characters)"
```

### SEO Best Practices

These are general guidelines. The build does not enforce them.

1. Titles: use 30 to 60 characters and include the target keywords.
2. Descriptions: use 120 to 160 characters.
3. Content: write at least 300 words for a substantial post.
4. Headings: keep the hierarchy H1, H2, H3.
5. Images: add descriptive alt text.
6. Internal links: link to related posts.

## Deployment Checklist

Before you deploy, do these checks:

1. Verify that all images have alt text.
2. Check that the meta descriptions have 120 to 160 characters.
3. Check the heading hierarchy.
4. Open a post Open Graph image in a browser.
5. Validate the structured data with Google Rich Results Test.
6. Check the sitemap output.
7. Check the RSS feed output.

## Monitoring

Use these external tools. This repository has no measurements from them.

- Google Search Console: search performance
- PageSpeed Insights: Core Web Vitals
- Rich Results Test: structured data
- Mobile-Friendly Test: mobile usability

## Maintenance

- Fix crawl errors that Search Console reports.
- Update meta descriptions when click-through rates are low.
- Add internal links to new related posts.
- Update the alt text of images.
- Review the structured data when `Layout.tsx` changes.
