
import json
import os
import traceback
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents import build_search_agent, build_scraping_agent, writer_chain, critic_chain

app = FastAPI(title="Multi-Agent Research Pipeline API")

_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
allow_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    topic: str


def sse_event(event: str, data: dict) -> str:
    """Format a single Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def run_pipeline_stream(topic: str) -> AsyncGenerator[str, None]:
    """
    Same 4 steps as pipeline.run_research_pipeline, but yields an SSE
    event after each step completes instead of just printing to stdout.
    """
    state = {}

    try:
        # ---- Step 1: Search agent ----
        yield sse_event("status", {"step": "search", "status": "running"})

        search_agent = build_search_agent()
        search_result = search_agent.invoke(
            {"messages": [("user", f"Find recent, reliable and detailed information about: {topic}")]}
        )
        state["search_result"] = search_result["messages"][-1].content

        yield sse_event("status", {"step": "search", "status": "done", "data": state["search_result"]})

        # ---- Step 2: Scraping / reader agent ----
        yield sse_event("status", {"step": "scrape", "status": "running"})

        reader_agent = build_scraping_agent()
        reader_result = reader_agent.invoke({
            "messages": [(
                "user",
                f"Based on the following search results about '{topic}' "
                f"Pick the most relevant URL and scrape it for deeper content. \n\n\n"
                f"Search Results:\n {state['search_result'][:800]}"
            )]
        })
        state["scraped_content"] = reader_result["messages"][-1].content

        yield sse_event("status", {"step": "scrape", "status": "done", "data": state["scraped_content"]})

        # ---- Step 3: Writer chain ----
        yield sse_event("status", {"step": "write", "status": "running"})

        research_combined = (
            f"SEARCH RESULTS : \n {state['search_result']} \n\n"
            f" DETAILED SCRAPED CONTENT \n {state['scraped_content']}"
        )
        state["report"] = writer_chain.invoke({"topic": topic, "research": research_combined})

        yield sse_event("status", {"step": "write", "status": "done", "data": state["report"]})

        # ---- Step 4: Critic chain ----
        yield sse_event("status", {"step": "critic", "status": "running"})

        state["feedback"] = critic_chain.invoke({"report": state["report"]})

        yield sse_event("status", {"step": "critic", "status": "done", "data": state["feedback"]})

        # ---- Final combined payload ----
        yield sse_event("complete", state)

    except Exception as exc:
        traceback.print_exc()
        yield sse_event("error", {"message": str(exc)})


@app.post("/api/research/stream")
async def research_stream(req: ResearchRequest):
    """
    POST { "topic": "..." } -> text/event-stream of progress events.

    Events:
      status   { step: "search"|"scrape"|"write"|"critic", status: "running"|"done", data?: str }
      complete { search_result, scraped_content, report, feedback }
      error    { message }
    """
    return StreamingResponse(
        run_pipeline_stream(req.topic),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering if behind nginx
        },
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}
