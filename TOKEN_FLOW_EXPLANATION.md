## Azure CLI Session Flow

The authentication system now delegates token management entirely to Azure CLI.
Each user receives a dedicated Azure CLI configuration directory, and the
application keeps only lightweight in-memory session metadata.

### Configuration Highlights
- `AZURE_CONFIG_BASE_DIR`: base directory backing both temporary login caches and
  user-specific Azure CLI config folders.
- `AZURE_ROLE_GROUP_MAPPING`: maps Azure AD group IDs to in-app roles
  (e.g. admins vs. users).
- `DEFAULT_ROLE`: optional fallback role applied when no groups match.
- `GRAPH_TOKEN_TTL_MINUTES`: reused as the browser session cookie lifetime.
- `AZURE_OPENAI_*`: endpoint, API version, and optional tenant defaults for the
  per-user Azure OpenAI client factory.

### End-to-End Flow

1. **Start login** (`POST /api/authorize/start`)
   - Backend generates a `session_id` and an isolated Azure CLI config directory
     under `AZURE_CONFIG_BASE_DIR/<session_id>`.
   - `az login --use-device-code` launches in the background; the device code and
     verification URI are returned to the browser.

2. **Complete login in Azure portal**
   - Once the user approves the device code, the background task gathers:
     - Azure AD user metadata (`az ad signed-in-user show`).
     - Group memberships via Microsoft Graph to resolve roles.
   - The temporary config directory is moved to a deterministic
     per-user location `AZURE_CONFIG_BASE_DIR/users/<identifier>` (0700 perms).
   - Minimal login context (email, roles, Azure IDs, config path) is stored in
     `auth_sessions` until the browser confirms completion.

3. **Finalize authorization** (`POST /api/authorize/complete`)
   - Browser posts the `session_id` with its fingerprint.
   - An in-memory `SessionRecord` is created (via `session_manager.create_session`)
     containing email, roles, Azure object/tenant IDs, fingerprint, and the
     user's Azure CLI config directory.
   - The server issues HttpOnly cookies for `session_id` and the fingerprint, and
     returns a CSRF token for subsequent requests.
   - Every authenticated request refreshes these cookies to provide a sliding
     expiration window while the browser remains active.

4. **Authenticated requests**
   - `rbac.get_current_user` resolves the session by `session_id`, verifies the
     fingerprint, and provides a `TokenData` view of the active session.
   - Authorization decisions rely entirely on in-memory session data and role
     membership derived from Azure AD groups.

5. **Logout** (`POST /api/auth/logout`)
   - The session is removed from the in-memory store by `session_id` or
     fingerprint, and cookies are cleared. User-specific Azure CLI directories
     remain on disk so Azure CLI can refresh tokens as needed.

### Session Storage
- No database is used. `session_manager` keeps active sessions in memory.
- Each record tracks `session_id`, email, username, roles, Azure IDs, the
  per-user Azure CLI config directory, fingerprint, and timestamps.

### Azure OpenAI Clients
- `azure_client.get_user_openai_client(user_identifier, ...)` returns an
  `AzureOpenAI` instance bound to that user's Azure CLI token cache.
- `AzureCliCredential` automatically refreshes tokens by reading the
  per-user Azure CLI directory (`AZURE_CONFIG_DIR`).

### Frontend Notes
- Browser never receives Azure tokens; only opaque `session_id` and fingerprint
  cookies are stored (HttpOnly).
- `/api/check-auth` exposes the minimal session envelope, including
  `azure_config_dir` and a CSRF token.
- Expired or missing sessions result in 401 responses, prompting re-authentication.

### Summary
The updated flow removes application-managed tokens and persistence in favor of
Azure-managed credentials per user. Sessions are tracked in memory with device
fingerprint binding, while Azure OpenAI calls reuse the same Azure CLI cache to
obtain and refresh tokens seamlessly.
