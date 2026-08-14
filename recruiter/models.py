from django.db import models


class CandidateDecision(models.Model):
    """A recruiter's workflow decision on a single candidate, persisted server-side.

    Complements (and can replace) the browser-local decision board so that a
    recruiting team sees the same shortlist/notes regardless of which machine
    or browser they use.
    """

    STATUS_CHOICES = [
        ("shortlisted", "Shortlisted"),
        ("review", "Needs review"),
        ("rejected", "Rejected"),
    ]

    candidate_id = models.CharField(max_length=128, unique=True, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="review")
    notes = models.TextField(blank=True, default="")
    tags = models.CharField(max_length=255, blank=True, default="")
    updated_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.candidate_id} -> {self.status}"

    def tag_list(self) -> list[str]:
        return [tag.strip() for tag in self.tags.split(",") if tag.strip()]

    def as_dict(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "status": self.status,
            "notes": self.notes,
            "tags": self.tag_list(),
            "updated_by": self.updated_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class TalentPool(models.Model):
    """A named, reusable shortlist of candidate IDs (e.g. "Final round", "Backup bench")."""

    name = models.CharField(max_length=120, unique=True)
    description = models.CharField(max_length=280, blank=True, default="")
    candidate_ids = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name

    def id_list(self) -> list[str]:
        return [cid.strip() for cid in self.candidate_ids.split(",") if cid.strip()]

    def set_id_list(self, ids: list[str]) -> None:
        deduped = list(dict.fromkeys(cid.strip() for cid in ids if cid and cid.strip()))
        self.candidate_ids = ",".join(deduped)

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "candidate_ids": self.id_list(),
            "count": len(self.id_list()),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ActivityLog(models.Model):
    """Audit trail of recruiter and AI Copilot actions for accountability."""

    ACTION_CHOICES = [
        ("decision", "Decision updated"),
        ("pool", "Talent pool updated"),
        ("ai_action", "AI Copilot action"),
        ("ats_analysis", "ATS analysis run"),
        ("export", "Report exported"),
    ]

    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    candidate_id = models.CharField(max_length=128, blank=True, default="")
    detail = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.action} {self.candidate_id}".strip()

    def as_dict(self) -> dict:
        return {
            "action": self.action,
            "action_label": self.get_action_display(),
            "candidate_id": self.candidate_id,
            "detail": self.detail,
            "created_at": self.created_at.isoformat(),
        }
