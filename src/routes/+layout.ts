// This is a pure client-side SPA (adapter-static with index.html fallback).
// Disable SSR globally so window/document references in components don't throw
// during the dev server's server-side render pass.
export const ssr = false;
