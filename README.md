# Forge AI Studio

Forge turns a natural-language request into a live React application. It combines a conversational build flow, real code generation, an isolated Sandpack preview, browser-local persistence, and restorable versions.

## What works

- Conversational app creation and iterative code changes
- Visible product, architecture, and build stages
- Real React code compiled in an isolated browser preview
- Preview/code switching
- Automatic local persistence
- Version history and restore
- DeepSeek-powered generation through a server-only API route
- Local demo fallback when no API key is configured

## Run locally

```bash
npm install
cp .env.example .env.local
# Add DEEPSEEK_API_KEY to .env.local
npm run dev
```

The local Vite server does not execute the Vercel API function. Use `vercel dev` to test the live DeepSeek route locally, or use the built-in demo mode with `npm run dev`.

## Deploy

Import the repository into Vercel and add `DEEPSEEK_API_KEY` as a Secret environment variable for Production and Preview. The key must never use a `VITE_` or `NEXT_PUBLIC_` prefix.

For Netlify, import the same repository. `netlify.toml` configures the build, SPA routing, and serverless generation endpoint. Add `DEEPSEEK_API_KEY` under Site configuration → Environment variables.

## Architecture decisions

Generated code runs in Sandpack rather than the host page. Every successful generation stores a complete file snapshot so a user can restore a working version. Project state is browser-local to keep the no-sign-up experience fast and avoid collecting user data.

## Current boundaries

- One React application per browser
- Browser-local persistence rather than cross-device cloud sync
- Basic request-size protection; production-scale abuse prevention would add a shared server-side rate limiter
- Demo fallback supports a bounded set of common changes

## Next priorities

1. Shared rate limiting and usage budget controls
2. Compile-error feedback and one-click AI repair
3. Cloud project sharing
4. Patch-based generation for larger codebases
