# Savyy Monorepo

A modern monorepo for the Savyy application built with Turborepo.

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers
npm run dev

# Build all apps
npm run build
```

## Structure

- `apps/web` - Next.js frontend application
- `apps/api` - Fastify backend application
- `packages/` - Shared packages (coming soon)
- `tools/` - Development tools and configurations (coming soon)

## Documentation

For detailed documentation, see [docs/README.md](./docs/README.md).

## Development

This monorepo uses [Turborepo](https://turbo.build/repo) for efficient task running and caching.

All commands are run from the root directory and will execute across all relevant workspaces.
