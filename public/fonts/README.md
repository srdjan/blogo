# Fonts Usage

This blog uses a system font stack approach for optimal performance and native
look and feel.

## Font Stacks Used

### Sans-serif (Primary text)

```css
--font-sans:
  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
  sans-serif;
```

### Monospace (Code blocks)

```css
--font-mono: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
```

### Display (Headings)

```css
--font-display: system-ui, sans-serif;
```

## Benefits of System Fonts

1. **Performance**: No font files to download, reducing page load time
2. **Native look and feel**: UI matches the user's operating system
3. **Lower maintenance**: No need to convert, compress, or keep font files
   updated
4. **Improved accessibility**: System fonts often have better accessibility
   characteristics

## Custom Fonts (Optional)

If you want to use custom fonts in the future:

1. Add the font files in WOFF2 format to this directory
2. Create a `fonts.css` file in the `public/css` directory
3. Add the `@font-face` declarations in the CSS file
4. Update the main CSS file to use your custom fonts

Example:

```css
@font-face {
  font-family: "CustomFont";
  src: url("/fonts/custom-font.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```
