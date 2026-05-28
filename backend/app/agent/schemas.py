from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING  = "WARNING"
    INFO     = "INFO"


class ReviewFinding(BaseModel):
    file_path:       str            = Field(..., description="Relative path to the file")
    line_number:     int            = Field(..., description="1-based line number")
    column:          Optional[int]  = Field(None)
    severity:        Severity       = Field(...)
    rule_id:         str            = Field(..., description="Violated rule identifier")
    message:         str            = Field(..., description="Explanation of the issue")
    code_snippet:    str            = Field(..., description="Original problematic code")
    suggestion:      str            = Field(..., description="How to fix the issue")
    refactored_code: Optional[str]  = Field(None, description="Drop-in replacement code")


class FileReview(BaseModel):
    file_path: str
    findings:  List[ReviewFinding] = []


class RepoReviewResult(BaseModel):
    repo_url:          Optional[str]    = None
    repo_path:         str
    files_analyzed:    List[str]        = []
    findings:          List[ReviewFinding] = []
    ast_metrics:       Dict[str, Any]   = {}
    linter_summary:    Dict[str, Any]   = {}
    test_summary:      Dict[str, Any]   = {}
    validation_status: str              = "unvalidated"
