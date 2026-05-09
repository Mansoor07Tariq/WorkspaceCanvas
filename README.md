# WorkspaceCanvas

WorkspaceCanvas is a workplace management platform for designing office layouts, managing desk bookings, organizing workplace events, running internal awards, and improving employee engagement.

The long-term goal is to provide companies with a clean internal tool where admins can visually design an office map, publish it for employees, and allow employees to interact with the workspace through bookings, events, voting, and announcements.

## Current Status

This project is in the early setup phase.

Currently completed:

- React + TypeScript frontend setup
- Tailwind CSS setup
- Django backend project setup
- Basic Django `config` project created
- Initial repository structure created

Upcoming work:

- Add backend apps one by one
- Create office/floor/map models
- Build the 2.5D office map editor
- Add desk booking flow
- Add employee-facing office preview
- Add events module
- Add awards and voting module
- Add Outlook email and calendar integration later

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

Planned frontend additions:

- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Konva / React Konva for the office map builder

### Backend

- Python
- Django
- Django REST Framework

Planned backend additions:

- PostgreSQL
- Django REST Framework APIs
- JWT authentication
- Celery + Redis for background jobs
- Microsoft Graph API integration for Outlook email and calendar features

## Project Structure

```txt
WorkspaceCanvas/
  backend/
    config/
    manage.py
    requirements.txt

  frontend/
    public/
    src/
    package.json
    vite.config.ts

  README.md
  .gitignore