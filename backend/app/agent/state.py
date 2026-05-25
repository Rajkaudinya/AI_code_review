from typing import TypedDict, List, Dict, Any, Optional

class AgentState(TypedDict):
    # Inputs & Setup
    repo_url: Optional[str]
    repo_path: Optional[str]
    auto_fix: bool
    
    # Analysis outputs
    files_to_analyze: List[str]
    ast_results: Dict[str, Any]
    linter_results: List[Dict[str, Any]]
    test_results: Dict[str, Any]
    
    # LLM review & Refactoring output
    findings: List[Dict[str, Any]] # Stores the list of ReviewFinding dicts
    refactored_files: Dict[str, str] # Map of relative file paths to the modified file contents
    
    # Loop management & Logs
    history: List[Dict[str, Any]] # Tracks each round's results and corrections
    status_logs: List[str] # Logs streamed to the client during execution
    iteration: int
    max_iterations: int
    validation_status: str # "unvalidated", "verified_clean", "failed_lint", "failed_tests"
