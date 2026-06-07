# Evalora

<p align="center">
  <img src="recruiter/static/recruiter/assets/evalora-logo-transparent.png" alt="Evalora" width="340" />
</p>

<p align="center">
  <strong>Intelligence Behind Every Hire</strong>
</p>

<p align="center">
  <a href="https://github.com/yuvrajjitbaruah/Evalora"><img alt="GitHub repo" src="https://img.shields.io/badge/GitHub-Evalora-111827?style=for-the-badge&logo=github" /></a>
  <img alt="Django" src="https://img.shields.io/badge/Django-5.x-0C4B33?style=for-the-badge&logo=django" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img alt="Gemini" src="https://img.shields.io/badge/Gemini-ready-FF2F67?style=for-the-badge" />
  <img alt="Sarvam" src="https://img.shields.io/badge/Sarvam-ready-1D97BA?style=for-the-badge" />
</p>

Evalora is a recruiter-grade candidate ranking and ATS intelligence platform built for the **India Runs Data and AI Challenge - Track 1 Candidate Discovery**. It ranks candidates for the released Senior AI Engineer founding-team role using career evidence, semantic fit, behavioral readiness, logistics, and risk controls instead of shallow keyword matching.

Built by **Yuvrajjit Baruah** using Python, Django, JavaScript, deterministic hybrid ranking, Gemini, Sarvam, ATS intelligence, and careful UI craft.

## Preview

![Evalora dashboard preview](docs/screenshots/evalora-dashboard.png)

## What Evalora Does

- Reads a job description and converts it into recruiter-facing evidence requirements.
- Scores candidates using a deterministic hybrid ranker across skills, career history, behavior, logistics, and risk signals.
- Produces a trusted top-100 shortlist in the required CSV format.
- Gives recruiters a polished dashboard for shortlist review, candidate comparison, saved decisions, and workflow tracking.
- Provides an ATS Analyzer for resume/CV review against the target role.
- Provides an AI Copilot for recruiter briefs, interview kits, risk audits, outreach drafts, scorecards, and calibration notes.
- Uses Gemini and Sarvam when API keys are configured, with deterministic local fallback when cloud AI is unavailable.

## Repository Structure

```text
Evalora/
  evalora_project/                 Django project settings and URL root
  recruiter/                       Django app, API views, AI services, templates, static UI
  src/ranker/                      Deterministic Node.js ranking and CSV validation engine
  public/data/                     Generated public dashboard data
  public/js/                       Standalone ranking core used by the static preview
  outputs/                         Submission CSV files
  docs/                            Methodology, deck export, and README screenshots
  data/README.md                   Dataset placement instructions
  manage.py                        Django entry point
  requirements.txt                 Python dependencies
  package.json                     Node scripts for ranking and validation
```

## Feature Map

| Area | Capability |
| --- | --- |
| Ranking engine | Streams the candidate pool and ranks candidates deterministically without per-candidate hosted model calls. |
| Shortlist console | Search, filters, table/card views, component scores, fit tags, risk notes, comparison, and decision workflow. |
| ATS Analyzer | Reviews pasted resume text or uploaded TXT, DOCX, and readable PDF files against the role. |
| AI Copilot | Generates recruiter briefs, interview plans, scorecards, risk audits, outreach drafts, Boolean queries, and calibration notes. |
| AI providers | Auto-routes to Gemini or Sarvam when configured, with safe local fallback. |
| Submission outputs | Includes `outputs/evalora_submission.csv` and `outputs/evalora_sample_submission.csv`. |
| Security posture | Keeps `.env.local`, databases, virtualenvs, raw datasets, and local junk out of GitHub. |

## Requirements

Install these before running the project:

- Python 3.12 or newer
- Node.js 20 or newer
- Git
- A modern browser

Node.js is only required for regenerating the ranking CSV. The Django dashboard itself runs from Python.

## Local Installation - Windows PowerShell

Open PowerShell inside the project folder:

```powershell
cd C:\Users\lenovo\Documents\Evalora
```

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install Python dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create your local environment file:

```powershell
copy .env.example .env.local
```

Run Django setup:

```powershell
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Open the app:

```text
http://127.0.0.1:8000
```

## Local Installation - macOS or Linux

```bash
cd Evalora
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env.local
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Open:

```text
http://127.0.0.1:8000
```

## AI Setup

Evalora reads local secrets from `.env.local`. Never commit real API keys.

```text
DJANGO_SECRET_KEY=replace_with_a_local_django_secret
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,testserver
GOOGLE_AI_API_KEY=your_google_ai_key_here
GEMINI_API_KEY=your_google_ai_key_here
SARVAM_API_KEY=your_sarvam_ai_key_here
GEMINI_MODEL=gemini-2.5-flash
SARVAM_MODEL=sarvam-30b
AI_REQUEST_TIMEOUT_SECONDS=20
```

Provider behavior:

- `auto` chooses the best configured cloud provider.
- `gemini` forces Gemini when a Google AI key is available.
- `sarvam` forces Sarvam when a Sarvam key is available.
- If a provider is missing, rate-limited, or unreachable, Evalora returns a deterministic local result with a visible warning instead of breaking the workflow.

## Dataset Placement

The released hackathon dataset should not be committed to GitHub. Download/extract it locally into:

```text
data/raw/India_runs_data_and_ai_challenge/
```

Expected files:

```text
candidates.jsonl
sample_candidates.json
candidate_schema.json
job_description.docx
submission_spec.docx
redrob_signals_doc.docx
```

The cleaned upload folder intentionally excludes `data/raw/`.

## Reproduce the Ranking Output

Install Node dependencies only if you add new Node packages. The current ranker uses built-in Node APIs.

Run the full ranking pipeline after placing the raw dataset:

```powershell
npm run rank
```

This writes:

```text
outputs/evalora_submission.csv
public/data/top_candidates.json
public/data/score_report.json
```

Run the sample pipeline:

```powershell
npm run rank:sample
```

Validate the final CSV:

```powershell
npm run validate
```

The validator checks the required header, row count, rank order, score ordering, candidate uniqueness, candidate existence, and reasoning text.

## Django API Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Evalora dashboard |
| `/api/candidates/` | GET | Ranked top-candidate payload |
| `/api/report/` | GET | Score report and model summary |
| `/api/sample/` | GET | Bundled sample candidates |
| `/api/rank-sample/` | POST | Rank an uploaded small JSON/JSONL sample |
| `/api/ai/status/` | GET | Gemini/Sarvam configuration status |
| `/api/ai/candidate-action/` | POST | AI Copilot recruiter action |
| `/api/ats/analyze/` | POST | ATS resume/CV analysis |
| `/download/submission/` | GET | Download ranked CSV |

## Upload to GitHub - Website Method

Use this if you want the simplest direct upload.

1. Go to [github.com](https://github.com) and sign in.
2. Click **New repository**.
3. Repository name: `Evalora`.
4. Description: `Recruiter-grade AI candidate ranking and ATS intelligence platform for India Runs.`
5. Choose **Public** or **Private**.
6. Do not add a README, license, or `.gitignore` on GitHub because this folder already has them.
7. Create the repository.
8. Open the new repository page.
9. Click **uploading an existing file**.
10. Drag and drop the contents of `C:\Users\lenovo\Documents\Evalora`.
11. Confirm these are not included: `.env.local`, `.env`, `.venv`, `db.sqlite3`, `data/raw`.
12. Commit the upload with this message:

```text
Initial Evalora hackathon submission
```

## Upload to GitHub - Git Command Method

Use this if you prefer PowerShell and Git.

From the project root:

```powershell
cd C:\Users\lenovo\Documents\Evalora
git init
git add .
git commit -m "Initial Evalora hackathon submission"
git branch -M main
git remote add origin https://github.com/yuvrajjitbaruah/Evalora.git
git push -u origin main
```

If GitHub says the repository already has commits, use:

```powershell
git pull origin main --allow-unrelated-histories
git push -u origin main
```

If authentication opens a browser, complete the GitHub login and rerun the push if needed.

## What Not to Upload

These files are intentionally excluded by `.gitignore`:

```text
.env
.env.local
.env.*
.venv/
db.sqlite3
staticfiles/
__pycache__/
*.pyc
node_modules/
data/raw/India_runs_data_and_ai_challenge/
outputs/*.png
outputs/*.jpg
outputs/*.tmp
outputs/*.log
```

Keep real API keys only in `.env.local`.

## Production Notes

For a real hosted deployment:

- Set `DJANGO_DEBUG=0`.
- Use a strong `DJANGO_SECRET_KEY`.
- Set `DJANGO_ALLOWED_HOSTS` to the deployed domain only.
- Store API keys in the hosting provider secret manager.
- Run `python manage.py collectstatic` if your platform requires collected static files.
- Use a production database if saved recruiter decisions become server-side data.

## Troubleshooting

### `python` is not recognized

Install Python 3.12+ and reopen the terminal. On Windows, try:

```powershell
py -3 -m venv .venv
```

### PowerShell blocks virtualenv activation

Run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

### AI shows local fallback

Check `.env.local` and verify:

- `GOOGLE_AI_API_KEY` or `GEMINI_API_KEY` is present for Gemini.
- `SARVAM_API_KEY` is present for Sarvam.
- The server was restarted after editing `.env.local`.
- Internet access is available from the machine running Django.

### PDF resume extraction is weak

Some PDFs are scanned images and do not contain selectable text. Use a DOCX/TXT resume or paste extracted resume text into the ATS Analyzer.

### `npm run validate` cannot find candidates

Place the released challenge dataset under:

```text
data/raw/India_runs_data_and_ai_challenge/
```

Then rerun:

```powershell
npm run validate
```

## Submission Checklist

- `outputs/evalora_submission.csv` exists.
- CSV validates with `npm run validate`.
- README screenshot is present at `docs/screenshots/evalora-dashboard.png`.
- `.env.local`, `.venv`, `db.sqlite3`, and `data/raw` are not uploaded.
- GitHub repository is available at `https://github.com/yuvrajjitbaruah/Evalora`.
- Deck PDF is prepared separately if required by the hackathon portal.
- `submission_metadata.yaml` is reviewed before final submission.

## Links

- GitHub: <https://github.com/yuvrajjitbaruah/Evalora>
- LinkedIn: <https://www.linkedin.com/in/yuvrajjitbaruah>
- Feedback or suggestions: <dev.yuvrajjitbaruah@gmail.com>

## License

This project is prepared for hackathon submission and portfolio review. Add a formal license file before wider reuse.
