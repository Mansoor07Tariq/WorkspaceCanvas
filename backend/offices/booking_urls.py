from django.urls import path

from .views import (
    MyBookingCancelView,
    MyBookingsView,
    MyRoomBookingsView,
    UsualDeskView,
)

urlpatterns = [
    path("my/", MyBookingsView.as_view(), name="my-bookings"),
    path(
        "my/<int:booking_id>/cancel/",
        MyBookingCancelView.as_view(),
        name="my-booking-cancel",
    ),
    path("my/rooms/", MyRoomBookingsView.as_view(), name="my-room-bookings"),
    path("my/usual-desk/", UsualDeskView.as_view(), name="my-usual-desk"),
]
