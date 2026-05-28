from typing import TypedDict, List, Dict, Any, Optional


class AgentState(TypedDict):
    repo_url:          Optional[str]
    repo_path:         Optional[str]
    auto_fix:          bool
    user_api_key:      Optional[str]
    files_to_analyze:  List[str]
    ast_results:       Dict[str, Any]
    linter_results:    List[Dict[str, Any]]
    test_results:      Dict[str, Any]
    findings:          List[Dict[str, Any]]
    refactored_files:  Dict[str, str]
    history:           List[Dict[str, Any]]
    status_logs:       List[str]
    iteration:         int
    max_iterations:    int
    validation_status: str
    security_findings: List[Dict[str, Any]]
    original_files:    Dict[str, str]
    diff_patches:      Dict[str, str]
    style_report:      Dict[str, Any]
