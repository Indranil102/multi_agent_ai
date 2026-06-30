# Multi-Agent Research AI

A full-stack research assistant that searches the live web, reads a relevant
source, writes a structured report, and critiques the result. The four-stage
pipeline is orchestrated with LangChain, exposed as a streaming FastAPI API,
and visualized in a React and Tailwind CSS interface.

## What it does

Given a research topic, the application runs these stages in order:

1. **Search agent** — calls Tavily and returns recent titles, URLs, and
   snippets.
2. **Reader agent** — selects a relevant result and uses Requests with
   Beautiful Soup to extract readable page content.
3. **Writer chain** — combines the search results and scraped content into a
   structured research report.
4. **Critic chain** — scores the report, identifies strengths and weaknesses,
   and gives a final verdict.

FastAPI sends stage updates as Server-Sent Events (SSE), so the frontend can
show progress and results as the pipeline runs.

```text
Research topic
     |
     v
Tavily search agent
     |
     v
Beautiful Soup reader agent
     |
     v
Writer chain (prompt -> LLM -> text parser)
     |
     v
Critic chain (prompt -> LLM -> text parser)
     |
     v
Streaming FastAPI response -> React UI
```

## Tech stack

- **AI orchestration:** LangChain agents and LCEL chains
- **LLM:** `openai/gpt-4o-mini` through OpenRouter's OpenAI-compatible API
- **Research tools:** Tavily, Requests, and Beautiful Soup
- **Backend:** FastAPI, Pydantic, Uvicorn, and SSE
- **Frontend:** React, Vite, Tailwind CSS, and Lucide React
- **Deployment configuration:** Render for the API and Vercel for the frontend

## Repository structure

```text
multi_agent_ai/
├── backend/
│   ├── agents.py          Agent definitions, prompts, writer, and critic chains
│   ├── tools.py           Tavily search and Beautiful Soup scraping tools
│   ├── pipeline.py        Command-line version of the research pipeline
│   ├── main.py            FastAPI app and streaming pipeline endpoint
│   └── requirements.txt   Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx        Pipeline UI and SSE response handling
│   │   ├── main.jsx       React entry point
│   │   └── index.css      Tailwind and global styles
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json        Vercel SPA configuration
├── render.yaml            Render backend configuration
└── README.md
```

## Prerequisites

- Python 3.10 or newer (the Render configuration uses Python 3.12)
- Node.js 18 or newer
- A [Tavily](https://tavily.com/) API key
- An [OpenRouter](https://openrouter.ai/) API key with access to
  `openai/gpt-4o-mini`

## Local setup

### 1. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, activate the environment with:

```powershell
.\.venv\Scripts\Activate.ps1
```

Create `backend/.env`:

```env
TAVILY_API_KEY=your_tavily_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Then run the API:

```bash
uvicorn main:app --reload --port 8000
```

Check that it is available at
[`http://localhost:8000/api/health`](http://localhost:8000/api/health).

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Start Vite:

```bash
npm run dev
```

Open [`http://localhost:5173`](http://localhost:5173), enter a topic, and
select **Search**. Each pipeline stage unlocks its output tab when it finishes.

> Environment files are ignored by Git. Never commit real API keys.

## API

### Health check

```http
GET /api/health
```

Response:

```json
{"status": "ok"}
```

### Run streamed research

```http
POST /api/research/stream
Content-Type: application/json
```

Request body:

```json
{
  "topic": "Recent advances in quantum error correction"
}
```

Test the stream from a terminal:

```bash
curl -N -X POST http://localhost:8000/api/research/stream \
  -H "Content-Type: application/json" \
  -d '{"topic":"Recent advances in quantum error correction"}'
```

The endpoint emits:

- `status` while a `search`, `scrape`, `write`, or `critic` stage is running or
  completes
- `complete` with `search_result`, `scraped_content`, `report`, and `feedback`
- `error` with an error message if the pipeline stops

## Command-line usage

The same research workflow can run without the web application:

```bash
cd backend
source .venv/bin/activate
python pipeline.py
```

Enter a topic when prompted. Intermediate results, the final report, and the
critic feedback are printed in the terminal.

## Deployment

### Backend on Render

The root `render.yaml` installs the backend dependencies, starts Uvicorn, and
configures the health check. Set these environment variables in Render:

```env
TAVILY_API_KEY=...
OPENROUTER_API_KEY=...
CORS_ORIGINS=https://your-frontend-domain.example
```

### Frontend on Vercel

Deploy the `frontend` directory and set:

```env
VITE_API_URL=https://your-backend-domain.example
```

Redeploy the frontend after changing a `VITE_*` variable because Vite embeds
it at build time. Add every allowed frontend origin to the backend's
comma-separated `CORS_ORIGINS` value.

## Current behavior and limitations

- Tavily returns up to three search results per request.
- The reader agent scrapes one selected page and keeps up to 3,000 characters
  of cleaned text.
- Pages that require authentication, execute content only in JavaScript, or
  block automated requests may not be readable.
- Generated reports can contain mistakes. Verify important claims against the
  linked sources before relying on them.
- Research requests consume both Tavily and OpenRouter API quota.

