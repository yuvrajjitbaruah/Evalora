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
    # Server-persisted recruiter decisions (team-shared shortlist board)
    path("api/decisions/", views.api_decisions, name="api_decisions"),
    path("api/decisions/save/", views.api_decision_upsert, name="api_decision_upsert"),
    path("api/decisions/<str:candidate_id>/", views.api_decision_delete, name="api_decision_delete"),
    # Talent pools
    path("api/pools/", views.api_pools, name="api_pools"),
    path("api/pools/create/", views.api_pool_create, name="api_pool_create"),
    path("api/pools/<int:pool_id>/members/", views.api_pool_members, name="api_pool_members"),
    path("api/pools/<int:pool_id>/", views.api_pool_delete, name="api_pool_delete"),
    # Analytics
    path("api/analytics/", views.api_analytics, name="api_analytics"),
    # Activity log
    path("api/activity/", views.api_activity, name="api_activity"),
    # Shortlist export
    path("api/export/shortlist/", views.api_export_shortlist, name="api_export_shortlist"),
    path("download/shortlist-report/", views.download_shortlist_report, name="download_shortlist_report"),
]
