## Graph Token Session Flow

The authentication system now relies on the Microsoft Graph access token produced by the Azure CLI device-code flow. There are no application-issued JWTs or refresh tokens anymore.

### Configuration Highlights
- `GRAPH_TOKEN_TTL_MINUTES` (`config.py`): custom lifetime applied to the cached Graph token (default 1440 minutes / 24 hours).
- `AZURE_ROLE_GROUP_MAPPING`: maps Azure AD group IDs to application roles (e.g. admins vs. standard users).
- `AZURE_CONFIG_BASE_DIR`: base directory used to isolate every Azure CLI login (`/tmp/azcfg/<session_id>`).

### End-to-End Flow

1. **Start login** (`POST /api/authorize/start`)
   - Backend creates a unique `session_id` and a dedicated Azure CLI config directory.
   - `az login --use-device-code` starts in the background and the device code + verification URI are returned to the browser.

2. **Complete login in Azure portal**
   - User enters the code at the Microsoft verification URL.
   - The background `az login` exits, and the server immediately calls:
     - `az ad signed-in-user show` to get Azure user metadata.
     - `az rest ... /memberOf` to enumerate group membership.
     - `az account get-access-token --resource https://graph.microsoft.com` to capture the Graph access token.
   - Group IDs are matched against `AZURE_ROLE_GROUP_MAPPING`. If no role matches, the session is marked as unauthorized.
   - The Graph token expiry is overridden to the configured TTL and all data are cached in `auth_sessions`.

3. **Finalize authorization** (`POST /api/authorize/complete`)
   - Browser posts the `session_id` together with its fingerprint.
   - Server persists/updates the user record in TinyDB and writes a session document that contains:
     - token hash
     - fingerprint
     - device ID
     - Azure user/tenant identifiers
     - custom expiry timestamp
   - The raw Graph token is sent back only as an HttpOnly cookie (`graph_access_token`). The response body returns the user profile, assigned roles, and the computed expiry time.
   - The temporary Azure CLI config directory is removed.

4. **Authenticated requests**
   - `graph_access_token` and `fingerprint` cookies accompany every request.
   - `rbac.get_current_user` hashes the token, loads the session from TinyDB, checks expiry/fingerprint, and returns a `TokenData` instance.
   - Because the token is opaque, authorization depends solely on the server-side session entry.

5. **Logout** (`POST /api/auth/logout`)
   - Cookie token is hashed, the corresponding session document is deleted, and cookies are cleared.

### Session Storage
- Replaced SQLite with a `TinyDB` JSON file (`auth_system.json`).
- Users table tracks Azure object ID, email, username, roles, `created_at`, and `last_login`.
- Sessions table stores hashed Graph tokens, fingerprint bindings, custom expiry times, and Azure IDs.

### Frontend Notes
- All cookies remain HttpOnly; browser code never sees the raw Graph token.
- Local storage keeps a lightweight copy of the user profile plus `token_expires_at` for display. Expired entries are cleared on access.
- 401 responses trigger a client-side sign-out (there is no refresh endpoint anymore).

### Summary
This flow allows multiple concurrent Azure logins by isolating Azure CLI config directories per session, maps Azure AD groups directly to application roles, and maintains secure session state in TinyDB with fingerprint validation and a fixed 24‑hour Graph token lifetime.
