from django.urls import path

from .views import (
    DeskBookingCancelView,
    DeskBookingDetailView,
    DeskBookingListCreateView,
    DeskDetailView,
    DeskListCreateView,
    FloorListCreateView,
    LayoutObjectDetailView,
    LayoutObjectListCreateView,
    OfficeListCreateView,
)

urlpatterns = [
    path("", OfficeListCreateView.as_view(), name="office-list-create"),
    path(
        "<int:office_id>/floors/",
        FloorListCreateView.as_view(),
        name="floor-list-create",
    ),
    path(
        "<int:office_id>/floors/<int:floor_id>/layout-objects/",
        LayoutObjectListCreateView.as_view(),
        name="layout-object-list-create",
    ),
    path(
        "<int:office_id>/floors/<int:floor_id>/layout-objects/<int:object_id>/",
        LayoutObjectDetailView.as_view(),
        name="layout-object-detail",
    ),
    path(
        "<int:office_id>/floors/<int:floor_id>/desks/",
        DeskListCreateView.as_view(),
        name="desk-list-create",
    ),
    path(
        "<int:office_id>/floors/<int:floor_id>/desks/<int:desk_id>/",
        DeskDetailView.as_view(),
        name="desk-detail",
    ),
    path(
        "<int:office_id>/floors/<int:floor_id>/bookings/",
        DeskBookingListCreateView.as_view(),
        name="desk-booking-list-create",
    ),
    path(
        "<int:office_id>/floors/<int:floor_id>/bookings/<int:booking_id>/",
        DeskBookingDetailView.as_view(),
        name="desk-booking-detail",
    ),
    path(
        "<int:office_id>/floors/<int:floor_id>/bookings/<int:booking_id>/cancel/",
        DeskBookingCancelView.as_view(),
        name="desk-booking-cancel",
    ),
]
