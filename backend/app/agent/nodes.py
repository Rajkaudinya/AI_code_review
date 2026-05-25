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
    run_pytest_tool
)

def log_agent_step(state: AgentState, message: str):
    """Utility to append logs to our agent state for SSE streaming."""
    state["status_logs"].append(message)
    print(f"[Agent Log] {message}")

# ==========================================
# NODE 1: Repository Ingestion & Discovery
# ==========================================
def node_ingest(state: AgentState) -> Dict[str, Any]:
    log_agent_step(state, "Step 1: Cloning and Ingesting codebase...")
    
    url = state.get("repo_url")
    if not url:
        # Walk up 4 levels: nodes.py -> agent -> app -> backend -> PROJECT ROOT
        project_root = os.path.dirname(
            os.path.dirname(
                os.path.dirname(
                    os.path.dirname(os.path.abspath(__file__))
                )
            )
        )
        url = os.path.join(project_root, "sandbox")
        log_agent_step(state, f"No URL provided. Defaulting to local sandbox path: {url}")
        
    try:
        local_path = clone_repository(url, settings.STORAGE_DIR, lambda msg: log_agent_step(state, msg))
        state["repo_path"] = local_path
        
        # Discover all python files in the directory, ignoring common virtualenv folders
        files = []
        ignore_dirs = {".git", ".venv", "venv", "__pycache__", "build", "dist", ".pytest_cache"}
        for root, dirs, filenames in os.walk(local_path):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for f in filenames:
                if f.endswith(".py"):
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, local_path).replace("\\", "/")
                    files.append(rel_p)
                    
        state["files_to_analyze"] = files
        log_agent_step(state, f"Codebase ingestion completed. Discovered {len(files)} Python files to review.")
    except Exception as e:
        log_agent_step(state, f"Ingestion node failed with error: {str(e)}")
        state["validation_status"] = "done_review_only"
        
    return state

# ==========================================
# NODE 2: AST & Static Linting & Tests
# ==========================================
def node_static_analysis(state: AgentState) -> Dict[str, Any]:
    repo_path = state.get("repo_path")
    files = state.get("files_to_analyze", [])
    
    log_agent_step(state, "Step 2: Commencing AST and Static Tool analysis...")
    
    # 1. AST Analysis
    ast_reports = {}
    for f in files:
        full_fpath = os.path.join(repo_path, f)
        log_agent_step(state, f"AST parsing: {f}")
        ast_reports[f] = analyze_source_ast(full_fpath)
    state["ast_results"] = ast_reports
    
    # 2. Linters Execution
    linter_findings = run_linter_tools(repo_path, files, lambda msg: log_agent_step(state, msg))
    state["linter_results"] = linter_findings
    
    # 3. Test runner execution
    test_reports = run_pytest_tool(repo_path, lambda msg: log_agent_step(state, msg))
    state["test_results"] = test_reports
    
    log_agent_step(state, "Static Analysis complete. AST indices, linter outputs, and test reports compiled.")
    return state

# ==========================================
# NODE 3: LLM Code Quality & Bug Review (Gemini)
# ==========================================
def node_llm_review(state: AgentState) -> Dict[str, Any]:
    repo_path = state.get("repo_path")
    files = state.get("files_to_analyze", [])
    ast_res = state.get("ast_results", {})
    linter_res = state.get("linter_results", [])
    test_res = state.get("test_results", {})
    iteration = state.get("iteration", 0)
    
    log_agent_step(state, f"Step 3: Querying Gemini model for structured code review (Iteration {iteration})...")
    
    # Check for API key
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        log_agent_step(state, "ERROR: Google Gemini API Key is missing. Review suggestions will be generated using a rule-based mock layer. Please configure GEMINI_API_KEY in backend/.env to unlock complete AI reasoning.")
        # Fallback Mock Review Findings so the app runs cleanly without an API key
        state["findings"] = generate_mock_findings(files, linter_res, test_res)
        return state
        
    try:
        genai.configure(api_key=api_key)
        
        # Read the file contents to provide full context to Gemini
        code_context = []
        for f in files:
            full_fpath = os.path.join(repo_path, f)
            with open(full_fpath, "r", encoding="utf-8", errors="ignore") as file_obj:
                code_context.append(f"### FILE: {f}\n```python\n{file_obj.read()}\n```")
                
        code_str = "\n\n".join(code_context)
        
        # Convert AST reports and linter issues to readable summaries
        linter_summary_lines = []
        for l in linter_res:
            linter_summary_lines.append(f"- {l['file_path']}:{l['line_number']}:{l['column']} [{l['rule_id']}] {l['severity']}: {l['message']} (Snippet: {l['code_snippet']})")
        linter_summary = "\n".join(linter_summary_lines) if linter_summary_lines else "No linter errors found!"
        
        test_summary = f"Pytest Status: {test_res.get('passed', 0)} passed, {test_res.get('failed', 0)} failed.\n"
        if test_res.get("failed", 0) > 0:
            test_summary += "FAILING TRACEBACK DETAILS:\n" + "\n".join(test_res.get("failures_details", []))
            
        ast_summary_lines = []
        for f, report in ast_res.items():
            ast_summary_lines.append(f"- {f}: Total Lines: {report['total_lines']}, Average Cyclomatic Complexity: {report['average_complexity']}, Imports: {report['imports']}")
            if report.get("syntax_error"):
                ast_summary_lines.append(f"  * SYNTAX ERROR: {report['syntax_error']}")
        ast_summary = "\n".join(ast_summary_lines)
        
        system_instructions = (
            "You are an expert senior code reviewer and refactoring agent.\n"
            "Your task is to analyze the provided Python source code files, linter issues, AST structural parameters, and test failures, and generate a list of precise review findings.\n"
            "You MUST output your findings strictly as a JSON array of ReviewFinding objects.\n"
            "Each ReviewFinding in the JSON array must follow this structure:\n"
            "{\n"
            '  "file_path": "relative/path/to/file.py",\n'
            '  "line_number": 12,\n'
            '  "column": 4,\n'
            '  "severity": "CRITICAL" | "WARNING" | "INFO",\n'
            '  "rule_id": "rule:identifier",\n'
            '  "message": "Detailed explanation of the issue, bug, anti-pattern, or styling code smell",\n'
            '  "code_snippet": "Exact original line or multiline block of code in the file",\n'
            '  "suggestion": "Detailed instructions on how to solve this manually",\n'
            '  "refactored_code": "Complete drop-in replacement code that resolves this issue (with correct indentation) or null if it cannot be auto-fixed"\n'
            "}\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. In the JSON, the 'code_snippet' property MUST match a unique, exact contiguous block of characters from the file so that a search-and-replace can be done. If it doesn't match exactly, the agent will fallback to a line replacement. Even so, keep it as close to the original as possible.\n"
            "2. If a unit test is failing, identify which lines in the source code cause this test failure, flag the severity as CRITICAL, and provide the correct replacement in 'refactored_code' to make the test pass!\n"
            "3. If there are syntax or linting errors, prioritize fixing those.\n"
            "4. Make sure 'refactored_code' maintains the exact indentation depth needed for the code to run correctly when substituted. Do not add markdown code markers inside the JSON strings.\n"
            "Your final output MUST be a valid JSON array and nothing else. Do not wrap in extra commentary or text outside the JSON block."
        )
        
        prompt = f"""
SOURCE CODE FILES FOR THE REPOSITORY:
{code_str}

------------------------------------------
AST STATIC ANALYSIS SUMMARY:
{ast_summary}

------------------------------------------
LINTER LOGS (PYLINT & FLAKE8):
{linter_summary}

------------------------------------------
PYTEST FAILURE REPORTS:
{test_summary}

Analyze the information, check for code style issues, bugs, and especially what is breaking any unit tests, and provide the structured review findings in JSON format now.
"""
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(
            contents=prompt,
            generation_config={"response_mime_type": "application/json"},
            system_instruction=system_instructions
        )
        
        # Robustly parse the JSON array
        raw_text = response.text.strip()
        findings_list = []
        try:
            findings_list = json.loads(raw_text)
        except json.JSONDecodeError:
            # Fallback regex extraction of array if raw json parsing fails
            match = re.search(r"(\[.*\])", raw_text, re.DOTALL)
            if match:
                findings_list = json.loads(match.group(1))
            else:
                raise ValueError("Could not parse JSON array from LLM response.")
                
        state["findings"] = findings_list
        log_agent_step(state, f"Gemini review completed. Generated {len(findings_list)} structural findings.")
        
    except Exception as e:
        log_agent_step(state, f"Gemini API request failed: {str(e)}. Falling back to mock findings...")
        state["findings"] = generate_mock_findings(files, linter_res, test_res)
        
    return state

# ==========================================
# NODE 4: Apply Code Refactoring
# ==========================================
def node_apply_fixes(state: AgentState) -> Dict[str, Any]:
    repo_path = state.get("repo_path")
    findings = state.get("findings", [])
    auto_fix = state.get("auto_fix", False)
    
    if not auto_fix:
        log_agent_step(state, "Auto-refactoring is disabled. Skipping code changes.")
        state["refactored_files"] = {}
        return state
        
    log_agent_step(state, "Step 4: Commencing automated code refactoring...")
    refactored = {}
    
    # Group findings by file
    findings_by_file = {}
    for f in findings:
        if f.get("refactored_code") and f.get("code_snippet"):
            findings_by_file.setdefault(f["file_path"], []).append(f)
            
    for rel_path, file_findings in findings_by_file.items():
        full_fpath = os.path.join(repo_path, rel_path)
        if not os.path.exists(full_fpath):
            continue
            
        log_agent_step(state, f"Refactoring file: {rel_path}...")
        try:
            with open(full_fpath, "r", encoding="utf-8", errors="ignore") as file_obj:
                content = file_obj.read()
                
            original_content = content
            
            # Sort findings in reverse line order so that editing lines does not affect offsets for preceding findings
            sorted_findings = sorted(file_findings, key=lambda x: x.get("line_number", 0), reverse=True)
            
            for finding in sorted_findings:
                snippet = finding["code_snippet"]
                replacement = finding["refactored_code"]
                line_no = finding["line_number"]
                
                # Method 1: Exact search-and-replace
                if snippet in content:
                    log_agent_step(state, f"Applying exact block fix on line {line_no}")
                    content = content.replace(snippet, replacement, 1)
                else:
                    # Method 2: Resilient Line-Range Fallback replacement
                    log_agent_step(state, f"Exact block not found on line {line_no}. Executing line-based replacement...")
                    lines = original_content.splitlines()
                    snippet_lines = snippet.splitlines()
                    snippet_len = len(snippet_lines)
                    
                    start_idx = line_no - 1
                    # Ensure within bounds
                    if 0 <= start_idx < len(lines):
                        # Determine ending line: match length of snippet or replace until exact string matching closes
                        end_idx = min(start_idx + snippet_len, len(lines))
                        # Perform replacement
                        lines[start_idx:end_idx] = [replacement]
                        content = "\n".join(lines)
                        
            # Write refactored content back to the workspace
            with open(full_fpath, "w", encoding="utf-8") as file_obj:
                file_obj.write(content)
                
            refactored[rel_path] = content
            log_agent_step(state, f"Successfully refactored and updated: {rel_path}")
        except Exception as e:
            log_agent_step(state, f"Error refactoring {rel_path}: {str(e)}")
            
    state["refactored_files"] = refactored
    return state

# ==========================================
# NODE 5: Refactoring Validation Loop
# ==========================================
def node_validate_fixes(state: AgentState) -> Dict[str, Any]:
    repo_path = state.get("repo_path")
    files = state.get("files_to_analyze", [])
    auto_fix = state.get("auto_fix", False)
    iteration = state.get("iteration", 0)
    history = state.get("history", [])
    
    if not auto_fix or not state.get("refactored_files"):
        log_agent_step(state, "Validation complete (review only). Finalizing state.")
        state["validation_status"] = "unvalidated"
        return state
        
    log_agent_step(state, f"Step 5: Validating refactored fixes (Iteration {iteration})...")
    
    # Re-run static analysis on refactored files
    log_agent_step(state, "Re-running linters on refactored code...")
    new_linter_res = run_linter_tools(repo_path, files, lambda msg: log_agent_step(state, msg))
    
    log_agent_step(state, "Re-running test suites on refactored code...")
    new_test_res = run_pytest_tool(repo_path, lambda msg: log_agent_step(state, msg))
    
    # Store this iteration in history
    history_entry = {
        "iteration": iteration,
        "linter_issues_count": len(new_linter_res),
        "tests_passed": new_test_res.get("passed", 0),
        "tests_failed": new_test_res.get("failed", 0),
        "linter_results": new_linter_res,
        "test_results": new_test_res
    }
    history.append(history_entry)
    state["history"] = history
    
    # Determine new validation status
    failed_tests = new_test_res.get("failed", 0)
    critical_lints = sum(1 for x in new_linter_res if x["severity"] == "CRITICAL")
    
    log_agent_step(state, f"Refactoring stats: {failed_tests} tests failed, {len(new_linter_res)} linter warnings remaining ({critical_lints} critical).")
    
    if failed_tests == 0 and critical_lints == 0:
        log_agent_step(state, "SUCCESS: All refactored fixes successfully compiled! Tests passed, and linters are clear.")
        state["validation_status"] = "verified_clean"
        state["iteration"] = iteration + 1
        # Overwrite current linter/test outputs with the cleaner new results
        state["linter_results"] = new_linter_res
        state["test_results"] = new_test_res
    else:
        # Errors persist!
        if failed_tests > 0:
            state["validation_status"] = "failed_tests"
        else:
            state["validation_status"] = "failed_lint"
            
        state["iteration"] = iteration + 1
        # Overwrite to let next LLM review see these errors
        state["linter_results"] = new_linter_res
        state["test_results"] = new_test_res
        
        log_agent_step(state, "Validation checks failed. Issues remain in refactored code.")
        
    return state

# ==========================================
# FALLBACK MOCK REVIEW FINDINGS GENERATOR
# ==========================================
def generate_mock_findings(files: List[str], linter_res: List[Dict[str, Any]], test_res: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Helper to generate reasonable, structured mock findings from static tools when Gemini is unconfigured."""
    findings = []
    
    # 1. Map existing linter results directly to findings
    for idx, l in enumerate(linter_res):
        snippet = l["code_snippet"]
        refactor = None
        
        # Provide clean, auto-fixing mock replacements for specific standard rules
        if "W0611" in l["rule_id"] or "unused-import" in l["message"].lower():
            # Unused imports: replace with empty string
            refactor = ""
        elif "missing-module-docstring" in l["message"].lower() or "C0114" in l["rule_id"]:
            refactor = '"""\nModule docstring: provides utility code review operations.\n"""\n' + snippet
        elif "missing-function-docstring" in l["message"].lower() or "C0116" in l["rule_id"]:
            refactor = f'    """{l["message"][:-1]}."""\n    ' + snippet.strip()
            
        findings.append({
            "file_path": l["file_path"],
            "line_number": l["line_number"],
            "column": l["column"],
            "severity": l["severity"],
            "rule_id": l["rule_id"],
            "message": l["message"],
            "code_snippet": snippet,
            "suggestion": f"Align with coding standard rules: {l['rule_id']}.",
            "refactored_code": refactor
        })
        
    # 2. Add a critical finding if pytest fails
    if test_res.get("failed", 0) > 0:
        # Check if sample.py is in the files
        sample_file = next((f for f in files if "sample.py" in f), None)
        if sample_file:
            findings.append({
                "file_path": sample_file,
                "line_number": 14,
                "column": 4,
                "severity": "CRITICAL",
                "rule_id": "pytest:test_failure",
                "message": "Failing test detected! The divide() function does not handle ZeroDivisionError as expected by test_sample.py.",
                "code_snippet": "    def divide(self, a, b):\n        return a / b",
                "suggestion": "Introduce try-except block or validation to catch b == 0 and return None or raise standard ValueError.",
                "refactored_code": "    def divide(self, a, b):\n        if b == 0:\n            return None\n        return a / b"
            })
            
    return findings

