from django.urls import path

from .views import OfficeListCreateView

urlpatterns = [
    path("", OfficeListCreateView.as_view(), name="office-list-create"),
]
