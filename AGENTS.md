# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Stock Decision Assistant (股票决策辅助系统) — a personal A-stock investment management web app with:
- **Server** (`server/`): Node.js Express API on port 3001. Proxies Chinese stock quotes (EastMoney → Sina → Tencent fallback). Data persisted to `server/data.json`.
- **Client** (`client/`): React 19 + TypeScript + Vite + Tailwind CSS v4. Dev server on port 5173 with `/api` proxy to backend.

### Running the development environment

```bash
npm run dev          # from repo root — runs both client and server concurrently
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: `curl http://localhost:3001/api/health`

### Important caveats

- The original `package-lock.json` files reference a Tencent Cloud npm mirror (`mirrors.tencentyun.com`) that is unreachable outside Tencent Cloud. The update script sets the npm registry to `https://registry.npmjs.org/` before installing. If `package-lock.json` is regenerated from within Tencent Cloud, it will reintroduce this mirror reference.
- `better-sqlite3` is declared in `server/package.json` but the actual persistence layer (`server/db.js`) uses a JSON file. The native addon build for `better-sqlite3` may show warnings; these are safe to ignore.
- The server uses `node --watch` for hot-reloading in dev mode. After installing new dependencies in `server/`, restart the server process.
- TypeScript check: `npx tsc -b --noEmit` in `client/`.
- Build: `npm run build` in `client/`.
- No ESLint or dedicated test framework is configured in this repo.
