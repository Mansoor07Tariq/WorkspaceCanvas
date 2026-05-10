#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-workspacecanvas}" \
  -d "${POSTGRES_DB:-workspacecanvas}"; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Running migrations..."
python manage.py migrate

if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "Checking for existing superuser..."
  python manage.py shell -c '
import os
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser(
        os.environ["DJANGO_SUPERUSER_USERNAME"],
        os.environ["DJANGO_SUPERUSER_EMAIL"],
        os.environ["DJANGO_SUPERUSER_PASSWORD"],
    )
    print("Superuser created.")
else:
    print("Superuser already exists, skipping.")
'
else
  echo "Superuser env vars not set, skipping superuser creation."
fi

echo "Starting Django development server..."
exec python manage.py runserver 0.0.0.0:8000
