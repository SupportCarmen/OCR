# Coding Skills & Principles

Universal coding standards for all projects. This document ensures that every developer and AI agent produces code with the same structure, style, and quality — making cross-project collaboration and merging seamless.

> **For AI Agents**: Read this file FIRST before writing any code. Then read the project-specific docs (e.g., `CLAUDE.md`) for architecture details.

---

## 🎯 Core Philosophy

1.  **Readability Over Conciseness**: Code must explain *why*, not just *how*. Use descriptive names even if they are long.
2.  **Pattern Preservation**: Before implementing anything new, check for existing patterns in the codebase. Follow them — do not invent alternatives.
3.  **Separation of Concerns**: Business logic, presentation, and data access must live in separate layers. Never mix them.
4.  **Fail-Fast & Explicit**: Handle errors at the source with specific error types. Never use silent `pass`, empty `catch`, or broad `try-except` without logging.
5.  **Type Safety**: Always use type annotations (Python Type Hints, TypeScript types, or JSDoc) to minimize runtime errors.
6.  **Silent Observability**: Logging, auditing, and telemetry must NEVER crash the user flow. Wrap them in try/catch and swallow failures gracefully.

---

## 🏗️ Backend Principles (Python / FastAPI)

### 1. Layered Architecture

```
Router  →  Service  →  Data Access / External API / AI Client
```

| Layer | Responsibility | Rule |
|---|---|---|
| **Router** | HTTP endpoint, input validation, status codes | Keep logic minimal — delegate to services |
| **Service** | Business logic, orchestration, calculations | All complex logic lives here |
| **Data Access** | DB queries, ORM models | Use async sessions, never raw SQL in services |
| **External Client** | API calls to third-party services | Centralize in a single module per service |

**Rule**: Routers should never contain business logic. Services should never return HTTP responses.

### 2. Naming Conventions (Python)

| Element | Convention | Example |
|---|---|---|
| Variables / Functions | `snake_case` | `process_invoice`, `user_id` |
| Classes / Models | `PascalCase` | `InvoiceItem`, `UserSession` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Private Helpers | Underscore prefix | `_parse_response`, `_validate_input` |
| Config Fields | `snake_case` | `api_key`, `database_url` |
| Enums | `PascalCase` class, `UPPER_SNAKE_CASE` values | `class Status(str, Enum): ACTIVE = "active"` |

### 3. Singleton & Centralized Modules

Identify and respect "single-source" modules in every project:

-   **Config**: One module reads environment variables. Never read `.env` directly elsewhere.
-   **Database**: One module provides the session factory. Never create DB connections elsewhere.
-   **External API Client**: One module per external service. Never construct HTTP clients inline.
-   **Logging Setup**: One place configures logging. Other modules just call `logging.getLogger(__name__)`.

### 4. Error Handling

-   Define **typed exceptions** for each error category (e.g., `ValidationError`, `ExternalServiceError`, `ParseError`).
-   Map exceptions to HTTP status codes in a **global exception handler** — not scattered across routers.
-   Services raise typed exceptions. Routers/middleware convert them to HTTP responses.
-   Never raise generic `Exception` or `RuntimeError` when a typed alternative exists.

### 5. Documentation & Type Hinting

-   All functions must have Python type hints for parameters and return values.
-   Critical functions must have docstrings explaining: purpose, parameters, return value, and side-effects.
-   Use `Optional[T]` (or `T | None`) explicitly — never leave nullable types ambiguous.

### 6. Database

-   Use async sessions for all DB operations.
-   Schema migrations must be **idempotent** — safe to run multiple times without data loss.
-   Never use destructive migrations (`DROP TABLE`, `DROP COLUMN`) without explicit approval.
-   Separate ORM models, Pydantic schemas, and enums into distinct files.

### 7. Security

-   Never hardcode secrets, tokens, or API keys. Always read from environment/config.
-   Proxy external API calls through the backend — never expose third-party endpoints to the frontend.
-   Validate and sanitize all user input at the router level before passing to services.

---

## 🎨 Frontend Principles (React / Vue / JS)

### 1. Controller Pattern (Hooks / Composables)

```
Page (View)  ←  Hook/Composable (Controller)  →  API Client  →  Backend
```

| Layer | Responsibility | Rule |
|---|---|---|
| **Pages** | Top-level route components | Wire up the controller, render child components |
| **Components** | Pure UI — receive props, emit events | No API calls, no complex logic |
| **Hooks / Composables** | State, API calls, business logic | One per major feature or wizard flow |
| **API Client** | HTTP wrapper with auth headers | All API calls go through this — never raw `fetch` |

### 2. Naming Conventions (JavaScript / TypeScript)

| Element | Convention | Example |
|---|---|---|
| Components | `PascalCase` file + export | `DocumentPreview.jsx` |
| Hooks | `camelCase` with `use` prefix | `useInvoiceWizard.js` |
| Composables (Vue) | `camelCase` with `use` prefix | `useAuth.ts` |
| API modules | `camelCase` | `client.js`, `invoiceApi.js` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_FILE_SIZE`, `API_BASE_URL` |
| Variables / Functions | `camelCase` | `handleSubmit`, `isLoading` |
| CSS classes | `kebab-case` | `card-header`, `btn-primary` |

### 3. State Management & Data Flow

-   **No Deep Prop Drilling**: Limit passing props to 2–3 levels. Use Context/Provider or a state management solution for deeply nested state.
-   **Centralized API Client**: Create a single `apiFetch` / `apiClient` wrapper that handles auth headers, token refresh, and global error handling (e.g., 401 → logout). Components NEVER call `fetch`/`axios` directly.
-   **Persistent State**: Clearly separate:
    -   `localStorage` — user preferences, cached settings (survives browser close)
    -   `sessionStorage` — auth tokens, session-specific data (clears on tab close)

### 4. Internationalization (i18n)

-   All UI-facing strings must go through a translation function/object (`t`, `$t`, `i18n`).
-   Never hardcode language-specific strings directly in templates or JSX.
-   Translation dictionaries should be defined in dedicated constant files.

### 5. Styling

-   Choose ONE styling approach per project (Tailwind, CSS Modules, Styled Components, etc.) and stick with it.
-   Reusable UI elements (Modal, Button, Loading, Toast) must live in a `common/` or `shared/` directory.
-   Aim for a premium feel: consistent color palette, gradients, subtle shadows, smooth transitions.

### 6. Error & Loading States

-   Every async operation must show a loading state.
-   Every API call must handle errors with user-friendly messages — never show raw error objects.
-   Use retry patterns with exponential backoff for critical operations (e.g., AI calls, payment submissions).

---

## 🤖 AI / LLM Integration

These rules apply to any project that integrates with AI/LLM services:

1.  **Single Client Module**: All LLM calls must go through one centralized module. Never construct AI clients inline.
2.  **Stateless Extraction**: AI-generated data should be returned to the user for review BEFORE writing to the database. Never auto-commit AI output without human confirmation.
3.  **Cost Tracking**: Log every LLM call (model, token counts, usage type) for cost monitoring and audit.
4.  **Prompt Organization**: Use a structured prompt directory with shared rules/templates. Each document type or use case gets its own prompt file.
5.  **Deterministic Output**: Use `temperature=0` for structured data extraction. Only increase temperature for creative tasks.
6.  **Graceful Degradation**: If an AI call fails, show a meaningful error and allow manual input as fallback — never block the user.

---

## 🛠️ Tooling & Workflow

-   **Linting**: Always enforce a linter (`ruff`/`flake8` for Python, `eslint` for JS/TS). Fix warnings before committing.
-   **Environment**: Use `.env` files for all configuration. Provide `.env.example` with all required keys documented.
-   **Git Hygiene**: Write descriptive commit messages. One logical change per commit. Never commit secrets, `node_modules`, or virtual environments.
-   **Platform Compatibility**: Handle Windows/Linux differences explicitly (file paths, encoding, line endings). Test on the target deployment platform.

---

## ⚠️ Universal Do's and Don'ts

### DO ✅

-   Follow existing patterns before inventing new ones
-   Use typed exceptions with a global error handler
-   Centralize API clients, config, and DB access into single modules
-   Log all external calls and important actions for observability
-   Support multiple languages via translation objects — never hardcode strings
-   Use a single authenticated API wrapper for all frontend HTTP calls
-   Write type hints / annotations for all function signatures
-   Handle loading, error, and empty states for every async operation

### DON'T ❌

-   Mix business logic into routers/controllers or UI components
-   Hardcode secrets, API keys, or environment-specific values
-   Call external APIs directly from the frontend — always proxy through the backend
-   Write to the database with unvalidated or unreviewed AI output
-   Use raw `fetch`/`axios` in components — use the centralized API client
-   Ignore errors silently — at minimum, log them
-   Create duplicate singleton modules (config readers, DB factories, API clients)
-   Use destructive database migrations without explicit approval

---

> **For AI Agents**: These are non-negotiable standards. If a task request contradicts any of these principles, flag the conflict and suggest the correct approach before proceeding. Always check the project's specific documentation (e.g., `CLAUDE.md`) for implementation details unique to that project.
