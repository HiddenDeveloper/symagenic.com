# Repository Guidelines

## Project Structure & Module Organization

- `src/`: React + TypeScript source (components, hooks, machines).
- `public/`: Static assets served by Vite.
- `dist/`: Production build output (generated).
- Config: `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `tailwind.config.js`.

## Build, Test, and Development Commands

- Install: `npm install` (Node 18+; Volta pins Node `22.14.0`).
- Dev server: `npm run dev` (Vite with React Fast Refresh).
- Lint: `npm run lint` (ESLint with Prettier and plugins).
- Build: `npm run build` (type-check + Vite build to `dist/`).
- Preview: `npm run preview` (serve the production build).

## Coding Style & Naming Conventions

- TypeScript: ESM modules, 2-space indent, strict typing preferred.
- React: function components, hooks-first; colocate styles and tests with components.
- Naming: files/dirs kebab-case (`chat-panel/`), symbols camelCase; React components PascalCase.
- Lint/format: ESLint + Prettier; use `eslint-plugin-react(-hooks|refresh)`, `jsx-a11y`, and `simple-import-sort`.

## Testing Guidelines

- This package has no test runner configured yet.
- If adding tests, prefer `vitest` + `@testing-library/react`.
- Test names: `*.test.ts`/`*.test.tsx`; colocate under `src/` near code.
- Keep components pure and extract side effects to hooks to simplify testing.

## Commit & Pull Request Guidelines

- Commits: follow Conventional Commits (e.g., `feat(ui):`, `fix(ui):`, `chore(ui):`). Keep them atomic and scoped.
- PRs: include purpose, linked issues, how to run locally, and screenshots/GIFs for UI changes. Ensure `npm run build` and `npm run lint` pass.

## Security & Configuration Tips

- Do not commit secrets; environment config should live outside this package.
- Keep dependencies minimal; prefer lightweight utilities.
- When introducing new tooling, update scripts and document usage here.
