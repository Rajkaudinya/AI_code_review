import os
import re
import uuid
import json
import asyncio
from typing import Dict, Any, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

try:
    from github import Github, GithubException
except ImportError:
    Github = None
    GithubException = None

from backend.app.config import settings
from backend.app.agent.graph import review_agent

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for AI-Powered Code Review Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_tasks: Dict[str, Dict[str, Any]] = {}


class ReviewRequest(BaseModel):
    repo_url: Optional[str] = None
    auto_fix: bool = False
    max_iterations: int = 2


class CreatePRRequest(BaseModel):
    github_token: Optional[str] = None


def _run_review(
    task_id: str,
    repo_url: Optional[str],
    auto_fix: bool,
    max_iterations: int,
    user_api_key: Optional[str],
):
    task = active_tasks[task_id]
    task["status"] = "RUNNING"

    try:
        initial_state = {
            "repo_url":          repo_url,
            "repo_path":         None,
            "auto_fix":          auto_fix,
            "user_api_key":      user_api_key or None,
            "files_to_analyze":  [],
            "ast_results":       {},
            "linter_results":    [],
            "test_results":      {},
            "findings":          [],
            "refactored_files":  {},
            "history":           [],
            "status_logs":       task["logs"],
            "iteration":         0,
            "max_iterations":    max_iterations,
            "validation_status": "unvalidated",
            "security_findings": [],
            "original_files":    {},
            "diff_patches":      {},
            "style_report":      {},
        }
        final = review_agent.invoke(initial_state)
        task["result"] = {
            "repo_url":          final.get("repo_url"),
            "repo_path":         final.get("repo_path"),
            "files_analyzed":    final.get("files_to_analyze", []),
            "findings":          final.get("findings", []),
            "ast_metrics":       final.get("ast_results", {}),
            "linter_summary":    {
                "total_issues": len(final.get("linter_results", [])),
                "issues":       final.get("linter_results", []),
            },
            "test_summary":      final.get("test_results", {}),
            "history":           final.get("history", []),
            "validation_status": final.get("validation_status", "unvalidated"),
            "refactored_files":  final.get("refactored_files", {}),
            "security_findings": final.get("security_findings", []),
            "diff_patches":      final.get("diff_patches", {}),
            "style_report":      final.get("style_report", {}),
        }
        task["status"] = "COMPLETED"
    except Exception as e:
        task["status"] = "FAILED"
        task["logs"].append(f"CRITICAL ERROR: {e}")
        print(f"Agent error: {e}")


@app.post("/api/review")
async def start_review(
    request: ReviewRequest,
    background_tasks: BackgroundTasks,
    x_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    task_id = str(uuid.uuid4())
    active_tasks[task_id] = {"status": "PENDING", "logs": ["Task queued."], "result": None}
    background_tasks.add_task(
        _run_review, task_id, request.repo_url, request.auto_fix, request.max_iterations, x_api_key
    )
    return {"task_id": task_id, "status": "PENDING"}


@app.get("/api/review/status/{task_id}")
async def get_status(task_id: str):
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found.")
    return {"task_id": task_id, "status": task["status"], "logs_count": len(task["logs"])}


@app.get("/api/review/result/{task_id}")
async def get_result(task_id: str):
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found.")
    if task["status"] != "COMPLETED":
        raise HTTPException(400, f"Review not completed. Status: {task['status']}")
    return task["result"]


@app.get("/api/review/stream/{task_id}")
async def stream_logs(task_id: str):
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found.")

    async def generator():
        last = 0
        while True:
            logs = task["logs"]
            if last < len(logs):
                for i in range(last, len(logs)):
                    yield f"data: {json.dumps({'message': logs[i]})}\n\n"
                last = len(logs)
            if task["status"] in ("COMPLETED", "FAILED"):
                yield f"data: {json.dumps({'status': task['status'], 'done': True})}\n\n"
                break
            await asyncio.sleep(0.3)

    return StreamingResponse(generator(), media_type="text/event-stream")


@app.get("/api/file")
async def get_file(path: str, task_id: str):
    task = active_tasks.get(task_id)
    if not task or not task.get("result"):
        raise HTTPException(404, "Task or results not found.")

    repo_path = task["result"]["repo_path"]
    full_path = os.path.abspath(os.path.join(repo_path, path))

    if not full_path.startswith(os.path.abspath(settings.STORAGE_DIR)):
        raise HTTPException(403, "Path is outside sandbox.")
    if not os.path.exists(full_path):
        raise HTTPException(404, "File not found.")

    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            return {"file_path": path, "content": f.read()}
    except Exception as e:
        raise HTTPException(500, f"Error reading file: {e}")



@app.get("/api/review/patches/{task_id}")
async def get_patches(task_id: str):
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found.")
    if task["status"] != "COMPLETED":
        raise HTTPException(400, f"Review not completed. Status: {task['status']}")
    patches = task["result"].get("diff_patches", {})
    if not patches:
        raise HTTPException(404, "No patches available. Run with auto_fix=true.")
    return patches



@app.post("/api/review/create-pr/{task_id}")
async def create_pull_request(task_id: str, body: CreatePRRequest):
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found.")
    if task["status"] != "COMPLETED":
        raise HTTPException(400, f"Review not completed. Status: {task['status']}")

    result = task["result"]
    repo_url        = result.get("repo_url", "")
    refactored_files = result.get("refactored_files", {})

    if not repo_url or "github.com" not in repo_url:
        raise HTTPException(400, "Repository is not a GitHub URL.")
    if not refactored_files:
        raise HTTPException(400, "No refactored files to commit. Run with auto_fix=true.")

    github_token = (body.github_token or "").strip() or os.environ.get("GITHUB_TOKEN", "")
    if not github_token:
        raise HTTPException(400, "GitHub token not provided. Pass github_token in body or set GITHUB_TOKEN env var.")

    m = re.search(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$", repo_url.strip())
    if not m:
        raise HTTPException(400, f"Could not parse GitHub owner/repo from URL: {repo_url}")
    owner, repo_name = m.group(1), m.group(2)

    branch_name = f"git-ai/fixes-{task_id[:8]}"

    if Github is None:
        raise HTTPException(500, "PyGithub not installed. Run: pip install PyGithub")

    try:
        gh      = Github(github_token)
        gh_repo = gh.get_repo(f"{owner}/{repo_name}")

        default_branch = gh_repo.default_branch
        base_sha       = gh_repo.get_branch(default_branch).commit.sha

        try:
            gh_repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=base_sha)
        except GithubException as exc:
            if exc.status != 422:
                raise

        for rel_path, new_content in refactored_files.items():
            try:
                file_obj  = gh_repo.get_contents(rel_path, ref=branch_name)
                gh_repo.update_file(
                    path=rel_path,
                    message=f"chore: auto-fix {rel_path} via Git AI",
                    content=new_content,
                    sha=file_obj.sha,
                    branch=branch_name,
                )
            except GithubException as exc:
                if exc.status == 404:
                    gh_repo.create_file(
                        path=rel_path,
                        message=f"chore: auto-fix {rel_path} via Git AI",
                        content=new_content,
                        branch=branch_name,
                    )
                else:
                    raise

        # Create the pull request
        pr = gh_repo.create_pull(
            title=f"[Git AI] Automated code fixes ({task_id[:8]})",
            body=(
                "## Automated Code Review Fixes\n\n"
                "This PR was created automatically by **Git AI** after analyzing the repository.\n\n"
                f"**Files modified:** {', '.join(f'`{p}`' for p in refactored_files.keys())}\n\n"
                "### Summary\n"
                f"- Task ID: `{task_id}`\n"
                f"- Branch: `{branch_name}`\n"
                f"- Files patched: {len(refactored_files)}\n\n"
                "_Review the changes carefully before merging._"
            ),
            head=branch_name,
            base=default_branch,
        )

        return {
            "pr_url":    pr.html_url,
            "pr_number": pr.number,
            "branch":    branch_name,
        }

    except Exception as e:
        raise HTTPException(500, f"Failed to create PR: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
