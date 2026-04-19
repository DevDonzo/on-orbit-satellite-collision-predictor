# On-Orbit Satellite Collision Predictor

Mission-control style platform for conjunction analysis, collision risk scoring, and 3D orbital visualization.

## What this project includes

- **Backend (`backend/`)**: FastAPI service that produces satellite/collision snapshots and ML predictions.
- **Frontend (`frontend/`)**: Next.js 14 dashboard with Cesium globe rendering, live telemetry panels, and alert workflows.
- **ML pipeline (`backend/ml/`)**: Optional model-backed distance prediction with heuristic fallback.

## Architecture at a glance

1. Backend builds a cached dashboard snapshot from orbital samples.
2. Frontend polls snapshot and prediction endpoints, then merges data into Zustand state.
3. Cesium scene renders tracks, conjunction vectors, and risk volumes from normalized frontend types.
4. WebSocket status channel supplements polling for runtime health.

## Repository layout

```text
.
├── backend/
│   ├── api/                # FastAPI entrypoint and routes
│   ├── core/               # Auth, config, cache adapters
│   ├── ml/                 # Data pipeline, schemas, optional predictor
│   └── models/             # Trained model/user store artifacts
└── frontend/
    ├── public/cesium/      # Cesium static assets copied at install/build
    ├── src/app/            # Next.js app router, layout, providers
    ├── src/components/     # Cesium + dashboard UI components
    ├── src/services/       # API client + mission normalization
    └── src/store/          # Simulation state (Zustand)
```

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend defaults:

- API base: `http://127.0.0.1:8000`
- OpenAPI docs: `http://127.0.0.1:8000/docs`
- Auth toggle: `SAT_AUTH_REQUIRED` (default `false`)
- Demo credentials when auth is enabled:
  - username: `operator`
  - password: `orbit-demo-2026`

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend defaults:

- App URL: `http://localhost:3000`
- Backend URL env: `NEXT_PUBLIC_BACKEND_API_URL`
- Cesium assets are auto-copied via `postinstall` and `npm run build`

### Frontend environment variables

Create `frontend/.env.local` (or copy from `.env.example`):

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GLOBE_IMAGERY_MODE=arcgis
NEXT_PUBLIC_ARCGIS_TOKEN=
NEXT_PUBLIC_CESIUM_ION_TOKEN=
```

Imagery mode options:

- `arcgis` (default)
- `cesium-ion` (requires `NEXT_PUBLIC_CESIUM_ION_TOKEN`)
- `osm`

## API endpoints used by the frontend

- `GET /dashboard` (primary mission snapshot)
- `GET /satellites` + `GET /collisions` (automatic frontend fallback path)
- `GET /predict` (prediction overlay)
- `GET /ml/status` (model/runtime status)
- `WS /ws/system-status` (runtime heartbeat)

When backend auth is enabled, `/predict`, `/ml/status`, and WebSocket routes require a bearer token. Frontend degrades gracefully when optional auth data is unavailable.

## Quality commands

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend:

```bash
cd backend
pytest
```

## Current frontend reliability guarantees

- Resilient API pathing: snapshot uses `/dashboard` with automatic fallback to `/satellites` + `/collisions`.
- Safer connectivity state handling: avoids false degraded state during normal background refetches.
- Safer rendering for timestamps and timeline values: guards invalid/missing time data to prevent runtime crashes.
- More stable initial UX: auto-selects an initial asset/collision when data arrives.
- Robust backend URL normalization: invalid local overrides no longer break all requests.
