#!/usr/bin/env python3
"""Script to view active in-memory sessions with user information.

Note: Sessions are maintained in process memory. Run this within the same
runtime as the FastAPI app (e.g. via an interactive shell) to inspect state.
"""

from session_manager import list_sessions

def main():
    print("\n=== Active Sessions with User Information ===\n")

    sessions = list_sessions()

    if not sessions:
        print("No active sessions found.")
        return

    for session in sessions:
        print(f"Session ID: {session['session_id']}")
        print(f"  Email: {session['email']}")
        print(f"  Username: {session['username']}")
        print(f"  Roles: {', '.join(session['roles'])}")
        print(f"  Azure Object ID: {session['azure_object_id']}")
        print(f"  Azure Tenant ID: {session.get('azure_tenant_id')}")
        print(f"  Azure Config Dir: {session['azure_config_dir']}")
        print(f"  Fingerprint: {session.get('fingerprint')}")
        print(f"  Created: {session['created_at']}")
        print(f"  Last Seen: {session['last_seen_at']}")
        print("-" * 60)

if __name__ == "__main__":
    main()
