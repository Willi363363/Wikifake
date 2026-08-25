// Tailwind v4 is a PostCSS plugin and nothing else: no config file, no content
// globs, no preset. What used to be `tailwind.config.js` is `@theme` in CSS,
// which is why `packages/ui` ships a stylesheet rather than a JavaScript object.
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
