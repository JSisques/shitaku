---
name: error-handling
description: Handle errors explicitly and never swallow them silently.
---

# Error handling

- Never leave an empty `catch` block or ignore a rejected promise or a returned error.
- Handle an error where you can do something useful about it; otherwise let it propagate with added context.
- Error messages say what failed and what the caller can do next. Include the relevant identifier, never secrets.
- Validate input at the boundaries of the system and fail early with a clear message.
- Use the error types and patterns already present in the codebase.
- Do not catch broad exceptions to hide a bug; fix the cause.
