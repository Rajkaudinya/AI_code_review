import os
import uuid
import json
import asyncio
from typing import Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.app.config import settings
from backend.app.agent.graph import review_agent

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for AI-Powered Code Review and Refactoring Agent",
    version="1.0.0"
)

# Enable CORS for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active tasks
# Maps task_id -> { "status": "PENDING"|"RUNNING"|"COMPLETED"|"FAILED", "logs": List[str], "result": Dict, "state": Dict }
active_tasks: Dict[str, Dict[str, Any]] = {}

class ReviewRequest(BaseModel):
    repo_url: Optional[str] = None
    auto_fix: bool = False
    max_iterations: int = 2

def background_review_runner(task_id: str, repo_url: Optional[str], auto_fix: bool, max_iterations: int, user_api_key: Optional[str]):
    task = active_tasks[task_id]
    task["status"] = "RUNNING"
    
    # Set the user-provided API key in environment if supplied
    if user_api_key:
        os.environ["GEMINI_API_KEY"] = user_api_key
        
    try:
        # Construct initial state
        initial_state = {
            "repo_url": repo_url,
            "repo_path": None,
            "auto_fix": auto_fix,
            "files_to_analyze": [],
            "ast_results": {},
            "linter_results": [],
            "test_results": {},
            "findings": [],
            "refactored_files": {},
            "history": [],
            "status_logs": task["logs"], # Pass reference to stream logs in real-time!
            "iteration": 0,
            "max_iterations": max_iterations,
            "validation_status": "unvalidated"
        }
        
        # Execute LangGraph review agent workflow
        final_state = review_agent.invoke(initial_state)
        
        # Compile result object
        task["result"] = {
            "repo_url": final_state.get("repo_url"),
            "repo_path": final_state.get("repo_path"),
            "files_analyzed": final_state.get("files_to_analyze", []),
            "findings": final_state.get("findings", []),
            "ast_metrics": final_state.get("ast_results", {}),
            "linter_summary": {
                "total_issues": len(final_state.get("linter_results", [])),
                "issues": final_state.get("linter_results", [])
            },
            "test_summary": final_state.get("test_results", {}),
            "history": final_state.get("history", []),
            "validation_status": final_state.get("validation_status", "unvalidated"),
            "refactored_files": final_state.get("refactored_files", {})
        }
        task["status"] = "COMPLETED"
    except Exception as e:
        task["status"] = "FAILED"
        task["logs"].append(f"CRITICAL SYSTEM ERROR during review execution: {str(e)}")
        print(f"Agent Execution Error: {str(e)}")

# ==========================================
# REST API ENDPOINTS
# ==========================================
@app.post("/api/review")
async def start_code_review(
    request: ReviewRequest, 
    background_tasks: BackgroundTasks,
    x_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key")
):
    """Triggers the LangGraph codebase review loop asynchronously."""
    task_id = str(uuid.uuid4())
    
    # Instantiate task structure
    active_tasks[task_id] = {
        "status": "PENDING",
        "logs": ["Task initialized in backend queue."],
        "result": None
    }
    
    # Run the agent execution in a background thread
    background_tasks.add_task(
        background_review_runner,
        task_id=task_id,
        repo_url=request.repo_url,
        auto_fix=request.auto_fix,
        max_iterations=request.max_iterations,
        user_api_key=x_api_key
    )
    
    return {"task_id": task_id, "status": "PENDING"}

@app.get("/api/review/status/{task_id}")
async def get_review_status(task_id: str):
    """Fetches the state and progress status of a running review."""
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found.")
    return {
        "task_id": task_id,
        "status": task["status"],
        "logs_count": len(task["logs"])
    }

@app.get("/api/review/result/{task_id}")
async def get_review_result(task_id: str):
    """Fetches the completed structural findings and reports of a review."""
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found.")
    if task["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail=f"Review is not completed yet. Current status: {task['status']}")
    return task["result"]

@app.get("/api/review/stream/{task_id}")
async def stream_review_logs(task_id: str):
    """SSE endpoint streaming live execution logs from the running LangGraph agent."""
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found.")
        
    async def log_generator():
        last_idx = 0
        while True:
            logs = task["logs"]
            if last_idx < len(logs):
                for i in range(last_idx, len(logs)):
                    yield f"data: {json.dumps({'message': logs[i]})}\n\n"
                last_idx = len(logs)
                
            if task["status"] in ["COMPLETED", "FAILED"]:
                # Stream final termination packet
                yield f"data: {json.dumps({'status': task['status'], 'done': True})}\n\n"
                break
                
            await asyncio.sleep(0.3)
            
    return StreamingResponse(log_generator(), media_type="text/event-stream")

# Expose local file contents (for code viewer navigation)
@app.get("/api/file")
async def get_file_content(path: str, task_id: str):
    """Exposes content of target codebase files to load into the dashboard code editor."""
    task = active_tasks.get(task_id)
    if not task or not task.get("result"):
        raise HTTPException(status_code=404, detail="Task or analysis results not found.")
        
    repo_path = task["result"]["repo_path"]
    full_path = os.path.abspath(os.path.join(repo_path, path))
    
    # Security: Ensure requested file is inside our designated storage area
    if not full_path.startswith(os.path.abspath(settings.STORAGE_DIR)):
        raise HTTPException(status_code=403, detail="Access denied. Path is outside sandbox.")
        
    if not os.path.exists(full_path):
         raise HTTPException(status_code=404, detail="File not found.")
         
    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return {"file_path": path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
