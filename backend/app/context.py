"""
Request-scoped context variables.

Set by `auth/dependencies.py` for each authenticated request.
Read by middleware and services to enrich logs without passing data through every call.
"""

from contextvars import ContextVar

current_session_id:    ContextVar[str] = ContextVar("current_session_id",    default="")
current_user_id:       ContextVar[str] = ContextVar("current_user_id",       default="")
current_username:      ContextVar[str] = ContextVar("current_username",       default="")
current_bu:            ContextVar[str] = ContextVar("current_bu",             default="")
current_carmen_token:  ContextVar[str] = ContextVar("current_carmen_token",   default="")

# Set by route handlers after they know which document is being processed
current_document_ref: ContextVar[str] = ContextVar("current_document_ref", default="")
