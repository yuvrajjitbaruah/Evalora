from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from .services import get_ranking_payload


TASKS = {
    "brief",
    "questions",
    "risk",
    "scorecard",
    "boolean_search",
    "calibration",
    "outreach",
    "hindi_outreach",
}
PROVIDERS = {"auto", "gemini", "sarvam", "local"}
DEFAULT_ROLE_DESCRIPTION = """
Senior AI Engineer for a founding AI team. The role needs production retrieval,
hybrid search, ranking systems, embeddings, vector databases, evaluation
frameworks, strong Python, product engineering judgment, ownership, and
recruiter-ready logistics.
""".strip()


class AiProviderError(RuntimeError):
    pass


def provider_status() -> dict[str, Any]:
    return {
        "google_configured": bool(settings.GOOGLE_AI_API_KEY),
        "sarvam_configured": bool(settings.SARVAM_API_KEY),
        "gemini_model": settings.GEMINI_MODEL,
        "sarvam_model": settings.SARVAM_MODEL,
        "available_tasks": sorted(TASKS),
        "local_engine": True,
    }


def candidate_ai_action(candidate_id: str, task: str = "brief", provider: str = "auto") -> dict[str, Any]:
    task = task if task in TASKS else "brief"
    provider = provider if provider in PROVIDERS else "auto"
    row = find_candidate(candidate_id)
    prompt = build_prompt(row, task)
    errors = []

    for chosen in provider_attempts(task, provider):
        if chosen == "gemini":
            if not settings.GOOGLE_AI_API_KEY:
                errors.append("Gemini key missing")
                continue
            try:
                return {
                    "provider": "gemini",
                    "provider_label": f"Gemini / {settings.GEMINI_MODEL}",
                    "model": settings.GEMINI_MODEL,
                    "text": call_gemini(prompt),
                }
            except AiProviderError as exc:
                errors.append(f"Gemini: {exc}")
                continue

        if chosen == "sarvam":
            if not settings.SARVAM_API_KEY:
                errors.append("Sarvam key missing")
                continue
            try:
                return {
                    "provider": "sarvam",
                    "provider_label": f"Sarvam / {settings.SARVAM_MODEL}",
                    "model": settings.SARVAM_MODEL,
                    "text": call_sarvam(prompt, task),
                }
            except AiProviderError as exc:
                errors.append(f"Sarvam: {exc}")
                continue

        if chosen == "local":
            response = fallback_response(row, task, "Local recruiter engine")
            if errors:
                response["provider_warning"] = "; ".join(errors[:2])
            return response

    response = fallback_response(row, task, "Local recruiter engine")
    response["provider_warning"] = provider_fallback_warning(provider, errors)
    return response


def choose_provider(task: str, provider: str) -> str:
    if provider == "local":
        return "local"
    if provider in {"gemini", "sarvam"}:
        return provider
    if task == "hindi_outreach" and settings.SARVAM_API_KEY:
        return "sarvam"
    if settings.GOOGLE_AI_API_KEY:
        return "gemini"
    if settings.SARVAM_API_KEY:
        return "sarvam"
    return "local"


def provider_attempts(task: str, provider: str) -> list[str]:
    if provider in {"gemini", "sarvam", "local"}:
        return [provider]

    ordered = ["sarvam", "gemini"] if task == "hindi_outreach" else ["gemini", "sarvam"]
    attempts = []
    for name in ordered:
        if name == "gemini" and settings.GOOGLE_AI_API_KEY:
            attempts.append(name)
        if name == "sarvam" and settings.SARVAM_API_KEY:
            attempts.append(name)
    attempts.append("local")
    return attempts


def find_candidate(candidate_id: str) -> dict[str, Any]:
    for row in get_ranking_payload().get("candidates", []):
        if row.get("candidate_id") == candidate_id:
            return row
    raise ValueError("Candidate was not found in the ranked shortlist.")


def build_prompt(row: dict[str, Any], task: str) -> str:
    candidate = row["candidate"]
    signals = candidate.get("signals", {})
    evidence = row.get("evidence", {})
    components = row.get("components", {})
    skills = ", ".join(skill.get("name", str(skill)) for skill in candidate.get("skills", [])[:12])
    risks = ", ".join(evidence.get("riskFlags") or []) or "none"
    component_text = ", ".join(f"{key}: {round(value, 3)}" for key, value in components.items())
    career = "\n".join(
        f"- {item.get('title', 'Role')} at {item.get('company', 'Company')}: {item.get('description', '')[:280]}"
        for item in candidate.get("career", [])[:4]
    )

    action_description = {
        "brief": "Write a crisp recruiter brief with fit verdict, strongest proof, watch-outs, and next action.",
        "questions": "Create 6 interview questions tied to this candidate's evidence. Include what a strong answer should prove.",
        "risk": "Audit the candidate for hiring risks, missing evidence, and verification checks. Be balanced and evidence based.",
        "scorecard": "Create a structured recruiter scorecard with categories, evidence, concerns, and hiring recommendation.",
        "boolean_search": "Create a Boolean sourcing query and adjacent title/skill variants recruiters can use to find similar candidates.",
        "calibration": "Write a calibration note explaining why this candidate is ranked where they are and what would move them up or down.",
        "outreach": "Write a short personalized outreach message from a recruiter for the Senior AI Engineer founding team role.",
        "hindi_outreach": "Write a warm Hindi-English outreach draft for an Indian candidate. Keep it professional, concise, and recruiter-ready.",
    }[task]

    return f"""
You are Evalora, a recruiter-grade AI copilot for a hackathon hiring intelligence platform.
Use only the evidence below. Do not invent employers, skills, achievements, or availability.

Task: {action_description}

Role: Senior AI Engineer, founding AI team, Redrob AI.
Candidate: {candidate.get("name")} ({row.get("candidate_id")})
Rank and score: #{row.get("rank")} / {row.get("score", 0):.4f}
Title: {candidate.get("title")}
Location: {candidate.get("location")} / {candidate.get("country")}
Experience: {candidate.get("years")} years
Current company and industry: {candidate.get("company")} / {candidate.get("industry")}
Summary: {candidate.get("summary")}
Reasoning: {row.get("reasoning")}
Top skills: {skills}
Concept evidence: {", ".join(evidence.get("concepts") or [])}
Skill evidence: {", ".join(evidence.get("skillHighlights") or [])}
Career signals: {", ".join(evidence.get("careerSignals") or [])}
Behavior signals: {", ".join(evidence.get("behaviorSignals") or [])}
Risk flags: {risks}
Location signal: {evidence.get("locationSignal")}
Components: {component_text}
Signals: response_rate={signals.get("recruiter_response_rate")}, notice_days={signals.get("notice_period_days")},
open_to_work={signals.get("open_to_work_flag")}, last_active={signals.get("last_active_date")},
github_activity={signals.get("github_activity_score")}, interview_completion={signals.get("interview_completion_rate")}
Career evidence:
{career}

Output in compact Markdown. Keep it practical for a recruiter.
""".strip()


def call_gemini(prompt: str) -> str:
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?{urlencode({'key': settings.GOOGLE_AI_API_KEY})}"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.35, "topP": 0.9},
    }
    data = post_json(endpoint, body, {"Content-Type": "application/json"})
    if data.get("error"):
        raise AiProviderError(str(data["error"].get("message", "provider error"))[:180])
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts if part.get("text")).strip()
    if not text:
        raise AiProviderError("empty response")
    return text


def call_sarvam(prompt: str, task: str) -> str:
    system = "You are Evalora, a practical recruiter copilot. Use only supplied evidence."
    if task == "hindi_outreach":
        system = "You are Evalora, a recruiter copilot that can write polished Hindi-English outreach."
    body = {
        "model": settings.SARVAM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.35,
    }
    data = post_json(
        "https://api.sarvam.ai/v1/chat/completions",
        body,
        {"Content-Type": "application/json", "api-subscription-key": settings.SARVAM_API_KEY},
    )
    if data.get("error"):
        error = data["error"]
        message = error.get("message") if isinstance(error, dict) else str(error)
        raise AiProviderError(str(message)[:180])
    choices = data.get("choices") or []
    if not choices:
        raise AiProviderError("empty response")
    message = choices[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, list):
        content = "\n".join(item.get("text", "") for item in content if isinstance(item, dict))
    text = str(content).strip()
    if not text:
        raise AiProviderError("empty response")
    return text


def post_json(url: str, body: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    request = Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    try:
        with urlopen(request, timeout=settings.AI_REQUEST_TIMEOUT_SECONDS) as response:
            payload = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:220]
        raise AiProviderError(f"HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise AiProviderError(str(exc.reason)[:180]) from exc
    except TimeoutError as exc:
        raise AiProviderError("request timed out") from exc
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise AiProviderError("invalid JSON from provider") from exc


def fallback_response(row: dict[str, Any], task: str, label: str) -> dict[str, Any]:
    return {
        "provider": "local",
        "provider_label": label or "Local recruiter engine",
        "model": "deterministic-evalora-fallback",
        "text": fallback_text(row, task),
    }


def provider_fallback_warning(provider: str, errors: list[str]) -> str:
    chosen = "Auto route" if provider == "auto" else provider.capitalize()
    detail = "; ".join(errors[:2]) if errors else "No cloud provider was available."
    return f"{chosen} fell back to Evalora's local engine. {detail}"


def fallback_text(row: dict[str, Any], task: str) -> str:
    c = row["candidate"]
    evidence = row.get("evidence", {})
    skills = ", ".join(skill.get("name", str(skill)) for skill in c.get("skills", [])[:6])
    risks = evidence.get("riskFlags") or []
    risk_text = ", ".join(risks) if risks else "No major risk flags in the ranked evidence."
    proof = "; ".join((evidence.get("careerSignals") or [])[:3]) or row.get("reasoning", "")
    behavior = "; ".join((evidence.get("behaviorSignals") or [])[:3]) or "Behavior signal needs recruiter verification."

    if task == "questions":
        return "\n".join(
            [
                f"Interview kit for {c.get('name')} ({c.get('title')})",
                "",
                f"1. Ask for a production retrieval or ranking system they owned. Strong answer should prove: {proof}.",
                "2. Ask how they evaluated search/ranking quality offline and online. Strong answer should mention metrics, experiments, and tradeoffs.",
                f"3. Ask them to explain the role of these skills in shipped work: {skills}.",
                "4. Ask about failure cases, latency, cost, and data quality in retrieval systems.",
                f"5. Verify behavior readiness: {behavior}.",
                f"6. Probe risk or missing evidence: {risk_text}",
            ]
        )
    if task == "risk":
        return "\n".join(
            [
                f"Risk audit for {c.get('name')}",
                "",
                f"Score context: rank #{row.get('rank')} with {row.get('score', 0):.4f}.",
                f"Positive evidence: {proof}.",
                f"Behavior signal: {behavior}.",
                f"Watch-outs: {risk_text}",
                "Recruiter check: validate actual ownership, scope, recent hands-on depth, notice period, and interview reliability before final offer motion.",
            ]
        )
    if task == "scorecard":
        return "\n".join(
            [
                f"Structured scorecard for {c.get('name')}",
                "",
                f"Overall: rank #{row.get('rank')} with score {row.get('score', 0):.4f}.",
                f"Technical fit: {skills}.",
                f"Career evidence: {proof}.",
                f"Readiness: {behavior}.",
                f"Concerns: {risk_text}",
                "Recommendation: advance to a focused technical screen if ownership and evaluation depth are verified.",
            ]
        )
    if task == "boolean_search":
        return "\n".join(
            [
                "Boolean sourcing query",
                "",
                '("Senior AI Engineer" OR "Machine Learning Engineer" OR "Search Engineer" OR "Recommendation Systems Engineer")',
                'AND ("retrieval" OR "ranking" OR "learning to rank" OR "hybrid search" OR "embeddings" OR "vector database")',
                'AND ("Python" OR "ML systems" OR "evaluation" OR "A/B testing")',
                "",
                f"Candidate anchor terms: {skills}.",
            ]
        )
    if task == "calibration":
        return "\n".join(
            [
                f"Recruiter calibration note for {c.get('name')}",
                "",
                f"Why ranked high: {proof}.",
                f"Why not automatic hire: {risk_text}",
                f"Workflow cue: {behavior}.",
                "Move up if they show direct production ownership, measurable search/ranking evaluation, and senior product tradeoff judgment.",
                "Move down if the evidence is mostly keyword listing, academic-only, or support/service delivery without shipped ranking systems.",
            ]
        )
    if task == "outreach":
        return (
            f"Hi {c.get('name')}, I came across your profile while shortlisting for a Senior AI Engineer role on a founding AI team. "
            f"Your background in {skills} and the evidence around {proof} stood out for a role that needs production retrieval, ranking, and evaluation judgment. "
            "Would you be open to a short conversation this week?"
        )
    if task == "hindi_outreach":
        return (
            f"Namaste {c.get('name')}, aapka profile Senior AI Engineer founding team role ke liye strong match lag raha hai. "
            f"Especially {skills} aur {proof} ka evidence kaafi relevant hai. "
            "Kya aap is week ek short call ke liye open honge?"
        )
    return "\n".join(
        [
            f"Recruiter brief for {c.get('name')}",
            "",
            f"Fit verdict: strong shortlist candidate at rank #{row.get('rank')} with score {row.get('score', 0):.4f}.",
            f"Role proof: {proof}.",
            f"Skill signal: {skills}.",
            f"Readiness: {behavior}.",
            f"Watch-outs: {risk_text}",
            "Next action: run a focused screen on retrieval/ranking ownership, evaluation practice, and actual production responsibility.",
        ]
    )


def analyze_resume(resume_text: str, job_description: str = "", provider: str = "auto") -> dict[str, Any]:
    resume_text = normalize_resume_text(resume_text)
    if not resume_text:
        raise ValueError("Resume or CV text is required.")
    job_description = normalize_resume_text(job_description) or DEFAULT_ROLE_DESCRIPTION
    provider = provider if provider in PROVIDERS else "auto"
    base = deterministic_ats_analysis(resume_text, job_description)
    prompt = build_ats_prompt(resume_text, job_description, base)
    errors = []

    for chosen in provider_attempts("brief", provider):
        if chosen == "gemini":
            if not settings.GOOGLE_AI_API_KEY:
                errors.append("Gemini key missing")
                continue
            try:
                base["provider"] = "gemini"
                base["provider_label"] = f"Gemini / {settings.GEMINI_MODEL}"
                base["ai_note"] = call_gemini(prompt)
                return base
            except AiProviderError as exc:
                errors.append(f"Gemini: {exc}")
                continue

        if chosen == "sarvam":
            if not settings.SARVAM_API_KEY:
                errors.append("Sarvam key missing")
                continue
            try:
                base["provider"] = "sarvam"
                base["provider_label"] = f"Sarvam / {settings.SARVAM_MODEL}"
                base["ai_note"] = call_sarvam(prompt, "brief")
                return base
            except AiProviderError as exc:
                errors.append(f"Sarvam: {exc}")
                continue

        if chosen == "local":
            base["provider"] = "local"
            base["provider_label"] = "Local ATS engine"
            base["ai_note"] = base["summary"]
            if errors:
                base["provider_warning"] = "Cloud providers unavailable: " + "; ".join(errors[:2])
            return base

    base["provider"] = "local"
    base["provider_label"] = "Local ATS engine"
    base["ai_note"] = base["summary"]
    base["provider_warning"] = provider_fallback_warning(provider, errors)
    return base


def normalize_resume_text(value: str) -> str:
    return " ".join(str(value or "").replace("\x00", " ").split())[:30000]


def deterministic_ats_analysis(resume_text: str, job_description: str) -> dict[str, Any]:
    text = resume_text.lower()
    role_text = job_description.lower()
    profile_evidence = extract_profile_evidence(resume_text)
    profile_type = detect_profile_type(text)
    categories = [
        ("Retrieval and ranking", ("retrieval", "ranking", "search", "recommendation", "learning to rank"), 20),
        ("Embeddings and vector systems", ("embedding", "vector", "faiss", "pinecone", "milvus", "weaviate", "qdrant"), 18),
        ("Evaluation discipline", ("evaluation", "metrics", "experiment", "a/b", "ab test", "offline", "online"), 15),
        ("Python and ML engineering", ("python", "pytorch", "tensorflow", "scikit", "mlflow", "airflow", "spark"), 15),
        ("Production ownership", ("production", "deployed", "launched", "owned", "designed", "implemented", "scaled"), 16),
        ("Product judgment", ("product", "roadmap", "stakeholder", "customer", "latency", "cost", "tradeoff"), 10),
    ]
    strengths = []
    gaps = []
    matched_keywords = []
    score = 12
    for label, terms, weight in categories:
        hits = [term for term in terms if contains_term(text, term)]
        if hits:
            matched_keywords.extend(hits)
            score += min(weight, 6 + len(hits) * 4)
            strengths.append(f"{label}: {', '.join(hits[:5])}")
        else:
            required = any(contains_term(role_text, term) for term in terms)
            gaps.append(f"{label}: no clear evidence found" if required else f"{label}: weak signal")

    years = estimate_years(text)
    if years is not None:
        if 5 <= years <= 9:
            score += 12
            strengths.append(f"Experience window: {years:g} years fits the 5-9 year target")
        elif 3 <= years < 5 or 9 < years <= 12:
            score += 6
            gaps.append(f"Experience window: {years:g} years is adjacent, verify seniority")
        else:
            gaps.append(f"Experience window: {years:g} years may not fit the target")
    else:
        gaps.append("Experience window: years of experience not explicit")

    if not strengths and profile_evidence:
        strengths = [f"Parsed resume evidence: {item}" for item in profile_evidence[:3]]
    elif profile_evidence:
        strengths.extend(f"Additional resume evidence: {item}" for item in profile_evidence[:2])

    risk_terms = ("support", "sales", "marketing", "qa only", "course project", "internship only")
    risks = [f"Potential mismatch signal: {term}" for term in risk_terms if term in text]
    if not risks:
        risks = ["No obvious keyword-level risk flag; still verify ownership and recency."]

    score = max(0, min(100, score))
    if score >= 82:
        verdict = "Strong match"
    elif score >= 68:
        verdict = "Good screen"
    elif score >= 52:
        verdict = "Needs recruiter review"
    else:
        verdict = "Weak match"

    questions = [
        "Walk through a production retrieval or ranking system you personally owned.",
        "Which offline and online metrics did you use to evaluate search or recommendation quality?",
        "Describe a tradeoff you made between latency, cost, model quality, and product needs.",
        "What evidence proves this was shipped beyond a prototype or course project?",
    ]
    summary = (
        f"{verdict} at {score}/100. Profile read as {profile_type}. "
        f"Strongest evidence: {strengths[0] if strengths else 'resume parsed, but no direct role evidence found'}. "
        f"Main gap: {gaps[0] if gaps else 'no major deterministic gap found'}."
    )
    return {
        "provider": "local",
        "provider_label": "Local ATS engine",
        "score": score,
        "verdict": verdict,
        "summary": summary,
        "strengths": strengths[:6],
        "gaps": gaps[:6],
        "risks": risks[:5],
        "questions": questions,
        "ai_note": summary,
        "profile_type": profile_type,
        "source_quality": source_quality_label(resume_text, matched_keywords),
        "matched_keywords": sorted(set(matched_keywords))[:16],
        "parsed_preview": " ".join(resume_text.split()[:55]),
    }


def extract_profile_evidence(resume_text: str) -> list[str]:
    chunks = re_split_resume_lines(resume_text)
    action_terms = (
        "built",
        "created",
        "implemented",
        "designed",
        "deployed",
        "launched",
        "owned",
        "managed",
        "coordinated",
        "maintained",
        "led",
        "optimized",
        "improved",
        "evaluated",
        "developed",
        "researched",
    )
    evidence = []
    for chunk in chunks:
        if looks_like_contact_line(chunk):
            continue
        lowered = chunk.lower()
        if any(term in lowered for term in action_terms) or re.search(r"\b\d+[\w+%.-]*\b", chunk):
            evidence.append(chunk[:190])
        if len(evidence) >= 5:
            break
    if evidence:
        return evidence
    return chunks[:3]


def contains_term(text: str, term: str) -> bool:
    escaped = re.escape(term.lower())
    return bool(re.search(rf"(?<![a-z0-9+#]){escaped}(?![a-z0-9+#])", text))


def looks_like_contact_line(text: str) -> bool:
    lowered = text.lower()
    if "@" in lowered or "http" in lowered or "www." in lowered:
        return True
    if re.search(r"\b\d{3,}[-.\s]\d{3,}", lowered):
        return True
    contact_terms = ("street", "road", "way", "lane", "fort collins", "email", "phone")
    return any(term in lowered for term in contact_terms) and not any(
        verb in lowered for verb in ("managed", "coordinated", "built", "implemented", "designed", "led")
    )


def re_split_resume_lines(text: str) -> list[str]:
    parts = re.split(r"(?:\n+|•|\u2022|(?<=[.!?])\s+)", text)
    cleaned = []
    for part in parts:
        value = re.sub(r"\s+", " ", part).strip(" -:;")
        if 28 <= len(value) <= 240 and len(value.split()) >= 4:
            cleaned.append(value)
    return cleaned


def detect_profile_type(text: str) -> str:
    if any(term in text for term in ("retrieval", "ranking", "embedding", "vector", "llm", "machine learning", "python")):
        return "AI/ML or search engineering profile"
    if any(term in text for term in ("software", "developer", "backend", "frontend", "django", "react", "api")):
        return "software engineering profile"
    if any(term in text for term in ("childcare", "teacher", "health care", "healthcare", "counseling", "adult care")):
        return "care, education, or counseling profile"
    if any(term in text for term in ("sales", "marketing", "business development", "customer success")):
        return "business or customer-facing profile"
    return "general professional profile"


def source_quality_label(resume_text: str, matched_keywords: list[str]) -> str:
    words = len(resume_text.split())
    if words >= 220 and len(matched_keywords) >= 6:
        return "Strong readable resume text with role evidence"
    if words >= 120:
        return "Readable resume text parsed successfully"
    return "Short resume text; add more detail for a stronger ATS read"


def estimate_years(text: str) -> float | None:
    import re

    patterns = [
        r"(\d+(?:\.\d+)?)\s*\+?\s*years?",
        r"(\d+(?:\.\d+)?)\s*yrs?",
    ]
    values = []
    for pattern in patterns:
        values.extend(float(match) for match in re.findall(pattern, text))
    return max(values) if values else None


def build_ats_prompt(resume_text: str, job_description: str, base: dict[str, Any]) -> str:
    return f"""
You are Evalora ATS Intelligence. Analyze the resume against the job description.
Use only the evidence in the resume. Do not invent experience, companies, credentials, or achievements.

Return a recruiter-ready ATS assessment with:
- overall fit score and verdict
- strongest evidence
- missing proof
- risk checks
- interview questions
- concise next action

Deterministic baseline: {json.dumps(base, ensure_ascii=True)}

Job description:
{job_description[:6000]}

Resume or CV:
{resume_text[:12000]}
""".strip()
