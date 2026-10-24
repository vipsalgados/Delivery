---
name: github
description: >-
  Complete GitHub and Git workflow skill for initializing repositories, staging and committing changes,
  managing branches and remotes, pushing/pulling over HTTPS, deploying to GitHub Pages, and managing
  Pull Requests, Issues, Releases, and GitHub Actions via Git and the GitHub CLI (gh). Activate this
  skill whenever the user mentions GitHub, git, commits, branches, pull requests, issues, pushing code,
  cloning repositories, or deploying to GitHub Pages.
---

# GitHub & Git Skill

This skill provides the standard procedures and helper tools for interacting with **Git** and **GitHub** across any project, including repository initialization, commits, branch management, Pull Requests, Issues, GitHub Actions, and GitHub Pages deployment.

---

## 1. Core Principles & Environment Rules

1. **Protocol**: Always use **HTTPS** (`https://github.com/<org>/<repo>.git`) for Git remotes. Do not use SSH URLs unless explicitly configured and requested by the user.
2. **GitHub CLI (`gh`)**:
   - When using `gh` commands, always specify `-R <owner>/<repo>` when operating on a repository explicitly.
   - If `gh` is not installed on Windows, you can install it via `winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements` or use standard `git` commands.
   - Note that `gh.exe` on Windows is typically installed at `C:\Program Files\GitHub CLI\gh.exe`.
3. **Safety First**:
   - Before committing, always run `git status --short` and check `.gitignore` so sensitive files (`.env`, private keys, credentials, `node_modules/`, `__pycache__/`, `.zip` backups) are never committed accidentally.
   - Never run destructive commands (`git push --force`, `git reset --hard`, `git branch -D`) without explicit user confirmation.

---

## 2. Standard Workflows

### A. Initializing & Publishing a Project to GitHub

1. **Verify `.gitignore`**:
   Ensure a `.gitignore` exists at the project root covering OS/editor files, build artifacts, caches, and secrets.
2. **Initialize Repository**:
   ```powershell
   git init
   git branch -M main
   ```
3. **Stage and Commit**:
   ```powershell
   git add .
   git status --short
   git commit -m "feat: initial project commit"
   ```
4. **Configure Remote & Push**:
   - Check existing remotes with `git remote -v`.
   - To add or update `origin`:
     ```powershell
     git remote add origin https://github.com/<owner>/<repo>.git
     # Or if origin already exists:
     git remote set-url origin https://github.com/<owner>/<repo>.git
     ```
   - Push to `main`:
     ```powershell
     git push -u origin main
     ```
   - Alternatively, run the bundled helper script:
     [publish_github.ps1](./scripts/publish_github.ps1)
     ```powershell
     powershell -NoProfile -ExecutionPolicy Bypass -File "<path-to-skill>/scripts/publish_github.ps1" -RepoUrl "https://github.com/<owner>/<repo>.git" -CommitMessage "Update project"
     ```

### B. Routine Updates (Stage, Commit, Push)

1. Inspect changes before staging:
   ```powershell
   git status -s
   git diff --stat
   ```
2. Stage and create a clear, descriptive commit message (Conventional Commits preferred: `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`):
   ```powershell
   git add -A
   git commit -m "feat: describe the improvement clearly"
   git push origin main
   ```
3. If the remote has new commits not present locally:
   ```powershell
   git pull --rebase origin main
   git push origin main
   ```

### C. Deploying Static Web Apps & PWAs to GitHub Pages

When preparing a static site or PWA for **GitHub Pages**:
1. Add an empty `.nojekyll` file in the root directory so GitHub Pages does not ignore files/folders starting with underscores (`_`).
2. Use relative asset paths (`./style.css`, `./app.js`, `./manifest.json`) so the site works both at root domains and project subpaths (`https://<user>.github.io/<repo>/`).
3. If using Service Workers (`sw.js`), avoid hardcoded leading slashes (`/index.html`) in cache lists; use `./index.html` instead.
4. To enable GitHub Pages via CLI (when `gh` is authenticated):
   ```powershell
   gh api repos/<owner>/<repo>/pages -X POST -F build_type=legacy -F "source[branch]=main" -F "source[path]=/"
   ```

### D. Pull Requests, Issues & Workflows with `gh`

- **Create a Repository**:
  `gh repo create <owner>/<repo> --public --source=. --remote=origin --push`
- **Create a Pull Request**:
  `gh pr create --title "Title" --body "Description" --base main --head <branch> -R <owner>/<repo>`
- **View / List PRs**:
  `gh pr list -R <owner>/<repo>`
  `gh pr view <number> -R <owner>/<repo>`
- **Create / Manage Issues**:
  `gh issue create --title "Bug report" --body "Details" -R <owner>/<repo>`
  `gh issue list -R <owner>/<repo>`
- **Inspect Workflow Runs**:
  `gh run list -R <owner>/<repo>`
  `gh run view <run-id> -R <owner>/<repo>`

---

## 3. Antigravity Permissioned Environment Guidelines

If a `git` or `gh` command fails due to environment permission restrictions and `ask_custom_permission` is available, request only the minimal required permission using the format `<binary>.<action>(<resource_json>)`:

- **Read/Clone/Fetch Repository**:
  `git.read({"org": "<org>", "repo": "<repo>", "contents": "*"})`
- **Push New Branch**:
  `git.create({"org": "<org>", "repo": "<repo>", "branch": "<branch>"})`
- **Push to Existing Branch**:
  `git.update({"org": "<org>", "repo": "<repo>", "branch": "<branch>"})`
- **Delete Remote Branch**:
  `git.delete({"org": "<org>", "repo": "<repo>", "branch": "<branch>"})`
- **Read / Create / Update / Approve / Merge PRs**:
  `gh.read({"org": "<org>", "repo": "<repo>", "pr": "*"})`
  `gh.create({"org": "<org>", "repo": "<repo>", "pr": "*"})`
  `gh.update({"org": "<org>", "repo": "<repo>", "pr": "<number>"})`
  `gh.approve({"org": "<org>", "repo": "<repo>", "pr": "<number>"})`
  `gh.merge({"org": "<org>", "repo": "<repo>", "pr": "<number>"})`
- **Read / Create / Update Issues**:
  `gh.read({"org": "<org>", "repo": "<repo>", "issue": "*"})`
  `gh.create({"org": "<org>", "repo": "<repo>", "issue": "*"})`
  `gh.update({"org": "<org>", "repo": "<repo>", "issue": "<number>"})`
- **Workflows**:
  `workflow.read({"org": "<org>", "repo": "<repo>", "path": "*", "ref": "*"})`
  `workflow.dispatch({"org": "<org>", "repo": "<repo>", "path": "<file.yml>", "ref": "<branch>"})`
