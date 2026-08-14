from django.contrib import admin

from .models import ActivityLog, CandidateDecision, TalentPool


@admin.register(CandidateDecision)
class CandidateDecisionAdmin(admin.ModelAdmin):
    list_display = ("candidate_id", "status", "tags", "updated_by", "updated_at")
    list_filter = ("status",)
    search_fields = ("candidate_id", "notes", "tags")


@admin.register(TalentPool)
class TalentPoolAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "updated_at")
    search_fields = ("name", "description")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "candidate_id", "detail")
    list_filter = ("action",)
    search_fields = ("candidate_id", "detail")
