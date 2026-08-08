from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Enable the btree_gist extension (PR 073).

    The RoomBooking overlap ExclusionConstraint indexes ``room`` equality
    alongside a tstzrange overlap in a single GiST index; btree_gist provides the
    equality operator class GiST needs. Runs before the model migration that adds
    the constraint.

    Ops note: creating an extension requires a DB role with sufficient privilege
    (superuser, or the extension pre-whitelisted). If unavailable in a target
    environment, the documented fallback is the app-level select_for_update guard
    in RoomBookingService (see review/19 §2 D3 strategy C).
    """

    dependencies = [
        ("offices", "0015_remove_floorlayoutobject_is_bookable"),
    ]

    operations = [
        BtreeGistExtension(),
    ]
