# backoffice-back — CMS API

Node.js + TypeScript (strict) + Express 5 + MongoDB (Mongoose). See the [root README](../README.md) for the overall picture.

## Scripts

| Command | |
|---|---|
| `npm run db:up` / `db:down` | Start/stop MongoDB in Docker (`127.0.0.1:27018`, volume `taki-cms-mongo-data`) |
| `npm run dev` | API with reload on http://localhost:4000 |
| `npm run build` && `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Insert whatever is missing (pages, sections, content types, entries, media records, first super admin). Never overwrites edited content. |
| `npm run seed -- --force [--only=home,contact]` | Overwrite content with the seed files (drafts discarded). Development only. |
| `npm run migrate:forms` | One-off, for a database seeded before the forms were stored by the API: updates the texts of the three form sections (confirmation messages, CV field). Safe to run twice. |
| `npm run migrate:team` | One-off, for a database seeded while the organisation chart was a content type: moves its levels into the « Organigramme » section of the page Notre équipe (members can now have a photo) and removes the old content type. Safe to run twice. |

Configuration is read from `.env` and validated at start-up (`src/config/env.ts`); see `.env.example` for every variable.

## Structure

```
src/
  server.ts, app.ts        process start-up, middleware chain and route mounting
  config/                  env (validated), db connection, permissions (RBAC matrix)
  middleware/              auth (session + permissions), csrf (origin guard), validate (zod),
                           rateLimit, upload (multer), error (single error → HTTP mapping)
  modules/<feature>/       *.routes → *.controller → *.service → *.model, + *.validators
    auth, users, pages, sections, entries (+ content types), media, dashboard (+ activity log), public,
    submissions (website forms: contact, pre-registration, job applications + CV files)
  types/                   content field definitions, zod schema for them, Express augmentation
  utils/                   ApiError, response envelope, logger (pino), jwt, fields (infer + sanitise),
                           site (revalidation webhook), text
  seed/                    seed runner + content/*.ts (the website's original content)
```

## API

Every response is `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details? } }`.

**Public (website, no session)** — published and visible content only:
`GET /api/public/pages/:page` · `GET /api/public/entries/:type` · `GET /api/public/entries/:type/:slug` · `POST /api/public/preview/verify`.
Sending `x-preview-secret` returns drafts instead.

**Website forms** — the only public routes that write. They are called by the website's server (never by a browser), which must send `x-forms-secret` (= `FORMS_SECRET`) and the visitor's address in `x-client-ip`:
`POST /api/public/submissions/contact` · `POST /api/public/submissions/admission` (JSON) · `POST /api/public/submissions/job` (multipart, CV in `cv`).
They answer `201 { reference }`, or `422` with one issue per form field.

**Backoffice (session cookie)**:

| Area | Endpoints | Permission |
|---|---|---|
| Auth | `POST /api/auth/login`, `POST /logout`, `GET/PATCH /me`, `POST /password` | — |
| Dashboard | `GET /api/dashboard`, `POST /api/dashboard/preview-link` | `content:read` |
| Pages | `GET /api/pages` | `content:read` |
| Sections | `GET /api/sections?page=`, `GET /:id` | `content:read` |
| | `PUT /:id/draft`, `DELETE /:id/draft`, `PATCH /:id` (label…) | `content:write` |
| | `POST /:id/publish`, `PATCH /:id` (visible), `POST /reorder` | `content:publish` |
| | `DELETE /:id` | `content:delete` |
| | `POST /`, `PATCH /:id` (fields) | `content:structure` |
| Content types | `GET /api/content-types[/:key]`; `POST`, `PATCH /:key` | `content:read`; `content:structure` |
| Entries | `GET /api/entries?type=&search=&status=&page=`, `GET /:id`, `POST /`, `PUT /:id/draft`, `POST /:id/publish`, `PATCH /:id`, `POST /reorder`, `DELETE /:id` | as sections |
| Media | `GET /api/media`, `GET /:id` (with usage), `GET /rules` | `media:read` |
| | `POST /` (multipart `files`), `PATCH /:id`, `PUT /:id/file` (replace) | `media:write` |
| | `DELETE /:id[?force=true]` | `media:delete` |
| Users | `GET /api/users`; `POST`, `PATCH /:id`, `POST /:id/password`, `DELETE /:id` | `users:read`; `users:manage` |
| Submissions | `GET /api/submissions?type=&status=&search=&from=&to=&sort=&order=&page=`, `GET /counts`, `GET /:id`, `GET /:id/cv` (download), `GET /export` (CSV, same filters) | `submissions:read` |
| | `PATCH /:id` (status, internal note), `DELETE /:id` (also deletes the CV) | `submissions:manage` |

Sections flagged `restricted` additionally require `settings:manage`.

## Security

- Passwords: bcrypt (cost 12); login compares against a dummy hash for unknown e-mails.
- Session: signed JWT in an `HttpOnly`, `SameSite=Lax` (and `Secure` in production) cookie. Every request reloads the user, so deactivating an account, changing a role or a password ends existing sessions (`tokenVersion`).
- CSRF: state-changing requests must come from an origin in `CORS_ORIGINS`.
- Rate limits: 10 failed logins / 15 min per IP, 600 requests / min on the API, 40 uploads / min.
- Input: zod on every body and query; content is validated against its field definitions (types, lengths, links limited to `/…`, `https://`, `mailto:`, `tel:`).
- Uploads: allow-list of types (JPG, PNG, WebP, GIF, AVIF, SVG, MP4, WebM, PDF) checked by file signature, per-type size limits, SVGs with scripts refused, server-generated file names, served with `nosniff` and a sandboxing CSP.
- Website forms: accepted only with the shared `FORMS_SECRET`; 10 attempts / 10 min per visitor; every field trimmed, stripped of control characters, length-limited and validated (e-mail, phone, date of birth, `http(s)` links); a hidden honeypot field drops robots silently; the same form sent twice within an hour is stored once.
- CVs: PDF or Word `.docx` only (decided from the file's content, macro-enabled documents refused), 5 MB, stored under random names in `PRIVATE_UPLOAD_DIR`, which is **not** served statically: the only way to a CV is `GET /api/submissions/:id/cv` with a session that has `submissions:read`. Downloads and exports are sent as attachments with `no-store`; CSV cells that a spreadsheet would run as a formula are neutralised.
- Submissions hold personal data (including minors'): only super admins and administrators can see them; deleting one removes its CV from disk.
- `helmet` headers, JSON body limit 2 MB, no stack traces in responses.

## Indexes

`users.email` (unique), `sections (page, key)` (unique) and `(page, order)`, `entries (type, order)`, `(type, visible, order)`, `(type, slug)` (unique, partial), `contenttypes.key` (unique), `media.url` (unique) and `(kind, createdAt)`, `activities.createdAt` (TTL 180 days), `submissions.reference` (unique), `(type, status, createdAt)`, `createdAt`, `name`, `(fingerprint, createdAt)`.
