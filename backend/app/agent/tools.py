import os
import re
import ast
import json
import difflib
import subprocess
import shutil
from typing import List, Dict, Any, Callable
from git import Repo


def _log(log_fn: Callable, msg: str):
    if log_fn:
        log_fn(msg)
    print(msg)


# ── Repository ingestion ──────────────────────────────────────────────────────

def clone_repository(repo_url: str, target_dir: str, log_fn: Callable = None) -> str:
    clean_url  = repo_url.strip()
    repo_name  = clean_url.replace("\\", "/").split("/")[-1].replace(".git", "") or "cloned_repo"
    local_path = os.path.join(target_dir, repo_name)

    if os.path.exists(local_path):
        _log(log_fn, f"Removing cached directory: {local_path}")
        shutil.rmtree(local_path, ignore_errors=True)

    if os.path.isdir(clean_url):
        _log(log_fn, "Input is a local directory. Copying...")
        shutil.copytree(clean_url, local_path, dirs_exist_ok=True)
        return local_path

    _log(log_fn, f"Cloning {clean_url} → {local_path}")
    Repo.clone_from(clean_url, local_path)
    _log(log_fn, "Clone complete.")
    return local_path


# ── AST analysis ──────────────────────────────────────────────────────────────

class ASTMetricsCollector(ast.NodeVisitor):
    def __init__(self):
        self.classes    = []
        self.functions  = []
        self.imports    = []

    def visit_Import(self, node):
        for a in node.names:
            self.imports.append(a.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        mod = node.module or ""
        for a in node.names:
            self.imports.append(f"{mod}.{a.name}" if mod else a.name)
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        self.classes.append({
            "name":       node.name,
            "line_start": node.lineno,
            "line_end":   getattr(node, "end_lineno", node.lineno),
            "docstring":  ast.get_docstring(node) or "",
            "methods":    [n.name for n in node.body if isinstance(n, ast.FunctionDef)],
            "bases":      [ast.unparse(b) for b in node.bases],
        })
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self._record_func(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        self._record_func(node)
        self.generic_visit(node)

    def _record_func(self, node):
        complexity = 1
        for n in ast.walk(node):
            if isinstance(n, (ast.If, ast.While, ast.For, ast.AsyncFor,
                               ast.Try, ast.ExceptHandler, ast.With, ast.BoolOp)):
                complexity += 1
                if isinstance(n, ast.BoolOp):
                    complexity += len(n.values) - 1
        self.functions.append({
            "name":                node.name,
            "line_start":          node.lineno,
            "line_end":            getattr(node, "end_lineno", node.lineno),
            "docstring":           ast.get_docstring(node) or "",
            "args_count":          len(node.args.args),
            "cyclomatic_complexity": complexity,
        })


def analyze_source_ast(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    lines        = content.splitlines()
    total_lines  = len(lines)
    blank_lines  = sum(1 for l in lines if not l.strip())
    comment_lines = sum(1 for l in lines if l.strip().startswith("#"))

    try:
        root      = ast.parse(content, filename=file_path)
        collector = ASTMetricsCollector()
        collector.visit(root)
        avg = (sum(f["cyclomatic_complexity"] for f in collector.functions) / len(collector.functions)
               if collector.functions else 1.0)
        return {
            "total_lines":       total_lines,
            "blank_lines":       blank_lines,
            "comment_lines":     comment_lines,
            "imports":           list(set(collector.imports)),
            "classes":           collector.classes,
            "functions":         collector.functions,
            "average_complexity": round(avg, 2),
            "syntax_error":      None,
        }
    except SyntaxError as e:
        return {
            "total_lines": total_lines, "blank_lines": blank_lines,
            "comment_lines": comment_lines, "imports": [], "classes": [],
            "functions": [], "average_complexity": 0,
            "syntax_error": f"SyntaxError at line {e.lineno}, col {e.offset}: {e.msg}",
        }
    except Exception as e:
        return {
            "total_lines": total_lines, "blank_lines": blank_lines,
            "comment_lines": comment_lines, "imports": [], "classes": [],
            "functions": [], "average_complexity": 0,
            "syntax_error": f"Parse error: {e}",
        }


# ── Linters ───────────────────────────────────────────────────────────────────

def run_linter_tools(repo_path: str, files: List[str], log_fn: Callable = None) -> List[Dict[str, Any]]:
    py_files  = [f for f in files if f.endswith(".py")]
    abs_files = [os.path.join(repo_path, f) if not os.path.isabs(f) else f for f in py_files]
    findings  = []

    if not py_files:
        return findings

    # Pylint
    _log(log_fn, "Running Pylint...")
    try:
        result = subprocess.run(
            ["python", "-m", "pylint", "--output-format=json"] + abs_files,
            capture_output=True, text=True, cwd=repo_path,
        )
        if result.stdout.strip():
            for issue in json.loads(result.stdout):
                rel   = os.path.relpath(issue["path"], repo_path).replace("\\", "/")
                ptype = issue["type"]
                sev   = "CRITICAL" if ptype in ("error", "fatal") else "WARNING" if ptype in ("warning", "refactor") else "INFO"
                findings.append({
                    "file_path":      rel,
                    "line_number":    issue["line"],
                    "column":         issue["column"],
                    "severity":       sev,
                    "rule_id":        f"pylint:{issue['message-id']}",
                    "message":        issue["message"],
                    "code_snippet":   issue.get("symbol", ""),
                    "suggestion":     f"Fix pylint rule: {issue.get('symbol', 'generic')}",
                    "refactored_code": None,
                })
        _log(log_fn, f"Pylint: {len(findings)} issues.")
    except Exception as e:
        _log(log_fn, f"Pylint failed: {e}")

    # Flake8
    _log(log_fn, "Running Flake8...")
    flake8_count = 0
    try:
        result  = subprocess.run(["python", "-m", "flake8"] + abs_files, capture_output=True, text=True, cwd=repo_path)
        pattern = re.compile(r"^(.*?):(\d+):(\d+):\s+(E\d+|W\d+|F\d+|C\d+|N\d+)\s+(.*)$")
        for line in result.stdout.splitlines():
            m = pattern.match(line)
            if not m:
                continue
            fpath, line_no, col_no, code, msg = m.groups()
            rel = os.path.relpath(fpath, repo_path).replace("\\", "/")
            if any(x["file_path"] == rel and x["line_number"] == int(line_no) and code in x["rule_id"] for x in findings):
                continue
            sev = "CRITICAL" if code.startswith(("F", "E9")) else "WARNING" if code[0] in ("W", "E") else "INFO"
            snippet = ""
            try:
                full = os.path.join(repo_path, rel)
                with open(full, "r", encoding="utf-8", errors="ignore") as fp:
                    src_lines = fp.readlines()
                    if 0 <= int(line_no) - 1 < len(src_lines):
                        snippet = src_lines[int(line_no) - 1].strip()
            except Exception:
                pass
            findings.append({
                "file_path":      rel,
                "line_number":    int(line_no),
                "column":         int(col_no),
                "severity":       sev,
                "rule_id":        f"flake8:{code}",
                "message":        msg,
                "code_snippet":   snippet,
                "suggestion":     f"Fix rule {code}.",
                "refactored_code": None,
            })
            flake8_count += 1
        _log(log_fn, f"Flake8: {flake8_count} issues.")
    except Exception as e:
        _log(log_fn, f"Flake8 failed: {e}")

    return findings


# ── Pytest ────────────────────────────────────────────────────────────────────

def run_pytest_tool(repo_path: str, log_fn: Callable = None) -> Dict[str, Any]:
    result = {"passed": 0, "failed": 0, "total": 0, "failures_details": [], "output_summary": ""}
    _log(log_fn, "Running pytest...")
    try:
        proc   = subprocess.run(["python", "-m", "pytest", "--tb=short", "-v"], capture_output=True, text=True, cwd=repo_path)
        stdout = proc.stdout
        result["output_summary"] = stdout

        summary = next((l for l in reversed(stdout.splitlines()) if "passed" in l or "failed" in l), "")
        pm = re.search(r"(\d+)\s+passed", summary)
        fm = re.search(r"(\d+)\s+failed", summary)
        result["passed"] = int(pm.group(1)) if pm else 0
        result["failed"] = int(fm.group(1)) if fm else 0

        if result["passed"] == 0 and result["failed"] == 0:
            result["passed"] = len(re.findall(r"PASSED", stdout))
            result["failed"] = len(re.findall(r"FAILED", stdout))

        result["total"] = result["passed"] + result["failed"]
        _log(log_fn, f"Pytest: {result['passed']} passed, {result['failed']} failed.")

        if result["failed"] > 0:
            failures, cur, in_fail = [], [], False
            for line in stdout.splitlines():
                if line.startswith("____") and line.endswith("____"):
                    if cur:
                        failures.append("\n".join(cur))
                    cur, in_fail = [line], True
                elif line.startswith("====") and in_fail:
                    if cur:
                        failures.append("\n".join(cur))
                    in_fail, cur = False, []
                elif in_fail:
                    cur.append(line)
            if cur:
                failures.append("\n".join(cur))
            result["failures_details"] = failures[:5]
    except Exception as e:
        _log(log_fn, f"Pytest failed: {e}")
    return result


# ── Bandit security scanner ───────────────────────────────────────────────────

def run_bandit_tool(repo_path: str, files: List[str], log_fn: Callable = None) -> List[Dict[str, Any]]:
    py_files  = [f for f in files if f.endswith(".py")]
    abs_files = [os.path.join(repo_path, f) if not os.path.isabs(f) else f for f in py_files]
    findings  = []

    if not py_files:
        return findings

    _log(log_fn, "Running Bandit security scan...")
    try:
        result = subprocess.run(
            ["python", "-m", "bandit", "-r", "-f", "json"] + abs_files,
            capture_output=True, text=True, cwd=repo_path,
        )
        raw = result.stdout.strip()
        if not raw:
            _log(log_fn, "Bandit returned no output.")
            return findings

        data = json.loads(raw)
        for issue in data.get("results", []):
            file_abs = issue.get("filename", "")
            try:
                rel = os.path.relpath(file_abs, repo_path).replace("\\", "/")
            except ValueError:
                rel = file_abs

            findings.append({
                "file_path":   rel,
                "line_number": issue.get("line_number", 0),
                "severity":    issue.get("issue_severity", "LOW"),
                "confidence":  issue.get("issue_confidence", "LOW"),
                "test_id":     issue.get("test_id", ""),
                "test_name":   issue.get("test_name", ""),
                "issue_text":  issue.get("issue_text", ""),
                "code":        issue.get("code", "").strip(),
                "cwe":         issue.get("issue_cwe", {}).get("id") if isinstance(issue.get("issue_cwe"), dict) else None,
            })

        _log(log_fn, f"Bandit: {len(findings)} security issues found.")
    except json.JSONDecodeError:
        _log(log_fn, "Bandit JSON parse error — skipping security scan.")
    except FileNotFoundError:
        _log(log_fn, "Bandit not installed — skipping security scan.")
    except Exception as e:
        _log(log_fn, f"Bandit failed: {e}")

    return findings


# ── Unified diff generation ───────────────────────────────────────────────────

def generate_unified_diffs(
    original_files: Dict[str, str],
    patched_files:  Dict[str, str],
) -> Dict[str, str]:
    patches = {}
    for rel_path, new_content in patched_files.items():
        original = original_files.get(rel_path, "")
        if original == new_content:
            continue  # No changes

        orig_lines = original.splitlines(keepends=True)
        new_lines  = new_content.splitlines(keepends=True)

        diff = "".join(difflib.unified_diff(
            orig_lines,
            new_lines,
            fromfile=f"a/{rel_path}",
            tofile=f"b/{rel_path}",
            lineterm="",
        ))
        if diff:
            patches[rel_path] = diff

    return patches
