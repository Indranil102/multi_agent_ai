# Research Pipeline UI

A React + Tailwind frontend on top of your existing multi-agent pipeline
(`pipeline.py` → search agent → scraping agent → writer chain → critic chain),
served through a small FastAPI backend that streams progress live.

```
research-ui/
├── backend/
│   ├── main.py            FastAPI app — wraps run_research_pipeline, streams via SSE
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx         Main UI: pipeline rail + tabbed output viewer
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── vite.config.js
```

## How it fits with your existing code

`backend/main.py` does NOT replace `pipeline.py` — it re-implements the same
4 steps as an async generator so it can `yield` a progress event after each
step instead of just `print()`-ing. It imports `build_search_agent`,
`build_scraping_agent`, `writer_chain`, and `critic_chain` directly from your
`agents.py`, unchanged.

**You need to copy your real `agents.py` and `tools.py` into `backend/`**
before running it — I only had `pipeline.py`, not those two files, so I
couldn't include them.

```bash
cp /path/to/your/project/agents.py backend/
cp /path/to/your/project/tools.py backend/
```

Your original `pipeline.py` (terminal version) still works exactly as before
— this doesn't touch it. The backend is a separate entry point.

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          
pip install -r requirements.txt
pip install -r ../requirements.txt   



uvicorn main:app --reload --port 8000
```

Confirm it's up: open http://localhost:8000/api/health → `{"status": "ok"}`

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints (default http://localhost:5173).

## Using it

1. Type a topic, click **Run pipeline** (or press Enter).
2. The rail at the top lights up stage by stage as each agent finishes —
   amber + spinner while running, teal when done.
3. Click any tab (Search results / Scraped content / Report / Critic feedback)
   to read that stage's output — tabs unlock as their stage completes.
4. **Copy** button on each output panel copies the raw text.

If a stage throws an exception, the rail node turns red, an error banner
appears with the exception message, and remaining stages are marked as
not completed — nothing silently hangs.

## Notes / things you may want to tweak

- **CORS**: `backend/main.py` only allows `localhost:5173` (Vite's default
  port). If you change the frontend port, update `allow_origins` in `main.py`.
- **API URL**: hardcoded as `http://localhost:8000` in `frontend/src/App.jsx`
  (`API_BASE` constant). Change this if you deploy the backend elsewhere.
- **Long-running agents**: if any of your agents/chains take a long time,
  the SSE connection stays open the whole time — no timeout is set
  client-side, but check your reverse proxy / hosting config if you deploy
  this, since some proxies kill idle streaming connections after ~30-60s.
- **Markdown rendering**: the report/feedback are currently rendered as
  plain preformatted text. If `writer_chain` or `critic_chain` return
  Markdown, you may want to add a renderer (e.g. `react-markdown`) instead
  of the `<pre>` tag in `App.jsx`.
