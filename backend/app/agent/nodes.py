import os
import json
import re
import google.generativeai as genai
from typing import Dict, Any, List
from backend.app.config import settings
from backend.app.agent.state import AgentState
from backend.app.agent.tools import (
    clone_repository,
    analyze_source_ast,
    run_linter_tools,
    run_pytest_tool,
    run_bandit_tool,
    generate_unified_diffs,
)
from backend.app.agent.classifier import classify_all


def _log(state: AgentState, msg: str):
    state["status_logs"].append(msg)
    print(f"[Agent] {msg}")


def node_ingest(state: AgentState) -> Dict[str, Any]:
    _log(state, "Step 1: Ingesting repository...")
    url = state.get("repo_url")
    if not url:
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        url = os.path.join(project_root, "sandbox")
        _log(state, f"No URL provided — using sandbox: {url}")

    try:
        local_path = clone_repository(url, settings.STORAGE_DIR, lambda m: _log(state, m))
        state["repo_path"] = local_path

        ignore = {".git", ".venv", "venv", "__pycache__", "build", "dist", ".pytest_cache"}
        files  = []
        for root, dirs, filenames in os.walk(local_path):
            dirs[:] = [d for d in dirs if d not in ignore]
            for f in filenames:
                if f.endswith(".py"):
                    rel = os.path.relpath(os.path.join(root, f), local_path).replace("\\", "/")
                    files.append(rel)

        state["files_to_analyze"] = files
        _log(state, f"Ingestion complete. Found {len(files)} Python files.")
    except Exception as e:
        _log(state, f"Ingestion failed: {e}")
        state["validation_status"] = "failed_ingest"

    return state


def node_static_analysis(state: AgentState) -> Dict[str, Any]:
    repo_path = state.get("repo_path")
    files     = state.get("files_to_analyze", [])

    if not repo_path:
        _log(state, "Static analysis skipped — ingest failed.")
        return state

    _log(state, "Step 2: Running static analysis (AST + linters + tests + security + style)...")

    # AST analysis
    ast_reports = {}
    for f in files:
        _log(state, f"AST: {f}")
        ast_reports[f] = analyze_source_ast(os.path.join(repo_path, f))
    state["ast_results"] = ast_reports

    # Linters + tests
    state["linter_results"] = run_linter_tools(repo_path, files, lambda m: _log(state, m))
    state["test_results"]   = run_pytest_tool(repo_path,         lambda m: _log(state, m))

    _log(state, "Running security analysis...")
    state["security_findings"] = run_bandit_tool(repo_path, files, lambda m: _log(state, m))

    _log(state, "Running code style classification...")
    state["style_report"] = classify_all(repo_path, files, ast_reports)

    _log(state, "Static analysis complete.")
    return state


def node_llm_review(state: AgentState) -> Dict[str, Any]:
    repo_path  = state.get("repo_path")
    files      = state.get("files_to_analyze", [])
    ast_res    = state.get("ast_results", {})
    linter_res = state.get("linter_results", [])
    test_res   = state.get("test_results", {})
    iteration  = state.get("iteration", 0)

    if not repo_path:
        _log(state, "LLM review skipped — ingest failed.")
        state["findings"] = []
        return state

    _log(state, f"Step 3: Gemini code review (iteration {iteration})...")

    # Prefer per-request key from state over the global env var to avoid race conditions.
    api_key = state.get("user_api_key") or settings.GEMINI_API_KEY
    if not api_key:
        _log(state, "GEMINI_API_KEY missing — using rule-based mock findings.")
        state["findings"] = _mock_findings(files, linter_res, test_res)
        return state

    try:
        genai.configure(api_key=api_key)

        code_ctx = []
        for f in files:
            with open(os.path.join(repo_path, f), "r", encoding="utf-8", errors="ignore") as fp:
                code_ctx.append(f"### FILE: {f}\n```python\n{fp.read()}\n```")

        linter_lines = [
            f"- {l['file_path']}:{l['line_number']}:{l.get('column') or 0} [{l['rule_id']}] {l['severity']}: {l['message']}"
            for l in linter_res
        ] or ["No linter issues."]

        test_lines = f"Pytest: {test_res.get('passed', 0)} passed, {test_res.get('failed', 0)} failed."
        if test_res.get("failed", 0) > 0:
            test_lines += "\nFailing details:\n" + "\n".join(test_res.get("failures_details", []))

        ast_lines = [
            f"- {f}: {r['total_lines']} lines, complexity {r['average_complexity']}, imports {r['imports']}"
            + (f"\n  SYNTAX ERROR: {r['syntax_error']}" if r.get("syntax_error") else "")
            for f, r in ast_res.items()
        ]

        system = (
            "You are an expert senior code reviewer. Analyze the provided Python files, linter output, AST metrics, "
            "and test failures. Output a JSON array of findings, each with:\n"
            '{"file_path","line_number","column","severity":"CRITICAL|WARNING|INFO","rule_id","message",'
            '"code_snippet","suggestion","refactored_code"}\n'
            "RULES: code_snippet must be an exact contiguous match from the file. refactored_code must have correct "
            "indentation and no markdown markers. Prioritize fixing failing tests and syntax errors. "
            "Output valid JSON array only — no extra text."
        )
        prompt = (
            f"SOURCE FILES:\n{chr(10).join(code_ctx)}\n\n"
            f"AST METRICS:\n{chr(10).join(ast_lines)}\n\n"
            f"LINTER:\n{chr(10).join(linter_lines)}\n\n"
            f"TESTS:\n{test_lines}\n\n"
            "Provide structured review findings in JSON now."
        )

        model    = genai.GenerativeModel("gemini-2.5-flash", system_instruction=system)
        response = model.generate_content(
            contents=prompt,
            generation_config={"response_mime_type": "application/json"},
        )
        raw = response.text.strip()
        try:
            findings = json.loads(raw)
        except json.JSONDecodeError:
            m = re.search(r"(\[.*\])", raw, re.DOTALL)
            findings = json.loads(m.group(1)) if m else []

        state["findings"] = findings
        _log(state, f"Gemini review complete: {len(findings)} findings.")
    except Exception as e:
        _log(state, f"Gemini request failed: {e} — falling back to mock.")
        state["findings"] = _mock_findings(files, linter_res, test_res)

    return state


def node_apply_fixes(state: AgentState) -> Dict[str, Any]:
    if not state.get("auto_fix"):
        _log(state, "Auto-fix disabled — skipping refactoring.")
        state["refactored_files"] = {}
        state["original_files"]   = {}
        state["diff_patches"]     = {}
        return state

    repo_path = state.get("repo_path")
    findings  = state.get("findings", [])
    _log(state, "Step 4: Applying automated fixes...")

    by_file: Dict[str, list] = {}
    for f in findings:
        if f.get("refactored_code") and f.get("code_snippet"):
            by_file.setdefault(f["file_path"], []).append(f)

    original_files: Dict[str, str] = {}
    for rel_path in by_file:
        full = os.path.join(repo_path, rel_path)
        if os.path.exists(full):
            try:
                with open(full, "r", encoding="utf-8", errors="ignore") as fp:
                    original_files[rel_path] = fp.read()
            except Exception:
                pass

    refactored = {}
    for rel_path, file_findings in by_file.items():
        full = os.path.join(repo_path, rel_path)
        if not os.path.exists(full):
            continue
        _log(state, f"Patching {rel_path}...")
        try:
            with open(full, "r", encoding="utf-8", errors="ignore") as fp:
                content = original = fp.read()

            for finding in sorted(file_findings, key=lambda x: x.get("line_number", 0), reverse=True):
                snippet     = finding["code_snippet"]
                replacement = finding["refactored_code"]
                line_no     = finding["line_number"]
                if snippet in content:
                    content = content.replace(snippet, replacement, 1)
                else:
                    lines = original.splitlines()
                    sl    = snippet.splitlines()
                    si    = line_no - 1
                    if 0 <= si < len(lines):
                        lines[si : si + len(sl)] = [replacement]
                        content = "\n".join(lines)

            with open(full, "w", encoding="utf-8") as fp:
                fp.write(content)
            refactored[rel_path] = content
            _log(state, f"Patched {rel_path}.")
        except Exception as e:
            _log(state, f"Error patching {rel_path}: {e}")

    diff_patches = generate_unified_diffs(original_files, refactored)
    _log(state, f"Generated {len(diff_patches)} diff patch(es).")

    state["refactored_files"] = refactored
    state["original_files"]   = original_files
    state["diff_patches"]     = diff_patches
    return state


def node_validate_fixes(state: AgentState) -> Dict[str, Any]:
    if not state.get("auto_fix") or not state.get("refactored_files"):
        _log(state, "Validation skipped (review-only mode).")
        state["validation_status"] = "unvalidated"
        return state

    repo_path = state.get("repo_path")
    files     = state.get("files_to_analyze", [])
    iteration = state.get("iteration", 0)
    history   = state.get("history", [])

    _log(state, f"Step 5: Validating fixes (iteration {iteration})...")

    new_lints = run_linter_tools(repo_path, files, lambda m: _log(state, m))
    new_tests = run_pytest_tool(repo_path,         lambda m: _log(state, m))

    history.append({
        "iteration":          iteration,
        "linter_issues_count": len(new_lints),
        "tests_passed":       new_tests.get("passed", 0),
        "tests_failed":       new_tests.get("failed", 0),
        "linter_results":     new_lints,
        "test_results":       new_tests,
    })
    state["history"]        = history
    state["iteration"]      = iteration + 1
    state["linter_results"] = new_lints
    state["test_results"]   = new_tests

    failed_tests  = new_tests.get("failed", 0)
    critical_lints = sum(1 for x in new_lints if x["severity"] == "CRITICAL")

    if failed_tests == 0 and critical_lints == 0:
        _log(state, "Validation passed — code is clean.")
        state["validation_status"] = "verified_clean"
    else:
        state["validation_status"] = "failed_tests" if failed_tests > 0 else "failed_lint"
        _log(state, f"Validation failed: {failed_tests} test failures, {critical_lints} critical lints.")

    return state


def _mock_findings(files: List[str], linter_res: List[Dict[str, Any]], test_res: Dict[str, Any]) -> List[Dict[str, Any]]:
    findings = []
    for l in linter_res:
        snippet  = l["code_snippet"]
        refactor = None
        if "W0611" in l["rule_id"] or "unused-import" in l["message"].lower():
            refactor = ""
        elif "missing-module-docstring" in l["message"].lower() or "C0114" in l["rule_id"]:
            refactor = f'"""\nModule docstring.\n"""\n{snippet}'
        elif "missing-function-docstring" in l["message"].lower() or "C0116" in l["rule_id"]:
            refactor = f'    """{l["message"]}"""\n    {snippet.strip()}'
        findings.append({**l, "suggestion": f"Fix rule {l['rule_id']}.", "refactored_code": refactor})

    if test_res.get("failed", 0) > 0:
        sample = next((f for f in files if "sample.py" in f), None)
        if sample:
            findings.append({
                "file_path":      sample,
                "line_number":    14,
                "column":         4,
                "severity":       "CRITICAL",
                "rule_id":        "pytest:test_failure",
                "message":        "divide() does not handle ZeroDivisionError — test_divide_by_zero fails.",
                "code_snippet":   "    def divide(self, a, b):\n        return a / b",
                "suggestion":     "Return None when b == 0.",
                "refactored_code": "    def divide(self, a, b):\n        if b == 0:\n            return None\n        return a / b",
            })
    return findings
