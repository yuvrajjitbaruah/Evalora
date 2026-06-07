from django.urls import path

from . import views

app_name = "recruiter"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("api/candidates/", views.api_candidates, name="api_candidates"),
    path("api/report/", views.api_report, name="api_report"),
    path("api/sample/", views.api_sample, name="api_sample"),
    path("api/rank-sample/", views.api_rank_sample, name="api_rank_sample"),
    path("api/ai/status/", views.api_ai_status, name="api_ai_status"),
    path("api/ai/candidate-action/", views.api_ai_candidate_action, name="api_ai_candidate_action"),
    path("api/ats/analyze/", views.api_ats_analyze, name="api_ats_analyze"),
    path("download/submission/", views.download_submission, name="download_submission"),
]
