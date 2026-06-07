from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from django.conf import settings


BASE_DIR = settings.BASE_DIR
TOP_CANDIDATES_PATH = BASE_DIR / "public" / "data" / "top_candidates.json"
SCORE_REPORT_PATH = BASE_DIR / "public" / "data" / "score_report.json"
SAMPLE_CANDIDATES_PATH = BASE_DIR / "public" / "data" / "sample_candidates.json"
SUBMISSION_PATH = BASE_DIR / "outputs" / "evalora_submission.csv"

ROLE_TERMS = {
    "retrieval": 1.0,
    "ranking": 1.0,
    "recommendation": 0.82,
    "recommender": 0.82,
    "embedding": 0.78,
    "vector": 0.78,
    "rag": 0.72,
    "llm": 0.7,
    "evaluation": 0.72,
    "experiment": 0.55,
    "mlflow": 0.55,
    "python": 0.48,
    "spark": 0.34,
    "airflow": 0.28,
    "product": 0.34,
}

RISK_TERMS = {
    "support": 0.28,
    "sales": 0.3,
    "marketing": 0.24,
    "qa": 0.22,
    "mobile": 0.18,
    "design": 0.2,
}


@lru_cache(maxsize=8)
def load_json(path: str) -> Any:
    file_path = Path(path)
    with file_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_ranking_payload() -> dict[str, Any]:
    return load_json(str(TOP_CANDIDATES_PATH))


def get_score_report() -> dict[str, Any]:
    return load_json(str(SCORE_REPORT_PATH))


def get_sample_candidates() -> Any:
    return load_json(str(SAMPLE_CANDIDATES_PATH))


def submission_file() -> Path:
    return SUBMISSION_PATH


def rank_sample_candidates(candidates: list[dict[str, Any]], limit: int = 25) -> list[dict[str, Any]]:
    ranked = []
    for candidate in candidates:
        score, components, evidence = score_candidate(candidate)
        ranked.append(
            {
                "candidate_id": candidate.get("candidate_id") or candidate.get("id") or "UNKNOWN",
                "score": round(score, 4),
                "components": components,
                "candidate": summarize_candidate(candidate),
                "reasoning": build_reasoning(evidence, components),
            }
        )

    ranked.sort(key=lambda row: row["score"], reverse=True)
    for index, row in enumerate(ranked[:limit], start=1):
        row["rank"] = index
    return ranked[:limit]


def score_candidate(candidate: dict[str, Any]) -> tuple[float, dict[str, float], list[str]]:
    text = corpus_text(candidate)
    profile = candidate.get("profile") or {}
    signals = candidate.get("signals") or candidate.get("redrob_signals") or {}
    skills = candidate.get("skills") or []

    term_score, evidence = weighted_term_score(text, ROLE_TERMS)
    skill_score = skill_depth_score(skills)
    career_score = career_evidence_score(candidate, text)
    experience_score = experience_fit(profile.get("years_of_experience"))
    behavior_score = behavior_readiness(signals)
    location_score = location_fit(profile)
    risk_score = weighted_term_score(text, RISK_TERMS)[0]
    integrity_score = max(0.15, 1 - risk_score * 0.5)

    score = (
        term_score * 0.28
        + skill_score * 0.18
        + career_score * 0.18
        + experience_score * 0.14
        + behavior_score * 0.12
        + location_score * 0.06
        + integrity_score * 0.04
    )

    components = {
        "semantic": round(term_score, 3),
        "skills": round(skill_score, 3),
        "career": round(career_score, 3),
        "experience": round(experience_score, 3),
        "behavior": round(behavior_score, 3),
        "location": round(location_score, 3),
        "integrity": round(integrity_score, 3),
    }
    return min(score, 0.999), components, evidence


def corpus_text(candidate: dict[str, Any]) -> str:
    profile = candidate.get("profile") or {}
    parts = [
        profile.get("headline", ""),
        profile.get("summary", ""),
        profile.get("current_title", ""),
        profile.get("current_industry", ""),
    ]
    for item in candidate.get("career_history") or []:
        parts.extend([item.get("title", ""), item.get("industry", ""), item.get("description", "")])
    for skill in candidate.get("skills") or []:
        parts.append(skill.get("name", "") if isinstance(skill, dict) else str(skill))
    return " ".join(str(part) for part in parts if part).lower()


def weighted_term_score(text: str, terms: dict[str, float]) -> tuple[float, list[str]]:
    if not text:
        return 0.0, []
    score = 0.0
    evidence = []
    for term, weight in terms.items():
        if term in text:
            occurrences = text.count(term)
            score += min(1.0, 0.4 + math.log1p(occurrences) * 0.25) * weight
            evidence.append(term)
    normalizer = max(sum(terms.values()) * 0.42, 1)
    return min(score / normalizer, 1.0), evidence[:5]


def skill_depth_score(skills: list[Any]) -> float:
    if not skills:
        return 0.15
    total = 0.0
    for skill in skills[:24]:
        if not isinstance(skill, dict):
            total += 0.18
            continue
        proficiency = str(skill.get("proficiency", "")).lower()
        depth = {"expert": 1.0, "advanced": 0.82, "intermediate": 0.52, "beginner": 0.26}.get(proficiency, 0.36)
        duration = min(float(skill.get("duration_months") or 0) / 48, 1)
        endorsements = min(float(skill.get("endorsements") or 0) / 40, 1)
        total += depth * 0.62 + duration * 0.24 + endorsements * 0.14
    return min(total / min(len(skills), 24), 1.0)


def career_evidence_score(candidate: dict[str, Any], text: str) -> float:
    history = candidate.get("career_history") or []
    ownership_terms = ("built", "owned", "designed", "implemented", "launched", "deployed", "production")
    ownership_hits = sum(1 for term in ownership_terms if term in text)
    history_depth = min(len(history) / 3, 1)
    return min(ownership_hits / len(ownership_terms) * 0.75 + history_depth * 0.25, 1)


def experience_fit(years: Any) -> float:
    try:
        value = float(years)
    except (TypeError, ValueError):
        return 0.4
    if 5 <= value <= 9:
        return 1.0
    if 3 <= value < 5:
        return 0.62 + (value - 3) * 0.12
    if 9 < value <= 12:
        return max(0.55, 1 - (value - 9) * 0.12)
    return 0.32


def behavior_readiness(signals: dict[str, Any]) -> float:
    response = normalize_percent(signals.get("recruiter_response_rate"))
    interview = normalize_percent(signals.get("interview_completion_rate"))
    github = normalize_percent(signals.get("github_activity_score"))
    notice = signals.get("notice_period_days")
    notice_score = 0.55
    try:
        notice_score = max(0.15, 1 - min(float(notice), 90) / 100)
    except (TypeError, ValueError):
        pass
    verified = sum(bool(signals.get(key)) for key in ("email_verified", "phone_verified", "linkedin_connected")) / 3
    return min(response * 0.28 + interview * 0.22 + github * 0.16 + notice_score * 0.2 + verified * 0.14, 1)


def location_fit(profile: dict[str, Any]) -> float:
    city = str(profile.get("location") or "").lower()
    country = str(profile.get("country") or "").lower()
    target = ("pune", "noida", "delhi", "gurgaon", "hyderabad", "mumbai", "bangalore", "bengaluru")
    if any(place in city for place in target):
        return 1.0
    if country == "india":
        return 0.82
    return 0.45


def normalize_percent(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.35
    if numeric < 0:
        return 0.25
    return min(numeric / 100, 1)


def summarize_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    profile = candidate.get("profile") or {}
    return {
        "title": profile.get("current_title") or profile.get("headline") or "Candidate",
        "headline": profile.get("headline") or "",
        "location": profile.get("location") or "Unknown",
        "years_of_experience": profile.get("years_of_experience"),
    }


def build_reasoning(evidence: list[str], components: dict[str, float]) -> str:
    strongest = sorted(components.items(), key=lambda item: item[1], reverse=True)[:3]
    strength_text = ", ".join(name for name, _ in strongest)
    if evidence:
        return f"Strongest evidence: {', '.join(evidence)}. Best component fit: {strength_text}."
    return f"Limited direct role evidence. Best available component fit: {strength_text}."
