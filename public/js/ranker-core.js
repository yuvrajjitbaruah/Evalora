export const ROLE_PROFILE = Object.freeze({
  title: "Senior AI Engineer - Founding Team",
  company: "Redrob AI",
  anchorDate: "2026-06-01",
  idealExperience: [5, 9],
  preferredCities: [
    "pune",
    "noida",
    "delhi",
    "gurgaon",
    "hyderabad",
    "mumbai",
    "bangalore",
    "bengaluru"
  ],
  mustHaveConcepts: [
    "production retrieval",
    "hybrid search",
    "ranking systems",
    "embeddings",
    "vector databases",
    "evaluation frameworks",
    "strong python",
    "product engineering"
  ]
});

const SERVICE_COMPANIES = new Set([
  "accenture",
  "capgemini",
  "cognizant",
  "hcl",
  "infosys",
  "mindtree",
  "mphasis",
  "tcs",
  "tech mahindra",
  "wipro"
]);

const PRODUCT_INDUSTRIES = new Set([
  "adtech",
  "ai/ml",
  "conversational ai",
  "consumer electronics",
  "e-commerce",
  "edtech",
  "fintech",
  "food delivery",
  "gaming",
  "healthtech",
  "healthtech ai",
  "insurance tech",
  "internet",
  "media",
  "saas",
  "software",
  "transportation",
  "voice ai"
]);

const TITLE_WEIGHTS = [
  [/senior ai engineer|lead ai engineer/, 1],
  [/staff machine learning engineer|senior machine learning engineer|senior nlp engineer|senior applied scientist/, 0.97],
  [/recommendation systems engineer|search engineer|senior software engineer \(ml\)/, 0.93],
  [/applied ml engineer|machine learning engineer|ai engineer|nlp engineer/, 0.86],
  [/ml engineer|data scientist|ai specialist/, 0.72],
  [/ai research engineer/, 0.58],
  [/senior data scientist|senior data engineer|data engineer|analytics engineer|backend engineer/, 0.42],
  [/software engineer|full stack developer|cloud engineer|devops engineer/, 0.25]
];

const SKILL_WEIGHTS = new Map([
  ["Ranking Systems", 13],
  ["Learning to Rank", 12],
  ["Search Infrastructure", 12],
  ["Information Retrieval Systems", 12],
  ["Information Retrieval", 11],
  ["Search Backend", 11],
  ["Indexing Algorithms", 10],
  ["Semantic Search", 10],
  ["Vector Search", 10],
  ["Vector Representations", 10],
  ["Text Encoders", 9],
  ["Embeddings", 9],
  ["Sentence Transformers", 9],
  ["BM25", 9],
  ["Content Matching", 8],
  ["Recommendation Systems", 8],
  ["RAG", 8],
  ["FAISS", 8],
  ["Pinecone", 8],
  ["Qdrant", 8],
  ["Weaviate", 8],
  ["Milvus", 8],
  ["pgvector", 7],
  ["OpenSearch", 7],
  ["Elasticsearch", 7],
  ["NLP", 7],
  ["Natural Language Processing", 7],
  ["LLMs", 6],
  ["Fine-tuning LLMs", 6],
  ["LoRA", 5],
  ["QLoRA", 5],
  ["PEFT", 5],
  ["Hugging Face Transformers", 5],
  ["Python", 7],
  ["PyTorch", 5],
  ["TensorFlow", 4],
  ["scikit-learn", 4],
  ["MLOps", 5],
  ["MLflow", 4],
  ["Kubeflow", 4],
  ["BentoML", 4],
  ["Feature Engineering", 4],
  ["FastAPI", 3],
  ["Docker", 3],
  ["Kubernetes", 3],
  ["Data Pipelines", 3],
  ["Spark", 3],
  ["Kafka", 3],
  ["Airflow", 3],
  ["SQL", 2]
]);

const CV_SPEECH_SKILLS = new Set([
  "ASR",
  "CNN",
  "Computer Vision",
  "Diffusion Models",
  "GANs",
  "Image Classification",
  "Object Detection",
  "OpenCV",
  "Speech Recognition",
  "TTS",
  "YOLO"
]);

const PROFICIENCY_FACTOR = Object.freeze({
  beginner: 0.48,
  intermediate: 0.68,
  advanced: 0.88,
  expert: 1
});

const CONCEPT_PATTERNS = Object.freeze({
  retrievalRanking: [
    /hybrid (retrieval|search)/gi,
    /dense (retrieval|vector recall)/gi,
    /semantic search/gi,
    /vector search/gi,
    /ranking (layer|pipeline|model|system|function)/gi,
    /learning[- ]to[- ]rank/gi,
    /recommendation system/gi,
    /candidate[- ]jd matching/gi,
    /\bbm25\b/gi,
    /\bfaiss\b|\bpinecone\b|\bweaviate\b|\bqdrant\b|\bmilvus\b|\bpgvector\b|\belasticsearch\b|\bopensearch\b/gi
  ],
  production: [
    /production/gi,
    /shipped|ship(?:ped)?/gi,
    /served|serving/gi,
    /real users/gi,
    /live a\/b|a\/b test/gi,
    /latency|throughput|scale|millions|50m\+|10m\+/gi,
    /index refresh|embedding drift|feature store|model deployment/gi
  ],
  evaluation: [
    /\bndcg\b|\bmrr\b|\bmap\b|precision@|recall@/gi,
    /offline (benchmark|evaluation|experimentation)/gi,
    /online a\/b|a\/b test/gi,
    /relevance label|labeling pipeline|evaluation framework/gi,
    /recruiter[- ]feedback loop/gi
  ],
  product: [
    /marketplace|e-commerce|consumer product|discovery feed|search product|recruiter-facing/gi,
    /product company|customer-facing|internal knowledge base|candidate sourcing/gi
  ],
  llmDepth: [
    /fine[- ]tun(?:e|ed|ing)/gi,
    /\blora\b|\bqlora\b|\bpeft\b/gi,
    /\brag\b|retrieval augmented/gi,
    /\bbge\b|sentence-transformers|openai embeddings|llama|mistral/gi
  ],
  collaboration: [
    /worked closely with|mentoring|led the engineering team|owned the end-to-end|cross-functional/gi,
    /pm|product manager|recruiter-experience/gi
  ]
});

const NEGATIVE_PATTERNS = Object.freeze({
  pureServices: /consulting firm|services company|client project|staff augmentation/gi,
  weakAi: /experimented with chatgpt|ai tools for productivity|limited technical depth|lightweight deployment/gi,
  cvPrimary: /computer vision models|image moderation|speech recognition|robotics/gi,
  titleChasing: /staff|principal|architect/gi
});

export function scoreCandidate(candidate) {
  const profile = candidate.profile || {};
  const history = Array.isArray(candidate.career_history) ? candidate.career_history : [];
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const signals = candidate.redrob_signals || {};
  const fullText = buildCandidateText(candidate);

  const title = scoreTitle(profile.current_title, history);
  const skill = scoreSkills(skills, signals.skill_assessment_scores || {});
  const semantic = scoreSemanticEvidence(fullText);
  const career = scoreCareer(profile, history, fullText);
  const experience = scoreExperience(Number(profile.years_of_experience || 0));
  const behavior = scoreBehavior(signals);
  const location = scoreLocation(profile, signals);
  const risk = scoreRisk(candidate, fullText, skill, semantic, career);

  const weighted =
    title.score * 0.15 +
    semantic.score * 0.22 +
    skill.score * 0.17 +
    career.score * 0.15 +
    experience.score * 0.1 +
    behavior.score * 0.13 +
    location.score * 0.06 +
    risk.integrityScore * 0.02;

  const score = clamp(weighted - risk.penalty, 0, 0.999);
  const reasoning = buildReason(candidate, {
    title,
    skill,
    semantic,
    career,
    experience,
    behavior,
    location,
    risk,
    score
  });

  return {
    candidate_id: candidate.candidate_id,
    score,
    reasoning,
    components: {
      title: round(title.score),
      semantic: round(semantic.score),
      skills: round(skill.score),
      career: round(career.score),
      experience: round(experience.score),
      behavior: round(behavior.score),
      location: round(location.score),
      integrity: round(risk.integrityScore),
      penalty: round(risk.penalty)
    },
    evidence: {
      concepts: semantic.concepts,
      skillHighlights: skill.highlights,
      careerSignals: career.signals,
      behaviorSignals: behavior.signals,
      riskFlags: risk.flags,
      locationSignal: location.label,
      aiCoreSkillCount: skill.aiCoreSkillCount,
      productCompanyRatio: career.productCompanyRatio
    }
  };
}

export function rankCandidates(candidates, top = 100) {
  return candidates
    .map((candidate) => ({ candidate, result: scoreCandidate(candidate) }))
    .sort(compareRanked)
    .slice(0, top)
    .map((entry, index) => ({
      ...entry.result,
      rank: index + 1,
      candidate: summarizeCandidate(entry.candidate, entry.result)
    }));
}

export function compareRanked(a, b) {
  const left = a.result || a;
  const right = b.result || b;
  const byScore = right.score - left.score;
  if (Math.abs(byScore) > 1e-12) return byScore;
  return String(left.candidate_id).localeCompare(String(right.candidate_id));
}

export function summarizeCandidate(candidate, result = null) {
  const profile = candidate.profile || {};
  const signals = candidate.redrob_signals || {};
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const history = Array.isArray(candidate.career_history) ? candidate.career_history : [];

  return {
    candidate_id: candidate.candidate_id,
    name: profile.anonymized_name || "Anonymous candidate",
    title: profile.current_title || "Unknown title",
    headline: profile.headline || "",
    summary: profile.summary || "",
    location: profile.location || "",
    country: profile.country || "",
    years: Number(profile.years_of_experience || 0),
    company: profile.current_company || "",
    industry: profile.current_industry || "",
    skills: skills
      .slice()
      .sort((a, b) => (SKILL_WEIGHTS.get(b.name) || 0) - (SKILL_WEIGHTS.get(a.name) || 0))
      .slice(0, 12)
      .map((skill) => ({
        name: skill.name,
        proficiency: skill.proficiency,
        duration_months: skill.duration_months || 0,
        endorsements: skill.endorsements || 0
      })),
    career: history.slice(0, 4).map((role) => ({
      company: role.company,
      title: role.title,
      industry: role.industry,
      duration_months: role.duration_months,
      is_current: role.is_current,
      description: role.description
    })),
    signals: {
      last_active_date: signals.last_active_date,
      open_to_work_flag: Boolean(signals.open_to_work_flag),
      recruiter_response_rate: Number(signals.recruiter_response_rate || 0),
      avg_response_time_hours: Number(signals.avg_response_time_hours || 0),
      notice_period_days: Number(signals.notice_period_days || 0),
      github_activity_score: Number(signals.github_activity_score ?? -1),
      interview_completion_rate: Number(signals.interview_completion_rate || 0),
      offer_acceptance_rate: Number(signals.offer_acceptance_rate ?? -1),
      saved_by_recruiters_30d: Number(signals.saved_by_recruiters_30d || 0),
      preferred_work_mode: signals.preferred_work_mode || "",
      willing_to_relocate: Boolean(signals.willing_to_relocate),
      verified_email: Boolean(signals.verified_email),
      verified_phone: Boolean(signals.verified_phone),
      linkedin_connected: Boolean(signals.linkedin_connected)
    },
    result
  };
}

function scoreTitle(currentTitle = "", history = []) {
  const current = matchTitle(currentTitle);
  const historical = history.reduce((max, role) => Math.max(max, matchTitle(role.title || "")), 0);
  const score = clamp(current * 0.78 + historical * 0.22, 0, 1);
  return {
    score,
    current,
    historical,
    label: currentTitle
  };
}

function matchTitle(title) {
  const text = clean(title);
  for (const [pattern, weight] of TITLE_WEIGHTS) {
    if (pattern.test(text)) return weight;
  }
  return 0.06;
}

function scoreSkills(skills, assessments) {
  let weighted = 0;
  let maxPossible = 0;
  let aiCoreSkillCount = 0;
  let cvSpeechWeight = 0;
  const highlights = [];

  for (const skill of skills) {
    const weight = SKILL_WEIGHTS.get(skill.name) || 0;
    if (!weight) {
      if (CV_SPEECH_SKILLS.has(skill.name)) cvSpeechWeight += 1.5;
      continue;
    }

    const proficiency = PROFICIENCY_FACTOR[clean(skill.proficiency)] || 0.6;
    const duration = clamp(Math.log1p(Number(skill.duration_months || 0)) / Math.log(97), 0.25, 1);
    const endorsements = clamp(Math.log1p(Number(skill.endorsements || 0)) / Math.log(81), 0.4, 1);
    const assessment = typeof assessments[skill.name] === "number"
      ? 0.86 + clamp(assessments[skill.name] / 100, 0, 1) * 0.22
      : 1;
    const contribution = weight * proficiency * duration * endorsements * assessment;
    weighted += contribution;
    maxPossible += weight;

    if (weight >= 6) aiCoreSkillCount += 1;
    highlights.push({
      name: skill.name,
      weight,
      contribution,
      proficiency: skill.proficiency,
      duration_months: Number(skill.duration_months || 0)
    });
  }

  const raw = weighted / 75;
  const balancePenalty = cvSpeechWeight > weighted * 0.35 ? 0.08 : 0;
  const score = clamp(1 - Math.exp(-raw) - balancePenalty, 0, 1);

  return {
    score,
    raw: weighted,
    aiCoreSkillCount,
    cvSpeechWeight,
    highlights: highlights
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 6)
      .map((item) => item.name)
  };
}

function scoreSemanticEvidence(text) {
  const conceptScores = {};
  let weighted = 0;

  for (const [concept, patterns] of Object.entries(CONCEPT_PATTERNS)) {
    let count = 0;
    for (const pattern of patterns) {
      count += countMatches(text, pattern);
    }
    const conceptScore = clamp(Math.log1p(count) / Math.log(10), 0, 1);
    conceptScores[concept] = conceptScore;
  }

  weighted =
    conceptScores.retrievalRanking * 0.34 +
    conceptScores.production * 0.22 +
    conceptScores.evaluation * 0.18 +
    conceptScores.product * 0.12 +
    conceptScores.llmDepth * 0.09 +
    conceptScores.collaboration * 0.05;

  const concepts = Object.entries(conceptScores)
    .filter(([, score]) => score >= 0.3)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return {
    score: clamp(weighted, 0, 1),
    concepts,
    conceptScores
  };
}

function scoreCareer(profile, history, text) {
  const companies = history.map((role) => clean(role.company));
  const industries = history.map((role) => clean(role.industry || profile.current_industry));
  const servicesCount = companies.filter((company) => SERVICE_COMPANIES.has(company)).length;
  const productCount = industries.filter((industry) => PRODUCT_INDUSTRIES.has(industry)).length;
  const productCompanyRatio = history.length ? productCount / history.length : 0;
  const serviceOnly = history.length > 0 && servicesCount === history.length;
  const currentIndustryProduct = PRODUCT_INDUSTRIES.has(clean(profile.current_industry));
  const roleDescriptions = history.map((role) => clean(role.description)).join(" ");

  const productionDepth =
    countMatches(roleDescriptions, /ranking|retrieval|search|recommendation|semantic|vector|candidate[- ]jd|a\/b|ndcg|mrr|map/gi);
  const seniorOwnership =
    countMatches(roleDescriptions, /owned|led|designed|built and shipped|drove|architected|mentored|from scratch/gi);
  const consultingDrag = countMatches(text, NEGATIVE_PATTERNS.pureServices);
  const weakAi = countMatches(text, NEGATIVE_PATTERNS.weakAi);
  const avgTenure = history.length
    ? history.reduce((sum, role) => sum + Number(role.duration_months || 0), 0) / history.length
    : 0;
  const jobHopPenalty = history.length >= 4 && avgTenure < 18 ? 0.14 : history.length >= 5 && avgTenure < 24 ? 0.08 : 0;

  let score =
    clamp(productCompanyRatio, 0, 1) * 0.32 +
    (currentIndustryProduct ? 0.15 : 0) +
    clamp(Math.log1p(productionDepth) / Math.log(14), 0, 1) * 0.3 +
    clamp(Math.log1p(seniorOwnership) / Math.log(10), 0, 1) * 0.18 +
    (serviceOnly ? 0 : 0.05);

  score -= serviceOnly ? 0.18 : 0;
  score -= clamp(consultingDrag * 0.04 + weakAi * 0.03 + jobHopPenalty, 0, 0.28);

  const signals = [];
  if (productCompanyRatio >= 0.5) signals.push("product-company history");
  if (productionDepth >= 4) signals.push("production retrieval/ranking evidence");
  if (seniorOwnership >= 3) signals.push("ownership language");
  if (serviceOnly) signals.push("services-only risk");
  if (jobHopPenalty) signals.push("short-tenure risk");

  return {
    score: clamp(score, 0, 1),
    productCompanyRatio: round(productCompanyRatio),
    serviceOnly,
    avgTenureMonths: round(avgTenure),
    signals
  };
}

function scoreExperience(years) {
  let score;
  if (years >= 5 && years <= 9) score = 1;
  else if (years >= 4 && years < 5) score = 0.78;
  else if (years > 9 && years <= 11) score = 0.72;
  else if (years >= 3 && years < 4) score = 0.42;
  else if (years > 11 && years <= 14) score = 0.44;
  else if (years > 14) score = 0.22;
  else score = 0.16;

  return { score, years };
}

function scoreBehavior(signals) {
  const daysActive = daysSince(signals.last_active_date, ROLE_PROFILE.anchorDate);
  const active = daysActive <= 14 ? 1 : daysActive <= 30 ? 0.9 : daysActive <= 60 ? 0.72 : daysActive <= 90 ? 0.52 : daysActive <= 180 ? 0.22 : 0.08;
  const response = clamp(Math.sqrt(Number(signals.recruiter_response_rate || 0)), 0, 1);
  const responseTimeHours = Number(signals.avg_response_time_hours || 999);
  const responseSpeed = responseTimeHours <= 24 ? 1 : responseTimeHours <= 72 ? 0.78 : responseTimeHours <= 168 ? 0.48 : 0.22;
  const notice = Number(signals.notice_period_days ?? 180);
  const noticeScore = notice <= 15 ? 1 : notice <= 30 ? 0.92 : notice <= 60 ? 0.68 : notice <= 90 ? 0.42 : notice <= 120 ? 0.18 : 0.05;
  const interview = clamp(Number(signals.interview_completion_rate || 0), 0, 1);
  const offerRaw = Number(signals.offer_acceptance_rate ?? -1);
  const offer = offerRaw < 0 ? 0.48 : clamp(offerRaw, 0, 1);
  const profile = clamp(Number(signals.profile_completeness_score || 0) / 100, 0, 1);
  const github = Number(signals.github_activity_score ?? -1);
  const githubScore = github < 0 ? 0.35 : clamp(github / 100, 0, 1);
  const recruiterInterest =
    clamp(Math.log1p(Number(signals.saved_by_recruiters_30d || 0)) / Math.log(21), 0, 1) * 0.55 +
    clamp(Math.log1p(Number(signals.profile_views_received_30d || 0)) / Math.log(101), 0, 1) * 0.2 +
    clamp(Math.log1p(Number(signals.search_appearance_30d || 0)) / Math.log(351), 0, 1) * 0.25;
  const verification =
    (signals.verified_email ? 0.34 : 0) +
    (signals.verified_phone ? 0.33 : 0) +
    (signals.linkedin_connected ? 0.33 : 0);

  const score =
    active * 0.2 +
    (signals.open_to_work_flag ? 1 : 0.25) * 0.1 +
    response * 0.17 +
    responseSpeed * 0.08 +
    noticeScore * 0.13 +
    interview * 0.08 +
    offer * 0.07 +
    profile * 0.05 +
    githubScore * 0.05 +
    recruiterInterest * 0.04 +
    verification * 0.03;

  const behaviorSignals = [];
  if (daysActive <= 30) behaviorSignals.push("recently active");
  if (signals.open_to_work_flag) behaviorSignals.push("open to work");
  if (Number(signals.recruiter_response_rate || 0) >= 0.7) behaviorSignals.push("high recruiter response");
  if (notice <= 30) behaviorSignals.push("short notice");
  if (github >= 70) behaviorSignals.push("strong GitHub signal");

  return {
    score: clamp(score, 0, 1),
    daysActive,
    signals: behaviorSignals
  };
}

function scoreLocation(profile, signals) {
  const location = clean(profile.location);
  const country = clean(profile.country);
  const isIndia = country === "india";
  const preferred = ROLE_PROFILE.preferredCities.some((city) => location.includes(city));
  const relocate = Boolean(signals.willing_to_relocate);

  let score = 0.18;
  if (preferred) score = 1;
  else if (isIndia && relocate) score = 0.76;
  else if (isIndia) score = 0.58;
  else if (relocate) score = 0.42;

  const workMode = clean(signals.preferred_work_mode || "");
  if (["hybrid", "onsite", "flexible"].includes(workMode)) score += 0.06;
  if (preferred && relocate) score += 0.03;

  const label = preferred
    ? "target city"
    : isIndia && relocate
      ? "India + relocation"
      : isIndia
        ? "India"
        : relocate
          ? "relocation possible"
          : "location risk";

  return { score: clamp(score, 0, 1), label };
}

function scoreRisk(candidate, text, skill, semantic, career) {
  const profile = candidate.profile || {};
  const history = Array.isArray(candidate.career_history) ? candidate.career_history : [];
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const flags = [];
  let penalty = 0;

  const statedYears = Number(profile.years_of_experience || 0);
  const careerYears = history.reduce((sum, role) => sum + Number(role.duration_months || 0), 0) / 12;
  if (careerYears && Math.abs(statedYears - careerYears) > 1.25) {
    penalty += 0.2;
    flags.push("experience mismatch");
  }

  const summaryYears = extractSummaryYears(profile.summary || "");
  if (summaryYears !== null && Math.abs(summaryYears - statedYears) > 1.25) {
    penalty += 0.1;
    flags.push("summary-year mismatch");
  }

  const impossibleSkills = skills.filter((item) => {
    const high = ["advanced", "expert"].includes(clean(item.proficiency));
    return high && Number(item.duration_months || 0) <= 2;
  }).length;
  if (impossibleSkills >= 4) {
    penalty += 0.16;
    flags.push("thin high-proficiency skills");
  }

  const aiKeywordStuffer = skill.aiCoreSkillCount >= 8 && semantic.score < 0.22 && career.score < 0.35;
  if (aiKeywordStuffer) {
    penalty += 0.22;
    flags.push("keyword-heavy without career proof");
  }

  const cvPrimary = countMatches(text, NEGATIVE_PATTERNS.cvPrimary) >= 2 && !semantic.concepts.includes("retrievalRanking");
  if (cvPrimary || (skill.cvSpeechWeight > 8 && skill.aiCoreSkillCount < 3)) {
    penalty += 0.08;
    flags.push("CV/speech-heavy fit gap");
  }

  if (career.serviceOnly && semantic.score < 0.45) {
    penalty += 0.11;
    flags.push("services-only background");
  }

  if (statedYears > 14) {
    penalty += 0.08;
    flags.push("outside senior IC range");
  }

  const integrityScore = clamp(1 - penalty * 2.2, 0, 1);
  return {
    penalty: clamp(penalty, 0, 0.42),
    integrityScore,
    flags
  };
}

function buildReason(candidate, ctx) {
  const profile = candidate.profile || {};
  const signals = candidate.redrob_signals || {};
  const years = Number(profile.years_of_experience || 0).toFixed(1).replace(".0", "");
  const title = profile.current_title || "Candidate";
  const location = profile.location || "unknown location";
  const evidence = [];

  if (ctx.evidence?.concepts?.length) {
    evidence.push(ctx.evidence.concepts[0]);
  }

  if (ctx.semantic.concepts.includes("retrievalRanking")) {
    evidence.push("clear retrieval/ranking evidence");
  } else if (ctx.skill.highlights.length) {
    evidence.push(`${ctx.skill.highlights.slice(0, 3).join(", ")} skills`);
  }

  if (ctx.career.productCompanyRatio >= 0.5) {
    evidence.push("product-company history");
  }

  if (ctx.semantic.concepts.includes("evaluation")) {
    evidence.push("evaluation/A-B testing signal");
  }

  const behavior = [];
  if (ctx.behavior.daysActive <= 30) behavior.push("recently active");
  if (signals.open_to_work_flag) behavior.push("open to work");
  if (Number(signals.notice_period_days || 180) <= 30) behavior.push(`${signals.notice_period_days}-day notice`);
  if (Number(signals.recruiter_response_rate || 0) >= 0.7) behavior.push(`response rate ${Number(signals.recruiter_response_rate).toFixed(2)}`);

  const concern = ctx.risk.flags.length
    ? ` Watch: ${ctx.risk.flags.slice(0, 2).join(", ")}.`
    : Number(signals.notice_period_days || 0) > 90
      ? ` Watch: ${signals.notice_period_days}-day notice.`
      : "";

  const evidenceText = evidence.length
    ? evidence.slice(0, 3).join("; ")
    : "adjacent ML/product signals";
  const behaviorText = behavior.length ? ` ${behavior.slice(0, 3).join(", ")}.` : "";

  return `${title} with ${years} yrs in ${location}; ${evidenceText}.${behaviorText}${concern}`.replace(/\s+/g, " ").trim();
}

function buildCandidateText(candidate) {
  const profile = candidate.profile || {};
  const history = Array.isArray(candidate.career_history) ? candidate.career_history : [];
  const education = Array.isArray(candidate.education) ? candidate.education : [];
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const certs = Array.isArray(candidate.certifications) ? candidate.certifications : [];

  return clean([
    profile.headline,
    profile.summary,
    profile.current_title,
    profile.current_company,
    profile.current_industry,
    history.map((role) => [role.title, role.company, role.industry, role.description].join(" ")).join(" "),
    education.map((item) => [item.degree, item.field_of_study, item.institution].join(" ")).join(" "),
    certs.map((item) => [item.name, item.issuer].join(" ")).join(" "),
    skills.map((skill) => skill.name).join(" ")
  ].filter(Boolean).join(" "));
}

function extractSummaryYears(summary) {
  const match = String(summary).match(/(\d+(?:\.\d+)?)\+?\s+years/i);
  return match ? Number(match[1]) : null;
}

function countMatches(text, regex) {
  if (!text) return 0;
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const pattern = new RegExp(regex.source, flags);
  return [...String(text).matchAll(pattern)].length;
}

function daysSince(dateText, anchorText) {
  if (!dateText) return 9999;
  const date = new Date(`${dateText}T00:00:00Z`);
  const anchor = new Date(`${anchorText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 9999;
  return Math.max(0, Math.round((anchor.getTime() - date.getTime()) / 86400000));
}

function clean(value) {
  return String(value || "").toLowerCase().trim();
}

function clamp(value, min = 0, max = 1) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  return Number(Number(value || 0).toFixed(digits));
}
