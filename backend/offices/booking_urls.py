from django.urls import path

from .views import MyBookingCancelView, MyBookingsView

urlpatterns = [
    path("my/", MyBookingsView.as_view(), name="my-bookings"),
    path(
        "my/<int:booking_id>/cancel/",
        MyBookingCancelView.as_view(),
        name="my-booking-cancel",
    ),
]
