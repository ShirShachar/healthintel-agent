# HealthIntel Agent

A multi-agent clinical intelligence system that generates real-time health briefs for patients. Five AI agents run in parallel to pull the latest medical research, check FDA drug alerts, assess environmental risks, analyze vitals, and synthesize everything into a structured clinical report.

## Architecture

```
frontend/          React + Vite (deployed on Netlify)
backend/
  main.py          FastAPI REST API
  graph.py         LangGraph orchestrator
  agents/
    research_agent.py     Searches PubMed, CDC, WHO for latest guidelines
    medication_agent.py   Checks FDA alerts and drug interactions
    environment_agent.py  Air quality, outbreaks, allergen levels
    monitor_agent.py      Analyzes vitals against clinical benchmarks
    coordinator_agent.py  Synthesizes all findings into a clinical brief
  models/
    patient.py     MongoDB models (patients, reports, notes, vitals)
```

**Stack:** FastAPI · LangGraph · OpenAI gpt-4o-mini · Tavily Search · MongoDB Atlas · React · Vite

**Deployed:** Backend on AWS Elastic Beanstalk · Frontend on Netlify

## Running Locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Create `backend/.env` with:
```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
MONGODB_DB=patient_health_intelligence
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # dev server at http://localhost:5173
```

To point the frontend at a local backend, create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
```

### Docker (full stack)

```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients` | List all patients |
| POST | `/patients` | Create a patient |
| GET | `/patients/{id}` | Get patient detail |
| PUT | `/patients/{id}` | Update patient |
| POST | `/patients/{id}/vitals` | Log vitals |
| POST | `/patients/{id}/notes` | Add clinical note |
| DELETE | `/patients/{id}/notes/{note_id}` | Delete note |
| GET | `/patients/{id}/reports` | Get analysis history |
| POST | `/analyze` | Run full multi-agent analysis |
| GET | `/health` | Health check |

## Deployment

### Backend — AWS Elastic Beanstalk

```bash
cd backend
eb init        # first time only — select region, Python platform
eb deploy
```

Set environment variables in EB console under **Configuration → Software → Environment properties**:
```
OPENAI_API_KEY
TAVILY_API_KEY
MONGODB_URI
MONGODB_DB
```

### Frontend — Netlify

Connect the repo to Netlify and set the build settings:
- **Base directory:** `frontend`
- **Build command:** `npm run build`
- **Publish directory:** `frontend/dist`

Set environment variable in Netlify:
```
VITE_API_URL=https://<your-eb-environment>.elasticbeanstalk.com
```
