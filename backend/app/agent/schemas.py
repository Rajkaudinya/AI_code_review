from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Severity(str, Enum):
    CRITICAL = "CRITICAL"  # Bugs, compile errors, severe test failures, or crashes
    WARNING = "WARNING"    # Code smells, anti-patterns, potential performance leaks, linter warnings
    INFO = "INFO"          # Style violations, minor readability suggestions, missing documentation

class ReviewFinding(BaseModel):
    file_path: str = Field(..., description="Relative path to the file containing the issue")
    line_number: int = Field(..., description="1-based line number in the source file")
    column: Optional[int] = Field(None, description="Optional character column number")
    severity: Severity = Field(..., description="Severity category of this issue")
    rule_id: str = Field(..., description="Unique code or label representing the violated rule (e.g., pylint:W0611, ast:complexity)")
    message: str = Field(..., description="Clear explanation of what the problem is and why it matters")
    code_snippet: str = Field(..., description="The original problematic line or block of code")
    suggestion: str = Field(..., description="Instructions detailing how to refactor or fix the issue")
    refactored_code: Optional[str] = Field(None, description="The complete drop-in replacement code snippet to resolve this issue")

class FileReview(BaseModel):
    file_path: str
    findings: List[ReviewFinding] = []

class RepoReviewResult(BaseModel):
    repo_url: Optional[str] = None
    repo_path: str
    files_analyzed: List[str] = []
    findings: List[ReviewFinding] = []
    ast_metrics: Dict[str, Any] = {}
    linter_summary: Dict[str, Any] = {}
    test_summary: Dict[str, Any] = {}
    validation_status: str = "unvalidated" # "unvalidated", "verified_clean", "failed_lint", "failed_tests"
