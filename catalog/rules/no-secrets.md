---
name: no-secrets
description: Never write secrets or credentials into code, config or logs.
---

# No secrets

- Never commit passwords, API keys, tokens, private keys or connection strings with credentials.
- Read secrets from environment variables or a secret manager. In examples and templates use placeholders such as `${API_KEY}`.
- Do not print secrets in logs, error messages or test output.
- Do not read or modify `.env` files or credential stores unless the task explicitly requires it.
- If you find a secret in the code, tell the user so it can be rotated; do not copy it elsewhere.
