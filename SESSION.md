# NodeLx — Working Session
**Date:** May 4, 2026
**Session Length:** ~9 hours
**Engineer:** @aMarketology
**Branch:** `main` → today we'll branch to `feature/auth`

---

## 🎯 Session Goal

By end of today, a user can:
1. Run `npm run user:create` to create a developer account
2. Navigate to `http://localhost:3001/admin`
3. Log in with email + password
4. Be redirected based on role (`developer` → `/admin/dev`, `client` → `/admin/editor`)
5. Log out

**This is Milestone 1 from `3MONTHS_PLAN.md` — the entire auth foundation.**
If we finish early, we push into Milestone 2 (Git audit log).

---

## 📍 Starting Context

### What's already wired in `server/index.js`
- Express server on port `3001`
- CORS (localhost:3000, 5173, 5174)
- `ContentStore` — reads/writes `/content/*.json`
- `WebSocketServer` — live preview broadcast
- `SourceMapper` / `CodeEditor` / AST pipeline
- Static file serving from `/public`

### Current `package.json` dependencies
Already have: `express`, `cors`, `ws`, `@babel/core`, `react`, `chokidar`
**Missing:** `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `express-rate-limit`

### What does NOT exist yet
- `/server/auth/` directory — doesn't exist
- `/content/users.json` — doesn't exist
- `/public/admin/` directory — doesn't exist
- Any session/cookie handling
- Any route protection

### The `.env` situation
No `.env` file exists. We will create `.env` and `.env.example` today.

---

## 🗂️ Files We Will Create Today

```
server/
  auth/
    users.js          ← read/write content/users.json
    hash.js           ← bcrypt helpers
    jwt.js            ← sign/verify tokens
    middleware.js     ← requireAuth, requireRole(role)
  routes/
    admin.js          ← /api/auth/* routes + /admin/* page routes

content/
  users.json          ← seeded with one developer account

public/
  admin/
    login.html        ← standalone login page (no React)
    login.css         ← styles
    admin.js          ← fetch-based login/logout JS

scripts/
  create-user.js      ← CLI: npm run user:create

.env                  ← JWT_SECRET, PORT (git-ignored)
.env.example          ← safe template to commit
```

**Files we will modify today:**
```
server/index.js       ← mount auth routes, add cookie-parser
package.json          ← add new deps + user:create script
.gitignore            ← add .env
```

---

## ⏱️ Hour-by-Hour Plan

### Hour 1 (9:00 – 10:00) — Setup & Dependencies
**Goal:** Clean environment, deps installed, `.env` wired.

- [ ] `git checkout -b feature/auth`
- [ ] Install packages:
  ```bash
  npm install bcryptjs jsonwebtoken cookie-parser express-rate-limit
  ```
- [ ] Create `.env`:
  ```
  JWT_SECRET=<generate a 64-char random string>
  JWT_EXPIRES_IN=7d
  PORT=3001
  NODE_ENV=development
  ```
- [ ] Create `.env.example` (blank values)
- [ ] Add `.env` to `.gitignore`
- [ ] Verify server still starts: `npm run dev`

**Checkpoint:** Server runs, no errors, `.env` loads.

---

### Hour 2 (10:00 – 11:00) — Auth Utilities
**Goal:** `hash.js` and `jwt.js` written and tested inline.

- [ ] Create `server/auth/hash.js`
  - `hashPassword(plain)` → bcrypt hash (rounds: 12)
  - `verifyPassword(plain, hash)` → boolean
- [ ] Create `server/auth/jwt.js`
  - `signToken(payload)` → signed JWT (from `.env` secret + expiry)
  - `verifyToken(token)` → decoded payload or throws
- [ ] Quick smoke test in Node REPL to confirm both work

**Checkpoint:** Can hash a password, verify it, sign a token, decode it.

---

### Hour 3 (11:00 – 12:00) — Users Store
**Goal:** `users.js` reads/writes `content/users.json`, `create-user.js` script works.

- [ ] Create `content/users.json`:
  ```json
  { "users": [] }
  ```
- [ ] Create `server/auth/users.js`
  - `getUsers()` → reads file
  - `findUserByEmail(email)` → returns user or null
  - `createUser({ email, password, role })` → hashes pw, appends, writes file
  - `updateUser(email, patch)` → patch update
- [ ] Create `scripts/create-user.js`
  - Parses `--email`, `--role`, `--password` CLI flags
  - Calls `createUser()`, logs success
  - Usage: `npm run user:create -- --email=dev@nodelx.dev --role=developer --password=changeme`
- [ ] Add to `package.json` scripts:
  ```json
  "user:create": "node scripts/create-user.js"
  ```
- [ ] Run it: seed your own developer account

**Checkpoint:** `content/users.json` contains your account. `findUserByEmail` returns it.

---

### Hour 4 (12:00 – 1:00) — Auth Routes
**Goal:** `POST /api/auth/login` and `POST /api/auth/logout` work in Postman/curl.

- [ ] Create `server/auth/middleware.js`
  - `requireAuth(req, res, next)` — reads `nodelx_token` cookie, verifies JWT, sets `req.user`
  - `requireRole(role)` — returns middleware that checks `req.user.role`
- [ ] Create `server/routes/admin.js`
  - `POST /api/auth/login`
    - Finds user by email
    - Verifies password
    - Signs JWT, sets HTTP-only cookie: `nodelx_token`
    - Returns `{ ok: true, role }`
  - `POST /api/auth/logout`
    - Clears cookie
    - Returns `{ ok: true }`
  - `GET /api/auth/me`
    - Uses `requireAuth` middleware
    - Returns `{ email, role }`
- [ ] Mount in `server/index.js`:
  ```js
  const cookieParser = require('cookie-parser');
  this.app.use(cookieParser());
  const adminRoutes = require('./routes/admin');
  this.app.use('/', adminRoutes);
  ```

**Checkpoint:** `curl -X POST localhost:3001/api/auth/login -d '{"email":"...","password":"..."}' -H 'Content-Type: application/json'` returns `{ ok: true, role: "developer" }` and sets a cookie.

---

### 🍕 LUNCH BREAK (1:00 – 1:30)

---

### Hour 5 (1:30 – 2:30) — Rate Limiting + Security
**Goal:** Login is brute-force protected. Bad actors get blocked.

- [ ] Add `express-rate-limit` to login route:
  - 5 attempts per IP per 15 minutes
  - Returns `429` with message: `"Too many login attempts. Try again in 15 minutes."`
- [ ] Add `helmet` (optional but easy — `npm install helmet`, one line in `index.js`)
- [ ] Validate login input: reject empty email/password, reject non-email format
- [ ] Ensure `users.json` is in `.gitignore` OR ensure passwords are always hashed before checking in (add note to `RUNBOOK.md` stub)
- [ ] Test: 6th login attempt within 15 min returns 429

**Checkpoint:** 5 rapid-fire bad logins → 6th is blocked with 429.

---

### Hour 6 (2:30 – 3:30) — Admin Login Page
**Goal:** `/admin` shows a real login form in the browser. No React — plain HTML.

- [ ] Create `public/admin/login.html`
  - Clean, minimal form: email + password + submit
  - NodeLx branding (name + subtitle)
  - Error message div (hidden by default)
- [ ] Create `public/admin/login.css`
  - Dark theme to match existing editor
  - Centered card layout
  - Loading state on button
- [ ] Create `public/admin/admin.js`
  - `fetch('/api/auth/login', { method: 'POST', body: ..., credentials: 'include' })`
  - On success: `window.location.href = role === 'developer' ? '/admin/dev' : '/admin/editor'`
  - On failure: show error message
  - On page load: call `/api/auth/me` — if already logged in, redirect immediately
- [ ] Add routes to `server/routes/admin.js`:
  - `GET /admin` → if logged in redirect by role, else serve `login.html`
  - `GET /admin/dev` → `requireAuth + requireRole('developer')`, serve existing editor
  - `GET /admin/editor` → `requireAuth`, serve client editor (stub for now: "Client Editor coming soon")
  - `GET /admin/logout` → clear cookie + redirect to `/admin`

**Checkpoint:** Open browser to `localhost:3001/admin` → see login form → login → land on dev editor.

---

### Hour 7 (3:30 – 4:30) — Gate the Existing Editor
**Goal:** Current split-view editor is inaccessible without auth.

- [ ] Audit all existing routes in `server/index.js` — identify any that write content
- [ ] Add `requireAuth` to:
  - `PUT /api/content/:page` (or equivalent save route)
  - `POST /api/code/*` (AST / code edit routes)
  - Any other write routes
- [ ] `GET /api/content/*` (reads) can stay open for now (site needs to read content)
- [ ] Test: log out, try to `PUT /api/content/home` → get `401`
- [ ] Test: log in as developer, same request → succeeds

**Checkpoint:** Unauthenticated writes return 401. Authenticated writes still work.

---

### Hour 8 (4:30 – 5:30) — Wire It Together + Smoke Test
**Goal:** Full end-to-end flow works, no console errors, no broken existing features.

- [ ] Full flow test:
  1. Fresh browser (incognito), visit `localhost:3001/admin`
  2. See login form
  3. Login with developer account
  4. See existing split-view editor
  5. Make a content edit — verify it saves
  6. Visit `localhost:3001/admin/logout`
  7. Try to access `localhost:3001/admin/dev` — redirected to login
- [ ] Create test client account: `npm run user:create -- --email=client@test.com --role=client --password=test123`
- [ ] Login as client → see "Client Editor coming soon" page
- [ ] Verify WebSocket still works (live preview updates)
- [ ] Fix any bugs found

**Checkpoint:** Both roles work. All existing features unbroken. Logout flow clean.

---

### Hour 9 (5:30 – 6:30) — Cleanup, Git, and Milestone 2 Kickoff
**Goal:** Code is committed. Docs updated. Tomorrow starts from a clean baseline.

- [ ] `git add -A && git commit -m "feat: auth foundation — login, JWT, role-gated routes"`
- [ ] Update `3MONTHS_PLAN.md` — check off completed Milestone 1 tasks
- [ ] Update this `SESSION.md` — mark completed items, add actual notes/blockers
- [ ] Write `NEXT_STEPS.md` with what's up next (see section below)
- [ ] **If time allows (Milestone 2 kickoff):**
  - Install `simple-git`
  - Create `server/git/commit.js` stub
  - Hook into `PUT /api/content/:page` to auto-commit after save

---

## 🔁 If We Finish Early — Milestone 2 Preview

If auth is fully working before Hour 9, start `feature/git-audit`:

```js
// server/git/commit.js (the whole thing is ~20 lines)
const { simpleGit } = require('simple-git');
const git = simpleGit(process.cwd());

async function commitContentChange({ file, field, author, email }) {
  await git.add(file);
  await git.commit(
    `content: edit ${field} in ${file}`,
    { '--author': `${author} <${email}>` }
  );
}

module.exports = { commitContentChange };
```

Then in the content save handler:
```js
await commitContentChange({
  file: `content/${page}.json`,
  field: Object.keys(updates).join(', '),
  author: req.user.email.split('@')[0],
  email: req.user.email
});
```

That's it. **Level 1 Git integration in ~30 minutes** if auth is solid.

---

## 🚧 Known Blockers / Watch-Outs

1. **`server/index.js` is a class** — `setupRoutes()` is a method. Mount auth routes inside `setupRoutes()`, not at module level.

2. **Cookie domain on localhost** — `sameSite: 'lax'` for dev, `sameSite: 'strict'` + `secure: true` for prod. Use `NODE_ENV` to switch.

3. **`content/users.json` in Git** — hashed passwords are safe to commit. But add a note: never commit plain-text passwords. The seed script handles this correctly since it hashes before writing.

4. **Existing CORS config** — currently allows `localhost:3000` and `:5173`. When we add cookies, ensure `credentials: true` is set (already there).

5. **Express 5 is in use** — error handling is slightly different (async errors propagate automatically). Don't use the Express 4 `next(err)` pattern for async routes — let them throw naturally.

---

## 📋 End-of-Week Targets (By May 10)

After today's session, the rest of the week fills out Milestone 1 and kicks off Milestone 2:

| Day | Target |
|-----|--------|
| **Mon May 4** ← Today | Auth foundation complete (this session) |
| **Tue May 5** | Polish login UI, fix any bugs from today, write basic tests |
| **Wed May 6** | Milestone 2: `simple-git` — every save commits with author |
| **Thu May 7** | `GET /api/history/:page` — last 50 commits as API |
| **Fri May 8** | History viewer in Developer Mode UI — basic commit log panel |
| **Sun May 10** | Weekly retro — update `3MONTHS_PLAN.md`, plan Week 2 |

---

## 🔭 Next 3 Weeks Preview

| Week | Milestone | Key Output |
|------|-----------|------------|
| **Week 2 (May 11–18)** | Git audit complete + Admin shell polish | Every save is a commit. Login page is production-quality. |
| **Week 3 (May 19–25)** | Client Mode editor (schema-driven form) | Client user can edit text fields, sees live preview |
| **Week 4 (May 26–Jun 1)** | Client Mode save + validation | Client cannot inject new fields or break schema |

---

## 📝 Session Notes

**Date:** May 4–5, 2026
**Hours:** ~9
**Branch started:** `feature/auth` → **merged to `main`** ✅
**GitHub:** pushed to `origin/main` (commit `5b1633a`) ✅

### What Was Completed ✅
- All auth files scaffolded and working
- Server boots with `dotenv`, `helmet`, `cookieParser`, `adminRoutes` wired
- Both users seeded (`dev@nodelx.dev` / `client@austin.com`)
- Login, `/me`, logout, role redirect all verified via curl
- Rate limiter active
- `feature/auth` merged to `main` with `--no-ff` merge commit
- `3MONTHS_PLAN.md` M1 marked complete

### Blockers Encountered
- Express 5 `_router` inspection behaves differently than Express 4 — used process isolation to debug route registration
- CORS was narrowed to localhost-only; reverted to `origin: true` for dev network access
- `users.json` was seeded as `{ users: [] }` object instead of array — fixed with format detection in `users.js`

### Left for Next Session
- [ ] Open browser to `http://localhost:3001/admin/login` — verify login page loads
- [ ] Test login flow in actual browser (cookies, redirect)
- [ ] Begin **Milestone 2**: install `simple-git`, create `server/git/commit.js`

### Next Session Start Commands
```bash
cd ~/Documents/GitHub/NodeLx
git pull origin main          # get latest
node server/index.js &        # start server
open http://localhost:3001/admin/login   # test in browser
```

---

## 🔁 End-of-Session Git Ritual (Run Every Session)

At the end of EVERY session, run these commands to keep docs + GitHub in sync:

```bash
cd ~/Documents/GitHub/NodeLx

# 1. Stage everything including doc updates
git add -A

# 2. Commit with a session summary message
git commit -m "session: [DATE] — [what you did in one line]"

# 3. Push to GitHub
git push origin main

# 4. Open these docs and update checkboxes/notes:
#    - SESSION.md      → fill in what was done, blockers, next steps
#    - 3MONTHS_PLAN.md → check off completed milestone tasks
#    - NEXT_STEPS.md   → update priority queue
```

**This ritual takes 5 minutes. Skip it and you lose context. Do it every time.**
