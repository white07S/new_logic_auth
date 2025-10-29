# Azure AD Authentication System with Fingerprinting

A FastAPI + React reference implementation that authenticates users through the
Azure AD device-code flow, ties sessions to browser fingerprints, and reuses the
Azure CLI token cache to call Azure OpenAI on behalf of each user.

## Features

- **Per-user Azure CLI workspaces**: each successful login promotes the
  temporary `AZURE_CONFIG_DIR` into a long-lived directory under
  `AZURE_CONFIG_BASE_DIR/users/<identifier>`.
- **In-memory session manager**: lightweight `SessionRecord` objects track
  email, roles, Azure IDs, fingerprints, and Azure CLI config paths without any
  database dependency.
- **Fingerprint binding**: the backend validates an HttpOnly fingerprint cookie
  on every request and expires sessions immediately on mismatch.
- **Role-based access control**: roles come from Azure AD group membership via
  `AZURE_ROLE_GROUP_MAPPING`.
- **Azure OpenAI tester**: a `/api/azure/chat-test` endpoint (and matching UI
  widget) sends a simple chat completion using the caller’s Azure CLI identity.
- **Hardened middleware**: CSP/security headers, CSRF double-submit cookies,
  simple rate limiting, and audit logging out of the box.

## Project Structure

```
authorization/
├── auth.py                # Device-code flow orchestration and cookie helpers
├── azure_client.py        # Per-user Azure OpenAI client factory
├── azure_config.py        # Safe helpers for Azure CLI config directories
├── azure_chat_cli.py      # CLI utility to test Azure OpenAI chat completions
├── config.py              # Environment-driven configuration
├── main.py                # FastAPI application & API routes
├── models.py              # Pydantic models shared across endpoints
├── rbac.py                # Session resolution & role guards
├── security.py            # Middleware (CSP, CSRF, rate limiting, audit)
├── session_manager.py     # In-memory session store
├── TOKEN_FLOW_EXPLANATION.md
└── frontend/              # React SPA (HashRouter) with login modal & pages
```

## Configuration

`config.py` reads environment variables for all tunables. Key settings:

- `AZURE_CONFIG_BASE_DIR`: root directory that will contain both the temporary
  device-code cache and the promoted per-user caches.
- `AZ_LOGIN_TIMEOUT`: timeout (seconds) for the initial `az login` device-code
  flow.
- `AZURE_ROLE_GROUP_MAPPING`: maps Azure AD group IDs to application roles.
- `DEFAULT_ROLE`: optional fallback role (e.g. `user`) when no group mapping matches.
- `GRAPH_TOKEN_TTL_MINUTES`: reused as the cookie lifetime for the
  session/fingerprint pair.
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`:
  required to exercise the Azure OpenAI tester.

See `TOKEN_FLOW_EXPLANATION.md` for a deep dive into the authentication flow.

## Authentication Flow

1. **Start** – `POST /api/authorize/start` seeds `auth_sessions` and launches
   `az login --use-device-code` inside a unique temp `AZURE_CONFIG_DIR`. The
   device code + verification URL are returned to the frontend.
2. **Azure approval** – once the user completes the device-code flow, the
   background task gathers Azure AD user metadata, group membership, and moves
   the temporary directory to `AZURE_CONFIG_BASE_DIR/users/<identifier>`.
3. **Complete** – `POST /api/authorize/complete` accepts the session ID and
   browser fingerprint, creates an in-memory `SessionRecord`, and issues
   HttpOnly cookies (`session_id`, `fingerprint`, `csrf_token`).
4. **Authenticated requests** – `rbac.get_current_user` resolves the session by
   cookie, validates the fingerprint, and injects `TokenData` into dependencies.
   Each successful call slides the cookie expiration forward to keep the session
   alive while the user stays active.
5. **Azure OpenAI** – `/api/azure/chat-test` builds an `AzureOpenAI` client via
   `AzureCliCredential`, so refresh tokens are handled by the Azure CLI cache.
6. **Logout** – `POST /api/auth/logout` drops the in-memory session and clears
   cookies. Per-user Azure CLI directories stay on disk for token refresh.

## API Endpoints (selected)

- `POST /api/authorize/start` – initiate the Azure device-code flow.
- `GET /api/authorize/status` – poll device-code status.
- `POST /api/authorize/complete` – bind fingerprint & create session.
- `POST /api/auth/logout` – remove session + clear cookies.
- `GET /api/me` – return the authenticated user profile.
- `GET /api/check-auth` – lightweight auth status + session metadata.
- `GET /api/session/info` – detailed session record (created/last seen, Azure IDs).
- `GET /api/me/devices` – list sessions tied to the same Azure object ID.
- `GET /api/admin/sessions` – admin-only snapshot of all active sessions.
- `POST /api/azure/chat-test` – send a simple chat completion via Azure OpenAI.

Test utilities remain under `frontend/src/pages/Page1.js` for RBAC demos.

## Frontend Highlights

- React SPA using `HashRouter`, secured by a reusable `ProtectedRoute` wrapper.
- Login modal drives the device-code flow and polls `/api/authorize/status` until
  completion.
- `TokenStatus` component surfaces session timing, fingerprint status, and the
  Azure CLI workspace path tied to the current user.
- `AzureChatTester` card (Page 1) lets any authenticated user send a prompt to
  Azure OpenAI and view the response/request ID/token usage.

## Testing Azure OpenAI

There are two easy ways to verify Azure OpenAI connectivity once a user has
completed the device-code flow:

1. **Frontend**: navigate to Page 1 and use the “Azure OpenAI Tester” card.
2. **CLI**: run the helper script from the project root:

   ```bash
   python azure_chat_cli.py <user_identifier> "Hello from the CLI"
   ```

   The identifier should match the directory created under
   `AZURE_CONFIG_BASE_DIR/users/`. Optional flags allow overriding the tenant ID
   or deployment name.

## Production Considerations

- Serve the backend over HTTPS and set `ENVIRONMENT=production` so cookies use
  the `__Host-` prefix and `Secure` attribute.
- Place `AZURE_CONFIG_BASE_DIR` on restricted storage (tmpfs or encrypted
  volume) and ensure it remains `0700`.
- Rotate the application secrets (`CSRF_SECRET_KEY`, `SESSION_SECRET_KEY`).
- Configure logging destinations for the audit trail emitted by `AuditLogger`.
- Frontend uses `HashRouter` by default; switch to browser routes if deploying
  behind an SPA-friendly CDN/router.

## License & Contributions

This template is provided as-is for experimentation. Feel free to fork, adapt,
and extend it—PRs and suggestions are welcome.
