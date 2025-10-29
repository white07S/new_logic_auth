"""Quick CLI utility to exercise the Azure OpenAI chat endpoint per user."""

from __future__ import annotations

import argparse
import sys
import uuid

import config
from azure_client import get_user_openai_client


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "user_identifier",
        help="User identifier that maps to the Azure CLI config directory (e.g. email prefix or object id).",
    )
    parser.add_argument(
        "message",
        help="Prompt to send to Azure OpenAI",
    )
    parser.add_argument(
        "--tenant-id",
        dest="tenant_id",
        default=None,
        help="Optional Azure AD tenant ID override. Defaults to AZURE_OPENAI_TENANT_ID if set.",
    )
    parser.add_argument(
        "--deployment",
        dest="deployment",
        default=None,
        help="Azure OpenAI deployment name. Defaults to AZURE_OPENAI_DEPLOYMENT.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.2,
        help="Sampling temperature for the completion request (default: 0.2).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    deployment = args.deployment or config.AZURE_OPENAI_DEPLOYMENT
    if not deployment:
        print("AZURE_OPENAI_DEPLOYMENT is not configured.", file=sys.stderr)
        return 2

    try:
        client = get_user_openai_client(
            args.user_identifier,
            tenant_id=args.tenant_id or config.AZURE_OPENAI_TENANT_ID,
        )
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    request_id = str(uuid.uuid4())

    try:
        completion = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": args.message}],
            temperature=args.temperature,
            extra_headers={"x-ms-client-request-id": request_id},
        )
    except Exception as exc:  # noqa: BLE001
        print(f"Azure OpenAI request failed: {exc}", file=sys.stderr)
        return 1

    content = ""
    if getattr(completion, "choices", None):
        content = completion.choices[0].message.content or ""

    usage = getattr(completion, "usage", None)
    if hasattr(usage, "model_dump"):
        usage = usage.model_dump()

    print("=== Azure OpenAI Chat Response ===")
    print(f"Request ID: {request_id}")
    print(f"Deployment: {deployment}")
    print("--- Content ---")
    print(content or "<empty response>")

    if usage:
        prompt_tokens = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")
        total_tokens = usage.get("total_tokens")
        print("--- Token Usage ---")
        print(f"Prompt tokens: {prompt_tokens}")
        print(f"Completion tokens: {completion_tokens}")
        print(f"Total tokens: {total_tokens}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
