"""
Tool Registry — enables agent-style invocation by name.

Usage:
    from app.tools import registry

    names = registry.list_tools()
    # ["extract_receipt", "submit_receipt", "suggest_gl_fixed_fields", "suggest_gl_payment_types"]

    schema = registry.get_schema("extract_receipt")
    result = await registry.invoke("extract_receipt", {"filename": "...", ...})
"""

from typing import Any, Callable, Dict, List, Optional

from app.tools import extract, map_gl, submit
from app.tools.base import ToolResult

# ── Registry entries ──────────────────────────────────────────────────────────

_REGISTRY: Dict[str, Dict] = {
    extract.TOOL_NAME: {
        "fn": extract.run,
        "description": "Extract structured data from a bank receipt image using Vision LLM",
        "input_schema": {
            "file_bytes": "bytes — raw file content",
            "filename":   "str  — original filename (determines mime type)",
            "bank_type":  "str? — SCB | BBL | KBANK (selects bank-specific prompt)",
        },
    },
    submit.TOOL_NAME: {
        "fn": submit.run,
        "description": "Persist confirmed receipt data to the local database",
        "input_schema": {
            "inp": "SubmitInput dataclass",
            "db":  "AsyncSession — SQLAlchemy session (injected by router)",
        },
    },
    map_gl.TOOL_FIXED: {
        "fn": map_gl.suggest_fixed_fields,
        "description": "LLM-suggest GL account/dept codes for Commission, Tax Amount, Net Amount",
        "input_schema": {
            "accounts":    "list[{code, name, type?}]",
            "departments": "list[{code, name}]",
        },
    },
    map_gl.TOOL_PAYMENT: {
        "fn": map_gl.suggest_payment_types,
        "description": "LLM-suggest GL account/dept codes for dynamic payment types (Visa, MCA, QR, …)",
        "input_schema": {
            "payment_types": "list[str]",
            "accounts":      "list[{code, name, type?}]",
            "departments":   "list[{code, name}]",
        },
    },
}


# ── Public API ─────────────────────────────────────────────────────────────────

def list_tools() -> List[str]:
    """Return names of all registered tools."""
    return list(_REGISTRY.keys())


def get_schema(name: str) -> Optional[Dict]:
    """Return description + input_schema for a tool, or None if not found."""
    entry = _REGISTRY.get(name)
    if not entry:
        return None
    return {
        "name": name,
        "description": entry["description"],
        "input_schema": entry["input_schema"],
    }


def get_fn(name: str) -> Optional[Callable]:
    """Return the tool function by name, or None if not found."""
    entry = _REGISTRY.get(name)
    return entry["fn"] if entry else None


async def invoke(name: str, **kwargs: Any) -> ToolResult:
    """
    Invoke a registered tool by name with keyword arguments.
    Returns a failed ToolResult if the tool is not found or raises.
    """
    fn = get_fn(name)
    if fn is None:
        return ToolResult(
            success=False,
            tool=name,
            input=kwargs,
            errors=[f"Tool '{name}' not found. Available: {list_tools()}"],
        )
    result = await fn(**kwargs)
    return result
