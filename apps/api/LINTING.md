# ESLint Configuration

This project uses ESLint with TypeScript support for code quality and consistency.

## Configuration

The ESLint configuration is defined in `eslint.config.js` using the modern flat config format. It includes:

- **Base ESLint recommended rules**
- **TypeScript ESLint recommended rules** with type checking
- **Custom rules** tailored for a Node.js server environment

### Key Features

- ✅ TypeScript support with type-aware linting
- ✅ Automatic code formatting (quotes, semicolons, commas)
- ✅ Server-friendly rules (console statements allowed)
- ✅ Unused variable detection (prefix with `_` to ignore)
- ✅ Type safety warnings for `any` usage

## Available Scripts

```bash
# Run linting (shows errors and warnings)
npm run lint

# Run linting with auto-fix
npm run lint:fix

# Run linting with zero warnings tolerance (CI-friendly)
npm run lint:check
```

## Common Issues and Fixes

### Unused Variables

**Error:** `'variable' is defined but never used`
**Fix:** Prefix with underscore: `_variable` or remove if truly unused

### Equality Checks

**Error:** `Expected '!==' and instead saw '!='`
**Fix:** Use strict equality: `!==` instead of `!=`

### Process.exit Usage

**Warning:** `Don't use process.exit(); throw an error instead`
**Fix:** Throw an error instead of calling `process.exit()`

### Type Safety

**Warning:** `Unsafe assignment of an 'any' value`
**Fix:** Add proper TypeScript types instead of using `any`

## IDE Integration

For VS Code, install the ESLint extension to get real-time linting feedback in your editor.

## Configuration Customization

The configuration can be modified in `eslint.config.js`. The current setup is optimized for:

- Node.js server applications
- TypeScript development
- Team collaboration with consistent code style
