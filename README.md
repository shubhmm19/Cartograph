Cartograph maps a public TypeScript or JavaScript repository from its real imports. Phase 03 provides the standalone repository parser and CLI.

## Parse a repository

Install dependencies, then run the parser against any directory already on disk:

```bash
pnpm install
pnpm parse:repo /path/to/repository
pnpm parse:repo /path/to/repository --output /tmp/cartograph-analysis.json
```

The parser reads TypeScript and JavaScript files without starting Next.js or making network requests. It prints file totals, folder counts, dependency coverage and skip reasons. The optional JSON output follows the contract in `lib/parser/types.ts`; the CLI reads it back and validates the contract before it exits.

The parser keeps source files from the repository and skips dependency/build directories such as `node_modules`, `.git`, `.next`, `dist` and `build`. Imports that resolve to excluded files, external packages or unresolved paths remain visible in the coverage report.

## Run the web app

This is a [Next.js](https://nextjs.org) app.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
