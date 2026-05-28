from langgraph.graph import StateGraph, END
from backend.app.agent.state import AgentState
from backend.app.agent.nodes import (
    node_ingest,
    node_static_analysis,
    node_llm_review,
    node_apply_fixes,
    node_validate_fixes,
)

TERMINAL_STATES = {"verified_clean", "unvalidated", "done_review_only", "failed_ingest"}


def should_continue(state: AgentState) -> str:
    auto_fix  = state.get("auto_fix", False)
    status    = state.get("validation_status", "unvalidated")
    iteration = state.get("iteration", 0)
    max_iter  = state.get("max_iterations", 2)

    if not auto_fix or status in TERMINAL_STATES or iteration >= max_iter:
        return "end"
    return "review"


def create_review_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("ingest",   node_ingest)
    workflow.add_node("analyze",  node_static_analysis)
    workflow.add_node("review",   node_llm_review)
    workflow.add_node("refactor", node_apply_fixes)
    workflow.add_node("validate", node_validate_fixes)

    workflow.set_entry_point("ingest")
    workflow.add_edge("ingest",   "analyze")
    workflow.add_edge("analyze",  "review")
    workflow.add_edge("review",   "refactor")
    workflow.add_edge("refactor", "validate")
    workflow.add_conditional_edges("validate", should_continue, {"end": END, "review": "review"})

    return workflow.compile()


review_agent = create_review_graph()
