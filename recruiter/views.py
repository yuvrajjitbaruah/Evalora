import json
import re
import zipfile
from io import BytesIO
from xml.etree import ElementTree

from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .ai_services import AiProviderError, analyze_resume, candidate_ai_action, provider_status
from .services import (
    get_ranking_payload,
    get_sample_candidates,
    get_score_report,
    rank_sample_candidates,
    submission_file,
)


def dashboard(request):
    return render(
        request,
        "recruiter/dashboard.html",
        {
            "github_repo": "https://github.com/yuvrajjitbaruah/Evalora",
            "linkedin_url": "https://www.linkedin.com/in/yuvrajjitbaruah",
        },
    )


@require_GET
def api_candidates(request):
    return JsonResponse(get_ranking_payload())


@require_GET
def api_report(request):
    return JsonResponse(get_score_report())


@require_GET
def api_sample(request):
    sample = get_sample_candidates()
    return JsonResponse(sample, safe=not isinstance(sample, list))


@csrf_exempt
@require_http_methods(["POST"])
def api_rank_sample(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        return JsonResponse({"error": f"Invalid JSON: {exc.msg}"}, status=400)

    candidates = payload if isinstance(payload, list) else payload.get("candidates", [])
    if not isinstance(candidates, list):
        return JsonResponse({"error": "Expected a JSON list or an object with a candidates list."}, status=400)

    return JsonResponse({"candidates": rank_sample_candidates(candidates)})


@require_GET
def api_ai_status(request):
    return JsonResponse(provider_status())


@csrf_exempt
@require_http_methods(["POST"])
def api_ai_candidate_action(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        return JsonResponse({"error": f"Invalid JSON: {exc.msg}"}, status=400)

    candidate_id = str(payload.get("candidate_id") or "").strip()
    if not candidate_id:
        return JsonResponse({"error": "candidate_id is required."}, status=400)

    try:
        return JsonResponse(
            candidate_ai_action(
                candidate_id=candidate_id,
                task=str(payload.get("task") or "brief"),
                provider=str(payload.get("provider") or "auto"),
            )
        )
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=404)
    except AiProviderError as exc:
        return JsonResponse({"error": str(exc)}, status=502)


@csrf_exempt
@require_http_methods(["POST"])
def api_ats_analyze(request):
    try:
        if request.FILES:
            resume_text = extract_resume_file(request.FILES.get("resume_file"))
            job_description = request.POST.get("job_description", "")
            provider = request.POST.get("provider", "auto")
        else:
            payload = json.loads(request.body.decode("utf-8") or "{}")
            resume_text = str(payload.get("resume_text") or "")
            job_description = str(payload.get("job_description") or "")
            provider = str(payload.get("provider") or "auto")
    except (json.JSONDecodeError, ValueError) as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    try:
        return JsonResponse(analyze_resume(resume_text, job_description=job_description, provider=provider))
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except AiProviderError as exc:
        return JsonResponse({"error": str(exc)}, status=502)


def extract_resume_file(uploaded_file) -> str:
    if uploaded_file is None:
        return ""
    if uploaded_file.size > 4 * 1024 * 1024:
        raise ValueError("Resume file is too large. Use a file under 4 MB or paste the text.")
    data = uploaded_file.read()
    name = (uploaded_file.name or "").lower()
    if name.endswith(".docx"):
        text = extract_docx_text(data)
    elif name.endswith(".pdf"):
        text = extract_pdf_text(data)
    else:
        text = ""
        for encoding in ("utf-8", "utf-16", "latin-1"):
            try:
                text = data.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if not text:
            raise ValueError("Could not read the resume file. Paste the resume text instead.")

    text = clean_extracted_text(text)
    validate_extracted_resume_text(text, "file")
    return text


def extract_docx_text(data: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            xml = archive.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise ValueError("Could not read DOCX text. Paste the resume text instead.") from exc
    root = ElementTree.fromstring(xml)
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    parts = [node.text for node in root.iter(f"{namespace}t") if node.text]
    return " ".join(parts)


def extract_pdf_text(data: bytes) -> str:
    text = extract_pdf_text_with_pypdf(data)
    if not text:
        text = extract_pdf_text_legacy(data)
    text = clean_extracted_text(text)
    validate_extracted_resume_text(text, "PDF")
    return text


def extract_pdf_text_with_pypdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    try:
        reader = PdfReader(BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages[:8]]
    except Exception:
        return ""
    return "\n".join(pages)


def extract_pdf_text_legacy(data: bytes) -> str:
    raw = data.decode("latin-1", errors="ignore")
    chunks = re.findall(r"\(([^()]{0,400})\)", raw)
    if not chunks:
        chunks = re.findall(r"\(([^()]*)\)", raw)
    return " ".join(chunk.replace("\\)", ")").replace("\\(", "(") for chunk in chunks)


def clean_extracted_text(text: str) -> str:
    text = str(text or "").replace("\x00", " ")
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    text = text.replace("\u2022", "\n- ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def validate_extracted_resume_text(text: str, source: str) -> None:
    compact = re.sub(r"\s+", " ", text or "").strip()
    words = re.findall(r"[A-Za-z][A-Za-z0-9+#.\-]{1,}", compact)
    if len(compact) < 120 or len(words) < 35:
        raise ValueError(f"Could not extract enough readable text from this {source}. Paste the resume text or upload a DOCX/TXT version.")

    printable = sum(1 for char in compact if char.isprintable())
    letters = sum(1 for char in compact if char.isalpha())
    printable_ratio = printable / max(len(compact), 1)
    letter_ratio = letters / max(len(compact), 1)
    if printable_ratio < 0.9 or letter_ratio < 0.22:
        raise ValueError(
            f"Could not extract readable text from this {source}. It may be scanned, image-only, or encoded. "
            "Paste the resume text or upload a DOCX/TXT version."
        )


@require_GET
def download_submission(request):
    path = submission_file()
    if not path.exists():
        raise Http404("Ranked submission CSV has not been generated yet.")
    return FileResponse(path.open("rb"), as_attachment=True, filename="evalora_submission.csv")

# Create your views here.
