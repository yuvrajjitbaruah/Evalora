# Data Placement

Place the released India Runs Track 1 bundle here before running the ranker:

```text
data/raw/India_runs_data_and_ai_challenge/
  candidates.jsonl
  sample_candidates.json
  job_description.docx
  submission_spec.docx
  candidate_schema.json
```

The full `candidates.jsonl` file is intentionally ignored by Git because it is
large. The reproducible command is:

```bash
npm run rank
```
