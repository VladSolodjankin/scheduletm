/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}

interface Window {
  /** Set by the web server when the page is opened through the page owner's own domain. */
  __PUBLIC_PAGE_DOMAIN__?: string;
  __PUBLIC_PAGE_SLUG__?: string;
}
