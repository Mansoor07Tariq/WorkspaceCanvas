from django.urls import path

from .views import CreateOrganizationView

urlpatterns = [
    path(
        "organizations/",
        CreateOrganizationView.as_view(),
        name="organization-create",
    ),
]
