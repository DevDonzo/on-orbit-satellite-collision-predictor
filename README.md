# On-Orbit Satellite Collision Predictor

A production-grade analytical platform for Space Situational Awareness (SSA), providing automated conjunction assessment through machine learning and high-fidelity orbital visualization.

## System Overview

This platform integrates orbital mechanics with predictive modeling to assess collision probabilities between space objects. It transitions beyond simple geometric distance checks by employing a Gradient Boosting model trained on orbital state vectors and conjunction data.

### Key Technical Capabilities

*   **Predictive Conjunction Assessment**: Probabilistic risk modeling using scikit-learn, moving beyond static TLE analysis.
*   **Mission-Grade Visualization**: Real-time 3D rendering of orbital trajectories using CesiumJS and SGP4 propagation.
*   **Secure API Architecture**: Hardened FastAPI implementation with OAuth2/JWT authentication and Redis-backed state management.
*   **Data Pipeline**: Automated ingestion and normalization of TLE (Two-Line Elements) and CDM (Conjunction Data Messages).

## Engineering Stack

### Backend (Python)
*   **Core**: FastAPI, Pydantic V2, Uvicorn.
*   **Analysis**: Scikit-Learn, Pandas, NumPy, Joblib.
*   **Security**: Python-Jose (JWT), Passlib (Bcrypt).
*   **Performance**: Redis (Asynchronous caching).

### Frontend (TypeScript)
*   **Framework**: Next.js 14 (App Router).
*   **Geospatial**: CesiumJS for 3D trajectory rendering.
*   **State & Data**: Zustand for simulation state, TanStack Query for API synchronization.
*   **Interface**: TailwindCSS with a focus on operational clarity.

## Core Components

### Machine Learning Pipeline
The system implements feature engineering derived from classical orbital elements:
*   Eccentricity (e), Inclination (i), and RAAN (Ω).
*   Argument of Perigee (ω) and Mean Anomaly (M).
*   Calculation of relative velocity vectors and predicted miss-distances.

### Production API
Designed for high-concurrency SSA workloads:
*   **Batch Inference**: Optimized endpoints for processing bulk conjunction events.
*   **Caching Layer**: Redis-backed TTL caching for trajectory datasets and prediction results.
*   **Validation**: Strict Pydantic schema enforcement for incoming telemetry payloads.

## Installation

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train_model.py  # Serializes the initial model artifact
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```text
├── backend/
│   ├── api/          # FastAPI routes, middleware, and dependency injection
│   ├── core/         # Security, cache client, and global configuration
│   ├── ml/           # Feature engineering, training, and data pipelines
│   └── models/       # Serialized model artifacts
└── frontend/
    ├── src/app/      # Next.js layouts and route segments
    ├── src/components/# Cesium wrappers and dashboard modules
    └── src/lib/      # Orbital math utilities and API clients
```

## Engineering Standards

*   **Security**: OAuth2 Bearer token authentication is mandatory for all prediction and ingestion endpoints.
*   **Performance**: Rate limiting is integrated at the middleware level to protect inference resources.
*   **Data Integrity**: Feature transformations adhere to standard SGP4 coordinate system conventions.
