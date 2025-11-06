# Self-Hosted Google Fonts

This directory contains self-hosted Google Fonts to improve page load
performance by eliminating external requests.

## Required Font Files

Download the following font files and place them in this directory:

### Montserrat

- `montserrat-v26-latin-regular.woff2` (400)
- `montserrat-v26-latin-600.woff2` (600)
- `montserrat-v26-latin-700.woff2` (700)

### JetBrains Mono

- `jetbrains-mono-v18-latin-regular.woff2` (400)
- `jetbrains-mono-v18-latin-600.woff2` (600)

## Download Instructions

### Option 1: Using google-webfonts-helper (Recommended)

1. Visit https://gwfh.mrgrain.co.uk/
2. Search for "Montserrat"
3. Select charsets: latin
4. Select styles: regular (400), 600, 700
5. Choose "Best Support" format (woff2)
6. Download the font files
7. Repeat for "JetBrains Mono" with styles: regular (400), 600

### Option 2: Direct Download from Google Fonts

Run these commands from the `public/fonts/` directory:

```bash
# Note: These URLs may change. Use google-webfonts-helper for stable links.

# Montserrat
curl -L "https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.woff2" -o montserrat-v26-latin-regular.woff2
curl -L "https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w5aXo.woff2" -o montserrat-v26-latin-600.woff2
curl -L "https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aXo.woff2" -o montserrat-v26-latin-700.woff2

# JetBrains Mono
curl -L "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOVgaY.woff2" -o jetbrains-mono-v18-latin-regular.woff2
curl -L "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjN1OVgaY.woff2" -o jetbrains-mono-v18-latin-600.woff2
```

### Option 3: Use Fallback Fonts (Temporary)

If fonts are not available, the site will fall back to system fonts defined in
the CSS.

## Performance Benefits

Self-hosting fonts eliminates:

- DNS lookup to fonts.googleapis.com
- TCP/TLS handshake
- HTTP request latency
- Render-blocking external resource

**Expected improvement:** 100-300ms faster first paint on initial page load.
