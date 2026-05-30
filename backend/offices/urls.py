from django.urls import path

from .views import FloorListCreateView, OfficeListCreateView

urlpatterns = [
    path("", OfficeListCreateView.as_view(), name="office-list-create"),
    path(
        "<int:office_id>/floors/",
        FloorListCreateView.as_view(),
        name="floor-list-create",
    ),
]
