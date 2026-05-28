# Git AI — AI-Powered Code Review Agent

An autonomous code review agent that analyzes Python repositories using static analysis, LLM-powered review (Google Gemini), security scanning, and optional auto-refactoring — all presented in a GitHub-style dark UI.

---

## What it does

| Capability | Detail |
|---|---|
| **AST Analysis** | Extracts functions, classes, imports, cyclomatic complexity per file |
| **Linting** | Runs Pylint + Flake8 and surfaces issues with severity |
| **Security Scan** | Runs Bandit and maps CWE IDs to vulnerable code |
| **Test Runner** | Runs pytest and reports pass/fail with failure details |
| **LLM Review** | Sends code + tool results to Gemini 2.5 Flash for structured findings |
| **Auto-Refactor** | Applies LLM-suggested fixes, generates unified diffs |
| **Iterative Validation** | Re-runs linters + tests after fixes; loops until clean or max iterations |
| **Code Style Grading** | Scores each file on naming, docs, complexity, line length (A–F) |
| **GitHub PR Creation** | Pushes fixes to a new branch and opens a PR via GitHub API |
| **Patch Download** | Downloads a unified `.patch` file of all changes |

---

## Project structure

```
AI_code_review/
├── backend/
│   └── app/
│       ├── agent/
│       │   ├── classifier.py   # Code style scoring (A-F grades)
│       │   ├── graph.py        # LangGraph workflow definition
│       │   ├── nodes.py        # Individual agent step implementations
│       │   ├── schemas.py      # Pydantic models (ReviewFinding, etc.)
│       │   ├── state.py        # AgentState TypedDict
│       │   └── tools.py        # AST, linter, pytest, Bandit, diff tools
│       ├── config.py           # Settings (API key, storage dir)
│       └── main.py             # FastAPI app with SSE streaming
├── frontend/
│   └── src/
│       ├── App.jsx             # Root component, review orchestration
│       └── components/
│           ├── AgentConsole.jsx    # Live streaming log terminal
│           ├── CodeViewer.jsx      # Syntax-highlighted code with annotations
│           ├── DashboardOverview.jsx  # Metrics, test results, style grades
│           ├── DiffViewer.jsx      # Side-by-side before/after diff
│           ├── FileTree.jsx        # Repository file navigator
│           ├── FindingsPanel.jsx   # Filterable findings table
│           └── SecurityPanel.jsx   # Bandit security findings
├── sandbox/
│   ├── sample.py           # Demo Python file with intentional bugs
│   └── test_sample.py      # Pytest suite (test_divide_by_zero fails by design)
└── requirements.txt
```

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |

A **Google Gemini API key** is required for LLM review. Without it the agent falls back to rule-based mock findings.
Get one free at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd AI_code_review
```

### 2. Backend

```bash
# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Create the environment file
cp .env.example .env               # or create .env manually
```

Add your Gemini key to `.env`:

```env
GEMINI_API_KEY=AIza...
```

### 3. Frontend

```bash
cd frontend
npm install
```

---

## Running the project

You need two terminals — one for the backend, one for the frontend.

### Terminal 1 — Backend (FastAPI)

```bash
# From the project root, with .venv active
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

### Terminal 2 — Frontend (Vite dev server)

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Using the UI

### Sandbox demo (quickest start)

1. Click **Use Sandbox Demo** in the sidebar — this pre-selects the built-in `sandbox/` directory which contains a Python file with intentional bugs.
2. Optionally paste your Gemini API key in the **Gemini API Key** field.
3. Toggle **Auto-refactor** on if you want the agent to apply fixes automatically.
4. Click **Run Code Review**.

The Agent Console streams live logs as the agent works through its pipeline:
`Ingest → Static Analysis → LLM Review → Apply Fixes → Validate`

### Reviewing a GitHub / local repository

- Paste a GitHub URL (`https://github.com/owner/repo`) or an absolute local path into **Repository URL**.
- Click **Run Code Review**.

### Reading results

| Tab | What it shows |
|---|---|
| **Overview** | Summary cards (findings count, test pass rate, validation status), code style grades per file |
| **Findings** | All LLM + linter findings, filterable by severity; click **View** to jump to the line in the Code tab |
| **Security** | Bandit findings grouped by severity (HIGH / MEDIUM / LOW) with CWE IDs |
| **Code** | Syntax-highlighted source with inline finding annotations; click **View diff** on a finding to see the suggested fix |
| **Diff** | Side-by-side before/after diff for the selected finding |

### Downloading fixes

After a review with **Auto-refactor** enabled:

- **Download Patch (.patch)** — downloads a unified diff of all changes as a `.patch` file.
- **Create GitHub PR** — provide a GitHub personal access token (repo scope) and the agent pushes the fixes to a new branch and opens a PR.

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/review` | Start a review. Body: `{ repo_url, auto_fix, max_iterations }`. Header: `X-Gemini-API-Key`. |
| `GET` | `/api/review/status/{task_id}` | Poll task status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`). |
| `GET` | `/api/review/stream/{task_id}` | Server-Sent Events stream of live log messages. |
| `GET` | `/api/review/result/{task_id}` | Full result JSON once completed. |
| `GET` | `/api/review/patches/{task_id}` | Unified diff patches (requires `auto_fix=true`). |
| `GET` | `/api/file?path=&task_id=` | Raw content of a file in the analyzed repo. |
| `POST` | `/api/review/create-pr/{task_id}` | Create a GitHub PR. Body: `{ github_token }`. |

---

## Configuration

### Environment variables (`.env`)

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | No* | Google Gemini API key. Can also be supplied per-request via the UI or `X-Gemini-API-Key` header. *Without it, falls back to mock findings. |
| `GITHUB_TOKEN` | No | Default GitHub token for PR creation. Can be supplied per-request via the UI. |

### Review parameters

| Parameter | Default | Description |
|---|---|---|
| `auto_fix` | `false` | Whether to apply LLM-suggested refactoring |
| `max_iterations` | `2` | Maximum fix-validate loops before stopping |

---

## How the agent pipeline works

```
┌─────────┐    ┌─────────┐    ┌────────────┐    ┌──────────┐    ┌──────────┐
│  Ingest  │───▶│ Analyze  │───▶│ LLM Review │───▶│  Refactor│───▶│ Validate │
│ (clone / │    │ AST +    │    │  (Gemini)  │    │ (apply   │    │ (re-lint │
│  copy)   │    │ lint +   │    │            │    │  fixes)  │    │  + test) │
└─────────┘    │ test +   │    └────────────┘    └──────────┘    └────┬─────┘
               │ bandit + │                                           │
               │ style    │                          loop if still    │
               └─────────┘                          failing ◀────────┘
```

1. **Ingest** — clones a remote git URL or copies a local directory into `workspace_storage/`.
2. **Static Analysis** — AST metrics, Pylint, Flake8, pytest, Bandit, style grades.
3. **LLM Review** — feeds all tool output to Gemini, receives structured JSON findings.
4. **Apply Fixes** — patches files using `code_snippet → refactored_code` replacement, generates unified diffs.
5. **Validate** — re-runs linters and tests; if still failing and under `max_iterations`, loops back to step 3.

---

## Troubleshooting

**Backend shows "Backend offline"**  
Make sure `uvicorn` is running on port 8000. Check for import errors on startup — a missing package will prevent the server from starting.

**"GEMINI_API_KEY missing — using rule-based mock findings"**  
Add your key to `.env` or paste it into the Gemini API Key field in the UI before running.

**Pylint / Flake8 / Bandit not found**  
Ensure you installed requirements inside your virtual environment and that the venv is active when you start uvicorn.

**`ModuleNotFoundError: No module named 'backend'`**  
Run uvicorn from the project root (`AI_code_review/`), not from inside `backend/`.

**GitHub PR creation fails with 422**  
The branch already exists from a previous run. Delete it on GitHub or the API will handle it gracefully on the next attempt.
