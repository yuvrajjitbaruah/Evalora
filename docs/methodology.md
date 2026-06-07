# Evalora Methodology

Evalora is a deterministic hybrid ranker for the India Runs Track 1 candidate
ranking challenge. It is designed for the released Senior AI Engineer JD and
the 100,000-candidate Redrob profile pool.

## What The JD Actually Asks For

The job description is not a keyword checklist. The strong-fit profile is a
senior applied ML/product engineer who has shipped retrieval, ranking,
semantic-search, recommendation, or candidate-matching systems to real users.
Evalora therefore treats a candidate with plain-language career evidence as
stronger than a candidate who only lists a dense set of AI buzzwords.

Primary requirements:

- Production retrieval/ranking/search/recommendation experience
- Embeddings and vector or hybrid search infrastructure
- Ranking evaluation experience such as NDCG, MRR, MAP, labeling, or A/B tests
- Strong applied engineering judgment, especially Python and production ML
- Product-company exposure and ownership language
- Availability signals: recent activity, recruiter response, notice period,
  relocation/location fit, and verification

## Scoring Design

The ranking step streams candidates from JSONL and computes a weighted fit score
from these components:

- `semantic`: evidence in career text that the person actually built relevant
  systems
- `skills`: depth, proficiency, endorsements, duration, and assessment support
  for relevant AI/search skills
- `career`: product-company ratio, production ownership, and services-only risk
- `experience`: fit to the 5-9 year senior IC window, while allowing exceptions
- `behavior`: Redrob engagement and hireability signals
- `location`: Pune/Noida/Delhi NCR/Hyderabad/Mumbai/Bangalore and relocation fit
- `integrity`: timeline consistency and honeypot-style risk checks

The final score is deterministic, CPU-only, and does not call hosted LLM APIs.

## Risk Controls

Evalora penalizes profiles that look good to keyword filters but weak to a
recruiter:

- Many AI keywords without career proof
- Services-only history without strong product/retrieval evidence
- Experience mismatches between profile, summary, and career duration
- Implausible high-proficiency skills with almost no usage duration
- Computer-vision or speech-heavy profiles without NLP/IR relevance
- Very long notice periods or stale platform activity

## Reproducibility

Run the full ranking step:

```bash
npm run rank
```

Validate the generated CSV:

```bash
npm run validate
```

The default output is:

```text
outputs/evalora_submission.csv
```

The generated app data for the dashboard is:

```text
public/data/top_candidates.json
public/data/score_report.json
```
