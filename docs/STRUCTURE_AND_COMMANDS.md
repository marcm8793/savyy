# Savyy Monorepo

This is a Turborepo monorepo containing the Savyy application with both client and server packages.

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `apps/web`: a [Next.js](https://nextjs.org/) app with TypeScript, Tailwind CSS, and tRPC
- `apps/api`: a [Fastify](https://fastify.dev/) server with TypeScript, tRPC, and Drizzle ORM

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

Install dependencies for all workspaces:

```bash
npm install
```

### Development

To develop all apps and packages, run the following command:

```bash
npm run dev
```

This will start both the client and server in development mode.

### Build

To build all apps and packages, run the following command:

```bash
npm run build
```

### Available Scripts

- `npm run dev` - Start all apps in development mode
- `npm run build` - Build all apps and packages
- `npm run start` - Start all apps in production mode
- `npm run lint` - Lint all apps and packages
- `npm run type-check` - Type check all apps and packages
- `npm run clean` - Clean build artifacts from all apps and packages
- `npm run db:generate` - Generate database schema
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open Drizzle Studio

### Workspace Structure

```
├── apps/
│   ├── web/         # Next.js frontend application
│   └── api/         # Fastify backend application
├── packages/        # Shared packages (future)
├── tools/           # Development tools and configs (future)
├── docs/            # Documentation
├── package.json     # Root package.json with workspace configuration
├── turbo.json       # Turborepo configuration
└── README.md        # This file
```

## Learn More

To learn more about Turborepo, take a look at the following resources:

- [Turborepo Documentation](https://turbo.build/repo/docs) - learn about Turborepo features and API.
- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Fastify Documentation](https://fastify.dev/docs/) - learn about Fastify features and API.
