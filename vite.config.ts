import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function normalizedBase(value: string | undefined) {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

function rootAssetBasePlugin(base: string): Plugin {
  return {
    name: "github-pages-root-asset-base",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes(`${path.sep}src${path.sep}`)) return null;
      if (!/\.(css|ts|tsx)$/.test(id)) return null;
      const transformed = code
        .replaceAll('"/media/', `"${base}media/`)
        .replaceAll("'/media/", `'${base}media/`)
        .replaceAll('"/mascot/', `"${base}mascot/`)
        .replaceAll("'/mascot/", `'${base}mascot/`);
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const base = normalizedBase(env.GITHUB_PAGES_BASE);
  const publicSiteUrl = env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const apiBase = env.VITE_APPLICATION_API_BASE?.replace(/\/$/, "") ?? "";
  const apiOrigin = apiBase ? new URL(apiBase).origin : "http://127.0.0.1:8787";
  const canonical = publicSiteUrl ? `${publicSiteUrl}/` : "";
  const ogImage = canonical ? new URL("media/v7-generated/frog-opening-field.png", canonical).href : "";

  return {
    base,
    plugins: [
      rootAssetBasePlugin(base),
      react(),
      {
        name: "production-metadata-and-csp",
        transformIndexHtml(html) {
          const robots = canonical ? "index,follow" : "noindex,nofollow,noarchive";
          const csp = [
            "default-src 'self'",
            "script-src 'self' https://challenges.cloudflare.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            `connect-src 'self' ${apiOrigin} https://challenges.cloudflare.com`,
            "font-src 'self' data:",
            "frame-src https://challenges.cloudflare.com",
            "worker-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; ");
          let output = html.replace(
            '<meta name="robots" content="noindex,nofollow,noarchive" data-build-robots />',
            `<meta name="robots" content="${robots}" data-build-robots />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          );
          if (canonical) {
            output = output.replace(
              "</head>",
              `    <link rel="canonical" href="${canonical}" />\n    <meta property="og:url" content="${canonical}" />\n    <meta property="og:image" content="${ogImage}" />\n    <meta name="twitter:image" content="${ogImage}" />\n  </head>`,
            );
          }
          return output;
        },
      },
    ],
    resolve: {
      alias: { "@": path.resolve(projectRoot, "src") },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      target: "es2022",
    },
  };
});
