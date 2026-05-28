import os
import re
import ast
from typing import Dict, Any, List


def _grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 65:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def _score_naming(functions: List[Dict[str, Any]], classes: List[Dict[str, Any]]) -> float:
    """
    Check naming conventions:
    - functions/methods should be snake_case
    - classes should be PascalCase
    Returns 0-100.
    """
    total = 0
    correct = 0

    snake_re = re.compile(r'^[a-z_][a-z0-9_]*$')
    pascal_re = re.compile(r'^[A-Z][a-zA-Z0-9]*$')

    for func in functions:
        name = func.get("name", "")
        # Skip dunder methods (always valid)
        if name.startswith("__") and name.endswith("__"):
            continue
        total += 1
        if snake_re.match(name):
            correct += 1

    for cls in classes:
        name = cls.get("name", "")
        total += 1
        if pascal_re.match(name):
            correct += 1

    if total == 0:
        return 100.0
    return round((correct / total) * 100, 1)


def _score_documentation(functions: List[Dict[str, Any]], classes: List[Dict[str, Any]]) -> float:
    """
    Percentage of functions and classes that have docstrings.
    Returns 0-100.
    """
    total = len(functions) + len(classes)
    if total == 0:
        return 100.0

    documented = sum(1 for f in functions if f.get("docstring")) + \
                 sum(1 for c in classes if c.get("docstring"))

    return round((documented / total) * 100, 1)


def _score_complexity(functions: List[Dict[str, Any]]) -> float:
    """
    Inverse of average cyclomatic complexity, scaled to 0-100.
    Complexity of 1 = 100 points, 10+ = 0 points (linear interpolation).
    """
    if not functions:
        return 100.0

    avg = sum(f.get("cyclomatic_complexity", 1) for f in functions) / len(functions)
    # Map: complexity 1 -> 100, complexity 10 -> 0
    score = max(0.0, (10.0 - avg) / 9.0 * 100.0)
    return round(score, 1)


def _score_line_length(file_path: str) -> float:
    """
    Percentage of lines (non-blank) that are <= 79 characters (PEP 8).
    Returns 0-100.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        non_blank = [l for l in lines if l.strip()]
        if not non_blank:
            return 100.0

        under_79 = sum(1 for l in non_blank if len(l.rstrip('\n')) <= 79)
        return round((under_79 / len(non_blank)) * 100, 1)
    except Exception:
        return 100.0


def classify_file(file_path: str, ast_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Classify a single file. ast_data comes from analyze_source_ast().
    Returns a dict with individual scores and a composite grade.
    """
    functions = ast_data.get("functions", [])
    classes   = ast_data.get("classes", [])

    naming_score      = _score_naming(functions, classes)
    doc_score         = _score_documentation(functions, classes)
    complexity_score  = _score_complexity(functions)
    line_len_score    = _score_line_length(file_path)

    # Weighted composite: naming 25%, docs 30%, complexity 25%, line length 20%
    composite = round(
        naming_score     * 0.25 +
        doc_score        * 0.30 +
        complexity_score * 0.25 +
        line_len_score   * 0.20,
        1
    )

    return {
        "naming_score":     naming_score,
        "doc_score":        doc_score,
        "complexity_score": complexity_score,
        "line_len_score":   line_len_score,
        "composite_score":  composite,
        "grade":            _grade(composite),
        "functions_count":  len(functions),
        "classes_count":    len(classes),
    }


def classify_all(repo_path: str, files: List[str], ast_results: Dict[str, Any]) -> Dict[str, Any]:
    per_file = {}
    for rel_path in files:
        if not rel_path.endswith(".py"):
            continue
        ast_data  = ast_results.get(rel_path, {})
        full_path = os.path.join(repo_path, rel_path) if not os.path.isabs(rel_path) else rel_path
        per_file[rel_path] = classify_file(full_path, ast_data)

    if not per_file:
        return {
            "per_file": {},
            "overall": {
                "composite_score": 0,
                "grade":           "F",
                "naming_score":    0,
                "doc_score":       0,
                "complexity_score": 0,
                "line_len_score":  0,
            },
        }

    def avg(key):
        vals = [v[key] for v in per_file.values()]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    overall = {
        "composite_score":  avg("composite_score"),
        "grade":            _grade(avg("composite_score")),
        "naming_score":     avg("naming_score"),
        "doc_score":        avg("doc_score"),
        "complexity_score": avg("complexity_score"),
        "line_len_score":   avg("line_len_score"),
    }

    return {"per_file": per_file, "overall": overall}
