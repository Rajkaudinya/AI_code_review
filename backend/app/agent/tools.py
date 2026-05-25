import os
import re
import ast
import json
import subprocess
import shutil
from typing import List, Dict, Any, Callable
from git import Repo

def log_status(log_fn: Callable[[str], None], message: str):
    if log_fn:
        log_fn(message)
    print(message)

# ==========================================
# US-02: GitHub Repository Ingest
# ==========================================
def clone_repository(repo_url: str, target_dir: str, log_fn: Callable[[str], None] = None) -> str:
    """Clones a remote git repository or returns the path if already present."""
    log_status(log_fn, f"Starting ingestion for repository: {repo_url}")
    
    # Strip git suffix and extract repo name
    clean_url = repo_url.strip()
    # Replace backslashes with forward slashes for path split safety, then extract base name
    normalized_url = clean_url.replace("\\", "/")
    repo_name = normalized_url.split("/")[-1].replace(".git", "")
    
    # If the extracted name is empty (e.g. trailing slash), fallback
    if not repo_name:
        repo_name = "cloned_repo"
        
    local_path = os.path.join(target_dir, repo_name)

    
    if os.path.exists(local_path):
        log_status(log_fn, f"Repository directory already exists. Removing older cache at: {local_path}")
        try:
            shutil.rmtree(local_path, ignore_errors=True)
        except Exception as e:
            log_status(log_fn, f"Warning during cache cleanup: {str(e)}")
            
    # Check if URL is actually a local directory first to avoid parent git repository matches
    if os.path.isdir(clean_url):
        log_status(log_fn, f"Input is a local directory. Copying content directly...")
        try:
            shutil.copytree(clean_url, local_path, dirs_exist_ok=True)
            return local_path
        except Exception as e:
            log_status(log_fn, f"Error copying local directory: {str(e)}")
            raise e

    log_status(log_fn, f"Cloning remote repository {clean_url} into {local_path}...")
    try:
        Repo.clone_from(clean_url, local_path)
        log_status(log_fn, "Cloning successfully completed.")
        return local_path
    except Exception as e:
        log_status(log_fn, f"Error cloning repository: {str(e)}")
        raise e


# ==========================================
# US-03: AST Code Structure Analyzer
# ==========================================
class ASTMetricsCollector(ast.NodeVisitor):
    def __init__(self):
        self.classes = []
        self.functions = []
        self.imports = []
        self.complexity_score = 1 # Base complexity is 1

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        module = node.module or ""
        for alias in node.names:
            self.imports.append(f"{module}.{alias.name}" if module else alias.name)
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        class_doc = ast.get_docstring(node) or ""
        self.classes.append({
            "name": node.name,
            "line_start": node.lineno,
            "line_end": getattr(node, "end_lineno", node.lineno),
            "docstring": class_doc,
            "methods": [n.name for n in node.body if isinstance(n, ast.FunctionDef)],
            "bases": [ast.unparse(b) for b in node.bases]
        })
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self.analyze_func(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        self.analyze_func(node)
        self.generic_visit(node)

    def analyze_func(self, node):
        func_doc = ast.get_docstring(node) or ""
        
        # Estimate Cyclomatic Complexity by counting branching instructions
        complexity = 1
        for sub_node in ast.walk(node):
            if isinstance(sub_node, (ast.If, ast.While, ast.For, ast.AsyncFor, 
                                     ast.Try, ast.ExceptHandler, ast.With,
                                     ast.BoolOp)):
                complexity += 1
                if isinstance(sub_node, ast.BoolOp):
                    complexity += len(sub_node.values) - 1 # Each boolean operator adds branching
        
        self.functions.append({
            "name": node.name,
            "line_start": node.lineno,
            "line_end": getattr(node, "end_lineno", node.lineno),
            "docstring": func_doc,
            "args_count": len(node.args.args),
            "cyclomatic_complexity": complexity
        })

def analyze_source_ast(file_path: str) -> Dict[str, Any]:
    """Parses a Python file using the built-in AST module to analyze its structural quality."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    lines = content.splitlines()
    total_lines = len(lines)
    blank_lines = sum(1 for line in lines if not line.strip())
    comment_lines = sum(1 for line in lines if line.strip().startswith("#"))

    try:
        root = ast.parse(content, filename=file_path)
        collector = ASTMetricsCollector()
        collector.visit(root)
        
        avg_complexity = 1.0
        if collector.functions:
            avg_complexity = sum(f["cyclomatic_complexity"] for f in collector.functions) / len(collector.functions)

        return {
            "total_lines": total_lines,
            "blank_lines": blank_lines,
            "comment_lines": comment_lines,
            "imports": list(set(collector.imports)),
            "classes": collector.classes,
            "functions": collector.functions,
            "average_complexity": round(avg_complexity, 2),
            "syntax_error": None
        }
    except SyntaxError as e:
        return {
            "total_lines": total_lines,
            "blank_lines": blank_lines,
            "comment_lines": comment_lines,
            "imports": [],
            "classes": [],
            "functions": [],
            "average_complexity": 0,
            "syntax_error": f"SyntaxError at line {e.lineno}, col {e.offset}: {e.msg}"
        }
    except Exception as e:
        return {
            "total_lines": total_lines,
            "blank_lines": blank_lines,
            "comment_lines": comment_lines,
            "imports": [],
            "classes": [],
            "functions": [],
            "average_complexity": 0,
            "syntax_error": f"Error parsing AST: {str(e)}"
        }

# ==========================================
# US-04: Linter Integrations (pylint, flake8)
# ==========================================
def run_linter_tools(repo_path: str, files: List[str], log_fn: Callable[[str], None] = None) -> List[Dict[str, Any]]:
    """Runs pylint and flake8 subprocesses on the targeted files and compiles reports."""
    log_status(log_fn, f"Initiating lint checks on {len(files)} files...")
    findings = []
    
    # Filter for python files only
    py_files = [f for f in files if f.endswith(".py")]
    if not py_files:
        log_status(log_fn, "No Python files found for lint check.")
        return findings

    # Make absolute paths
    abs_files = [os.path.join(repo_path, f) if not os.path.isabs(f) else f for f in py_files]
    
    # 1. RUN PYLINT (Run via `python -m pylint --output-format=json`)
    # Use python executable path for reliability on Windows
    log_status(log_fn, "Executing Pylint...")
    try:
        # Running inside targeted directory
        cmd = ["python", "-m", "pylint", "--output-format=json"] + abs_files
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=repo_path)
        
        # Pylint exits with non-zero on warnings, so we parse stdout
        if result.stdout.strip():
            raw_issues = json.loads(result.stdout)
            for issue in raw_issues:
                # Resolve relative path for frontend consistency
                rel_path = os.path.relpath(issue["path"], repo_path).replace("\\", "/")
                
                # Categorize severity
                pylint_type = issue["type"]
                severity = "INFO"
                if pylint_type in ["error", "fatal"]:
                    severity = "CRITICAL"
                elif pylint_type in ["warning", "refactor"]:
                    severity = "WARNING"
                
                findings.append({
                    "file_path": rel_path,
                    "line_number": issue["line"],
                    "column": issue["column"],
                    "severity": severity,
                    "rule_id": f"pylint:{issue['message-id']}",
                    "message": issue["message"],
                    "code_snippet": issue.get("symbol", ""),
                    "suggestion": f"Pylint rule details: {issue.get('symbol', 'generic')}. Refactor code to align with conventions.",
                    "refactored_code": None
                })
        log_status(log_fn, f"Pylint completed. Found {len(findings)} linter warnings.")
    except Exception as e:
        log_status(log_fn, f"Pylint execution failed (skipping): {str(e)}")

    # 2. RUN FLAKE8 (Run via `python -m flake8 --format=default`)
    log_status(log_fn, "Executing Flake8...")
    flake8_count = 0
    try:
        cmd = ["python", "-m", "flake8"] + abs_files
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=repo_path)
        
        # Parse output format: filepath:line:col: CODE message
        pattern = re.compile(r"^(.*?):(\d+):(\d+):\s+(E\d+|W\d+|F\d+|C\d+|N\d+)\s+(.*)$")
        for line in result.stdout.splitlines():
            match = pattern.match(line)
            if match:
                fpath, line_no, col_no, code, msg = match.groups()
                rel_path = os.path.relpath(fpath, repo_path).replace("\\", "/")
                
                # Check for duplicate Pylint rules to avoid cluttering results
                if any(x["file_path"] == rel_path and x["line_number"] == int(line_no) and code in x["rule_id"] for x in findings):
                    continue
                
                severity = "WARNING"
                if code.startswith("F") or code.startswith("E9"): # Flake8 Syntax error/Fatal
                    severity = "CRITICAL"
                elif code.startswith("W") or code.startswith("E"): # Standard style/warning
                    severity = "WARNING"
                else:
                    severity = "INFO"
                    
                # Read the original line code snippet
                code_snippet = ""
                try:
                    full_fpath = os.path.join(repo_path, rel_path)
                    with open(full_fpath, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        if 0 <= int(line_no) - 1 < len(lines):
                            code_snippet = lines[int(line_no) - 1].strip()
                except Exception:
                    pass
                
                findings.append({
                    "file_path": rel_path,
                    "line_number": int(line_no),
                    "column": int(col_no),
                    "severity": severity,
                    "rule_id": f"flake8:{code}",
                    "message": msg,
                    "code_snippet": code_snippet,
                    "suggestion": f"Fix formatting/syntax rule {code}.",
                    "refactored_code": None
                })
                flake8_count += 1
        log_status(log_fn, f"Flake8 completed. Found {flake8_count} formatting issues.")
    except Exception as e:
        log_status(log_fn, f"Flake8 execution failed (skipping): {str(e)}")

    return findings

# ==========================================
# US-05: Test Runner Integration (pytest)
# ==========================================
def run_pytest_tool(repo_path: str, log_fn: Callable[[str], None] = None) -> Dict[str, Any]:
    """Discovers and runs test cases in the cloned repository via pytest, parsing test failure outputs."""
    log_status(log_fn, "Scanning project structure for test cases...")
    test_result = {
        "passed": 0,
        "failed": 0,
        "total": 0,
        "failures_details": [],
        "output_summary": ""
    }
    
    # Verify pytest is available
    log_status(log_fn, "Running Pytest suite...")
    try:
        # Run pytest with tb=short for concise failure reporting
        cmd = ["python", "-m", "pytest", "--tb=short", "-v"]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=repo_path)
        
        stdout = result.stdout
        test_result["output_summary"] = stdout
        
        # Parse test metrics from last line: e.g., "1 failed, 2 passed in 0.12s"
        summary_line = ""
        for line in reversed(stdout.splitlines()):
            if "passed" in line or "failed" in line or "selected" in line:
                summary_line = line
                break
                
        # Parse counts using regex
        passed_match = re.search(r"(\d+)\s+passed", summary_line)
        failed_match = re.search(r"(\d+)\s+failed", summary_line)
        
        test_result["passed"] = int(passed_match.group(1)) if passed_match else 0
        test_result["failed"] = int(failed_match.group(1)) if failed_match else 0
        
        # Check if tests exist but failed
        if test_result["passed"] == 0 and test_result["failed"] == 0:
            if "collected 0 items" in stdout or "no tests ran" in stdout.lower():
                log_status(log_fn, "Pytest complete: No unit tests discovered.")
                return test_result
            
            # Fallback parsing for general pytest exits
            if "failed" in stdout.lower() and "passed" in stdout.lower():
                # Let's count pass/fail lines
                test_result["passed"] = len(re.findall(r"PASSED", stdout))
                test_result["failed"] = len(re.findall(r"FAILED", stdout))
                
        test_result["total"] = test_result["passed"] + test_result["failed"]
        log_status(log_fn, f"Pytest completed. {test_result['passed']} passed, {test_result['failed']} failed.")
        
        # If there are failures, extract specific failures details
        if test_result["failed"] > 0:
            log_status(log_fn, "Extracting unit test failure traceback details...")
            # Simple parse: find blocks starting with "FAIL" or "___" or failing test lines
            # Pytest outputs failures with double underscores like "____ test_function ____"
            failures = []
            current_fail = []
            in_failure = False
            
            for line in stdout.splitlines():
                if line.startswith("____") and line.endswith("____"):
                    if current_fail:
                        failures.append("\n".join(current_fail))
                    current_fail = [line]
                    in_failure = True
                elif line.startswith("====") and in_failure:
                    # End of failure section
                    if current_fail:
                        failures.append("\n".join(current_fail))
                    in_failure = False
                    current_fail = []
                elif in_failure:
                    current_fail.append(line)
                    
            if current_fail:
                failures.append("\n".join(current_fail))
                
            test_result["failures_details"] = failures[:5] # Max 5 for LLM context size limits
            
    except Exception as e:
        log_status(log_fn, f"Pytest suite execution failed: {str(e)}")
        
    return test_result
