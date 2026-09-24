# ResumeScreen AI

A self-hosted HR tool that helps HR staff review resumes consistently. HR defines a job profile and screening criteria, uploads resumes, and Claude returns a structured, evidence-based assessment of how each resume aligns with those criteria. **HR reviews the evidence and makes every decision** — the app never labels anyone hired or rejected.

Every AI result separates what the resume **states** from what Claude **inferred**, what is **missing**, and what **needs human verification**.

---

## Contents

1. [Quick start (local)](#quick-start-local)
2. [Step-by-step user guide](#step-by-step-user-guide)
3. [Deploy on AWS EC2 with Docker](#deploy-on-aws-ec2-with-docker)
4. [Configuration](#configuration)
5. [Adding the Claude API key](#adding-the-claude-api-key)
6. [How it works](#how-it-works)
7. [Project structure](#project-structure)
8. [Data, backups and deletion](#data-backups-and-deletion)
9. [Security and privacy](#security-and-privacy)
10. [Testing](#testing)
11. [Design decisions](#design-decisions)
12. [Known limitations](#known-limitations)

---

## Quick start (local)

Requires **Node.js 24+** (uses the built-in `node:sqlite`, so there are no native modules to compile).

```bash
npm install
cp .env.example .env        # optionally add ANTHROPIC_API_KEY
npm run dev                 # UI on http://localhost:5173, API on :8080
```

Open http://localhost:5173 and click **Load demo data** to explore with sample job profiles, candidates, screening results and HR notes (all fictional and labelled *Demo data*).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development: Vite UI with hot reload + API server with auto-restart |
| `npm run build` | Production build → `dist/client` (UI) and `dist/server` (API) |
| `npm start` | Runs the production build on `PORT` (default 8080). Requires `APP_PASSWORD` or `ALLOW_UNAUTHENTICATED=true` |
| `npm run check` | Typecheck + lint + tests |
| `npm run test:live` | Checks that the Claude API accepts every output schema, for each selectable model (uses your key, costs a negligible amount) |
| `./start-local.sh` | Starts the production build locally on http://localhost:8080 |
| `npm run backup` | Online backup of the database (see [Backups](#data-backups-and-deletion)) |

---

## Step-by-step user guide

1. **Connect Claude (once).** Go to **Settings → Claude API**, paste your API key and click **Save**. If your key isn't tied to a workspace, also enter the **Workspace ID** (`wrkspc_…`, from the Claude Console under Settings → Workspaces). Click **Test connection** and look for a green "Connected".
2. **Create a job profile.** **Job Profiles → New job profile**. Enter the job title, then click **Upload job description** to import a JD file (PDF, DOCX, TXT or a scan), or paste the description.
3. **Build the criteria.** Click **Draft criteria with Claude**, tick the suggestions you want and click **Add**. Or fill in the qualification fields and click **Generate from qualifications**, or add rows by hand. Set each criterion's importance (*Required / Important / Preferred*), review the wording and click **Save profile**.
4. **Upload resumes.** **Candidates → Upload resumes**. Optionally choose the job profile, then drag in PDF, DOCX, TXT, JPG or PNG files. Scanned files are read with OCR automatically (marked *Extracted (OCR)*). Click **View text** to check the result.
   - If a file shows *Failed* or the OCR text is poor, click **Read with Claude**, **Retry** with a better copy, or **Paste text**.
5. **Run the screening.** Click **Screen candidates** (or go to **Screening**). Check the job profile, job description, criteria and redaction settings, then click **Run Screening**. The first time, confirm the privacy notice. Progress appears step by step, and you can cancel at any time.
6. **Review the evidence.** Open a candidate's **Screening report**. Expand each criterion to see the resume evidence and source, then read **Information not found** and **Requires human verification**.
7. **Record the HR decision.** Go to the **HR review** tab, enter your name, notes, follow-up questions and a decision, and click **Save HR review**. This is your decision, stored separately from the AI assessment.
8. **Compare and report.** Tick 2–5 candidates on **Candidates → Compare** for a side-by-side view. Use **Reports** to export PDF, CSV or JSON.
9. **Clean up.** Delete a candidate from their page, or everything from **Settings → Data management**.

---

## Deploy on AWS EC2 with Docker

The image contains the built UI and API in one container, runs as a non-root user, stores all data in the `/app/data` volume, and has a health check on `/api/health`.

### 1. Launch the instance

- **AMI:** Amazon Linux 2023 (x86_64 or Graviton/arm64 — both work).
- **Size:** `t3.small` (2 GB RAM) or larger. Screening work happens at Anthropic, so the server itself is light.
- **Storage:** 20 GB gp3 is plenty.
- **Security group:** allow **22** (SSH) from your IP only. Allow **80** — and **443** if you use HTTPS — **only from your office/VPN IP ranges**. This is an internal HR tool; do not open it to `0.0.0.0/0` unless you have a reason to.
- The instance needs outbound HTTPS to `api.anthropic.com`.

### 2. Install Docker

```bash
ssh ec2-user@<instance-ip>
```

Copy the project to the instance (for example `scp -r resumescreen-ai ec2-user@<ip>:~` or `git clone` your repository), then:

```bash
cd resumescreen-ai
bash deploy/ec2-setup.sh
```

Log out and back in so your user can run `docker` without `sudo`. (On Ubuntu, install Docker with `curl -fsSL https://get.docker.com | sh` instead.)

### 3. Configure

```bash
cp .env.example .env
nano .env
```

At minimum set:

```dotenv
APP_PASSWORD=<a long passphrase your HR team will use to sign in>
ANTHROPIC_API_KEY=sk-ant-...        # or leave empty and add it later in Settings
```

```bash
chmod 600 .env
```

### 4a. Start — plain HTTP (quickest, for a private network/VPN)

```bash
docker compose up -d --build
docker compose ps           # STATUS should become "healthy"
```

Open `http://<instance-ip>/`.

### 4b. Start — HTTPS with automatic certificates (recommended)

Point a DNS name (e.g. `screening.yourcompany.com`) at the instance's Elastic IP, open ports 80 and 443 in the security group, then set in `.env`:

```dotenv
DOMAIN=screening.yourcompany.com
COOKIE_SECURE=true
APP_BIND=127.0.0.1
APP_PORT=8080
```

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Caddy obtains and renews a Let's Encrypt certificate automatically. If you already use an AWS Application Load Balancer with an ACM certificate, skip Caddy: keep 4a, set `COOKIE_SECURE=true`, and point the ALB target group at port 80 with health check path `/api/health` (set the ALB idle timeout to at least 300 s, because screenings stream for up to a few minutes).

### Build elsewhere and push to ECR (optional)

If you prefer not to build on the instance:

```bash
aws ecr create-repository --repository-name resumescreen-ai
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
# Build for the instance's CPU: linux/amd64 for t3/m6i, linux/arm64 for Graviton (t4g/m7g)
docker buildx build --platform linux/amd64 -t <account>.dkr.ecr.<region>.amazonaws.com/resumescreen-ai:1.0.0 --push .
```

On the instance, replace `build: .` in `docker-compose.yml` with that `image:` reference and run `docker compose pull && docker compose up -d`.

### Operating it

```bash
docker compose logs -f app          # logs (never contain resume content)
docker compose restart app
git pull && docker compose up -d --build   # upgrade; data in the volume is kept
bash deploy/backup.sh               # consistent backup to ./backups/
```

---

## Configuration

All configuration is via environment variables (`.env`). Nothing secret is compiled into the UI.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | – | Claude API key. If set, it overrides a key saved in Settings and locks that field. |
| `ANTHROPIC_WORKSPACE_ID` | – | Only for API keys that are not scoped to a workspace: sent as the `anthropic-workspace-id` header. Can also be set in Settings. |
| `CLAUDE_MODEL` | `claude-opus-5` | Default model (changeable in Settings). |
| `APP_PASSWORD` | – | Shared sign-in password. **Required in production** unless `ALLOW_UNAUTHENTICATED=true`. |
| `SESSION_SECRET` | auto | Cookie-signing secret. Auto-generated and saved to `DATA_DIR/secrets.json` if empty. |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS (also enables HSTS). |
| `ALLOW_UNAUTHENTICATED` | `false` | Only for a truly isolated machine. |
| `PORT` | `8080` | Port inside the container / for `npm start`. |
| `DATA_DIR` | `./data` | Database and secrets location (`/app/data` in Docker). |
| `MAX_UPLOAD_MB` | `10` | Maximum resume file size. |
| `CLAUDE_REFUSAL_FALLBACKS` | `true` | Server-side refusal fallbacks for Claude Opus 5 (see below). |
| `APP_BIND` / `APP_PORT` | `0.0.0.0` / `80` | Docker Compose host binding. |
| `DOMAIN` | – | Hostname for the optional Caddy HTTPS proxy. |

In-app **Settings** control the model, maximum tokens, effort, theme, redaction, privacy notice and export options.

---

## Adding the Claude API key

Create a key in the [Claude Console](https://platform.claude.com/). Then either:

- **Environment (recommended for servers):** put `ANTHROPIC_API_KEY=sk-ant-...` in `.env` and restart (`docker compose up -d`). The Settings page shows it as "Set by server environment".
- **Settings page:** an HR admin pastes the key under **Settings → Claude API → Save**. It is written to `DATA_DIR/secrets.json` (file mode 600) on the server.

Either way the key never reaches the browser — the UI only ever sees a masked form such as `sk-ant-…a1B2`. Use **Test connection** to check the key and model (no candidate data is sent).

If Test connection reports that the key "is not tied to a Claude workspace", enter the workspace's ID (`wrkspc_…`, found in the Claude Console under **Settings → Workspaces**) in the **Workspace ID** field, or set `ANTHROPIC_WORKSPACE_ID`. Alternatively, create a new key from inside a workspace.

---

## How it works

```
Browser (React UI)
   │  fetch /api/*   (session cookie)
   ▼
Express server ── routes/ (HTTP, validation, audit log)
   │
   ├─ services/resumeParser.ts      PDF / DOCX / TXT → text + contact details (local)
   ├─ services/redaction.ts         removes name / contact details before sending
   ├─ services/claude/screeningService.ts   screenCandidate(): prompt → Claude → validate
   │     ├─ prompts/screenCandidate.ts       versioned system prompt + prompt builder
   │     ├─ schemas.ts                       JSON schema for structured output + validation
   │     └─ claudeClient.ts                  Anthropic SDK, error mapping
   └─ db.ts                          SQLite (node:sqlite) in DATA_DIR
```

### Resume extraction

Files are uploaded one at a time to the server, processed **in memory** and **not stored** — only the extracted text is kept.

- **PDF** — text layer extracted with `unpdf` (PDF.js). If a PDF has no usable text layer (a scan), its pages are rendered and read with **local OCR** (Tesseract, English model bundled, first 6 pages). Nothing leaves the server.
- **JPG / PNG** — photos or scans of resumes, read with local OCR.
- **Read with Claude** — for scans OCR can't read well, HR can explicitly send the original file to Claude to transcribe it. A confirmation dialog explains what is sent, and each use is recorded in the audit log.
- **DOCX** — `mammoth` raw-text extraction. Legacy `.doc` is rejected with a clear message.
- **TXT** — UTF-8 (falls back to Latin-1).
- File type is checked by extension **and** file signature.
- Name, email, phone, location and LinkedIn/GitHub/portfolio links are detected with local heuristics. HR can correct them on the candidate page.
- If extraction fails, the candidate is still created so HR can **retry** with another file, **Read with Claude**, or **paste the text** manually. Extracted text is viewable (and editable) before screening, and OCR results are flagged for a check.

### Job descriptions

In the job profile editor, **Upload job description** imports a JD file (PDF, DOCX, TXT or scan) into the description, using the same local extraction. **Draft criteria with Claude** sends only the job description (never candidate data) to Claude. Claude suggests the qualification fields and 5–12 screening criteria with an importance level each; HR picks which to add and reviews them before saving. The job description is part of every screening request, and the Screening page shows it (with an upload/replace button) next to the criteria.

### Claude screening

1. HR selects a job profile and candidates and reviews the **screening configuration**: required / important / preferred criteria, model, prompt version, redaction, and the full standard instructions (viewable in the UI).
2. Before the first screening a **privacy notice** explains what is sent. The UI states plainly, next to the Run button, that resume text is sent to the Claude API.
3. The server builds the request from the versioned system prompt (`server/services/claude/prompts/screenCandidate.ts`), the job profile, the grouped criteria and the (redacted) resume text, which is marked as untrusted data so instructions hidden in a resume are ignored.
4. The screening is made of **two requests that run in parallel** with the same (cached) instructions: one extracts the candidate profile, the other assesses the criteria. The Claude API limits how complex one strict output schema can be, and a single combined schema exceeds that limit. Both use **structured outputs** (`output_config.format` with strict JSON schemas generated from `shared/screeningSchema.ts`), adaptive thinking and the configured effort, and are streamed. If a model ever rejects a schema as too complex, the app retries once with the schema in the prompt instead and still validates the result strictly. Progress steps in the UI are driven by which part of the JSON Claude is currently writing — they reflect real progress, not a timer.
5. The response is validated against the same Zod schema, and the server checks that every configured criterion was assessed exactly once. **Anything malformed or incomplete is rejected and nothing is displayed.** Refusals, truncated output, auth errors, rate limits, timeouts, overload and network failures are each mapped to a plain-language message ("…Your candidate information has not been deleted.").
6. The result is stored as a new history entry together with a snapshot of the job profile, the model, the prompt version, the redaction settings and token usage.

For `claude-opus-5`, requests enable the API's server-side **refusal fallbacks** (`fallbacks: "default"`), so a request declined by a safety classifier can be completed by a fallback model instead of failing. Set `CLAUDE_REFUSAL_FALLBACKS=false` to turn this off.

Every criterion result contains the status (`meets`, `partially_meets`, `does_not_meet`, `unclear`, `not_found`), the evidence and its resume section, whether the evidence is *stated*, *inferred* or *absent*, a confidence level, and a verification flag with a reason. The overall label is one of **Strong Alignment**, **Moderate Alignment**, **Limited Alignment** or **Insufficient Information**. It describes resume-to-criteria alignment, not suitability for hire.

### HR review

The HR review panel (reviewer, status, notes, follow-up questions, verification required, and a decision of *Continue Review / Request More Information / Hold for Review / Not Progressing*) is stored separately from the AI output and is always labelled *Human-entered*.

### Reports and exports

The Reports page produces a **candidate screening report**, a **job screening summary** (alphabetical, not ranked) and a **screening activity report** (screenings + audit log for a date range), each as PDF, CSV or JSON. Exports are generated in the browser. Each one tags AI-generated content separately from HR-entered content, and CSV cells are protected against spreadsheet formula injection.

---

## Project structure

```
├── Dockerfile, docker-compose.yml, docker-compose.https.yml, .dockerignore
├── deploy/                  EC2 setup script, Caddyfile, backup script
├── shared/                  Types and schema used by both server and UI
│   ├── types.ts             Domain types (JobProfile, Candidate, ScreeningRecord, …)
│   ├── screeningSchema.ts   Zod schema for Claude's structured output
│   ├── screeningUtils.ts    Summaries, "needs review" rule
│   └── sensitiveTerms.ts    Warns when criteria reference protected characteristics
├── server/
│   ├── index.ts / app.ts    Startup, security headers, routing, static UI
│   ├── config.ts            Environment + server-side secrets file
│   ├── auth.ts              Shared-password sign-in, signed session cookie
│   ├── db.ts                SQLite store (job profiles, candidates, screenings, audit, settings)
│   ├── routes/              jobProfiles, candidates, screenings (streaming), settings, system
│   ├── services/resumeParser.ts, redaction.ts
│   ├── services/claude/     claudeClient.ts, screeningService.ts, schemas.ts, prompts/screenCandidate.ts
│   ├── demo/demoData.ts     Demo job profiles, candidates, screenings, HR notes
│   └── backup.ts            Online database backup
├── src/                     React UI
│   ├── api/client.ts        Typed API client + streaming screening client
│   ├── pages/               Dashboard, JobProfiles, JobProfileEditor, Candidates, Upload,
│   │                        CandidateDetail, Screening, Compare, Reports, Settings, Login
│   ├── components/ui/       Button, Badge, Card, Modal, ConfirmDialog, Tabs, form controls, states
│   ├── components/…         Screening report, criteria editor, HR review panel, tables
│   ├── context/             App settings/theme, toasts
│   └── utils/export.ts      PDF / CSV / JSON report builders
└── tests/                   Vitest suites
```

The Claude layer lives under `server/services/claude/` rather than `src/services/claude/` because the API key must stay on the server; the UI talks only to the local API.

---

## Data, backups and deletion

- **Where:** one SQLite file, `DATA_DIR/resumescreen.db` (Docker volume `resumescreen-data`, mounted at `/app/data`). The Settings page shows the path and size.
- **What:** job profiles, candidates (contact details + resume text), every screening result (append-only history), HR reviews, the audit log and settings. Uploaded files themselves are not kept.
- **History:** re-running a screening adds a new entry. Earlier results remain viewable from *Candidate → Screening history* or *Reports*.
- **Backups:** `bash deploy/backup.sh` (Docker) or `npm run backup` creates a consistent copy while the app runs. Store backups encrypted; they contain personal data. To restore, stop the app and copy the backup over `/app/data/resumescreen.db`.
- **Delete one candidate:** *Candidate → Delete* (or select several on the Candidates page). Removes their resume text, details, all screenings and HR notes.
- **Delete demo data:** *Settings → Data management → Delete demo data*.
- **Delete all local data:** *Settings → Data management → Delete all data* (type `DELETE` to confirm; optionally also reset settings and remove the saved API key).
- **Wipe completely (Docker):** `docker compose down -v` deletes the container **and** the data volume.

---

## Security and privacy

- **API key** is held only on the server (environment or `secrets.json`, mode 600) and never returned to the browser or written to logs.
- **Access control:** production refuses to start without `APP_PASSWORD`. Sessions are HMAC-signed, `HttpOnly`, `SameSite=Strict` cookies (12 h). Sign-in attempts are rate-limited. Use HTTPS (`COOKIE_SECURE=true`) and restrict the security group to trusted networks. For larger teams, put the app behind your SSO / identity-aware proxy (e.g. ALB + Cognito/OIDC).
- **Data minimisation:** candidate data leaves the server **only** when HR clicks *Run Screening*, and only to the Claude API. By default the candidate's name and contact details are redacted before sending (Settings → Privacy).
- **Logging:** logs contain ids, counts, durations and error codes only — never resume text or personal details. The audit log records who reviewed what and when, and when data was sent to Claude, without resume content.
- **Fairness:** the system prompt forbids inferring or using protected characteristics (age, race, ethnicity, religion, disability, health, pregnancy, marital status, gender identity, sexual orientation, political affiliation, …) or proxies for them. The job profile editor warns when a criterion looks like one. The overall label is alignment-only and there is no automatic ranking.
- **Prompt injection:** resume text is treated as untrusted data; embedded instructions are ignored and noted in *Limitations*.
- **Headers:** Helmet with a strict Content-Security-Policy (no third-party scripts, fonts or trackers — the UI works fully offline apart from Claude calls), `X-Frame-Options`, HSTS when HTTPS is on.
- **Compliance:** automated processing of applicant data may be regulated where you operate (e.g. GDPR Art. 22, NYC Local Law 144, the EU AI Act). Review with your legal/privacy team, update your candidate privacy notice, and keep humans responsible for decisions.

---

## Testing

```bash
npm run check      # tsc (UI + server), ESLint, Vitest
```

The suite (45 tests) covers: OCR of scanned PDFs and PNGs, scanned-PDF upload through the API, job description import, partial candidate updates keeping existing fields; schema validation of Claude output, including malformed JSON, wrong enum values, missing fields and skipped criteria; the screening service (redaction before sending, ordered progress events, empty-resume guard); Claude error mapping (401/403/404/429/5xx/529, timeout, network, cancel, missing key); PDF/DOCX/TXT extraction and rejection of unsupported, fake and empty files; redaction; the HTTP API against a real SQLite file (CRUD, upload, persistence across restart, failed-extraction recovery, HR review, candidate deletion, delete-all, demo data, key never exposed, clear error without a key); password sign-in and forged-cookie rejection; CSV injection guarding; PDF report content; and the sensitive-criteria detector.

---

## Design decisions

- **Web app + local server instead of a desktop wrapper.** A single Node process serves the UI and holds the API key, which keeps the key out of the browser and lets the same build run on a laptop or an EC2 instance behind Docker. An Electron wrapper can be added later without changing the architecture.
- **SQLite via `node:sqlite`.** One portable file, transactions, no native build step, easy backups. Entities are JSON documents with indexed columns.
- **Server-side extraction.** Keeps parsing libraries out of the browser bundle and applies one set of rules everywhere.
- **Structured outputs + Zod validation.** The API constrains the shape; the app re-validates and checks criteria coverage before storing anything.
- **Real progress via streaming.** Screening progress is streamed as NDJSON; each stage is marked when Claude starts writing the corresponding section of the JSON.
- **Shared password auth.** The simplest control that makes EC2 hosting safe for a small team; SSO can be layered in front.
- **Temperature is shown as unavailable.** Current Claude models don't accept sampling parameters; the **Effort** setting (low/medium/high) controls thoroughness instead.
- **Default model `claude-opus-5`** for the highest-quality screening. Sonnet 5 and Haiku 4.5 are selectable in Settings for faster, cheaper runs.

---

## Known limitations

- **OCR** is English-only and reads the first 6 pages of a scan. Poor-quality scans may contain recognition errors, so check the text or use *Read with Claude*.
- **Contact detection** is heuristic and works best on Latin-script resumes with standard layouts. Check it and edit if needed.
- **PDF exports** use standard PDF fonts, so characters outside Western European scripts are replaced with `?`. Use CSV/JSON for other scripts.
- **Single shared password**, no per-user accounts or roles. The reviewer name on HR reviews is self-entered.
- **Screenings run one at a time** per browser session (a queue). Very large batches take a while and each run costs API usage.
- **No automatic data-retention policy** — use the delete functions or backups/rotation per your retention rules.
- The app has been verified against the live API up to authentication and workspace checks. A full screening run needs a working key (plus Workspace ID if required). After adding them, run one screening on a demo candidate to confirm.
