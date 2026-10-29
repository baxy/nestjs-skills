# EARS Format

Easy Approach to Requirements Syntax. Use for observed functional requirements.

| Type | Pattern | Example |
|------|---------|---------|
| Ubiquitous | The <system> shall <action>. | The API shall return JSON responses. |
| Event-driven | When <trigger>, the system shall <action>. | When a request lacks an auth token, the system shall return HTTP 401. |
| State-driven | While <state>, the system shall <action>. | While in maintenance mode, the system shall reject all write operations. |
| Optional | Where <feature> is supported, the system shall <action>. | Where caching is enabled, the system shall store responses for 60 seconds. |

## Guidelines
- Ground every requirement in code evidence (file:line).
- Prefer observed behavior over inferred intent.
- Number them (OBS-001, OBS-002…) when the list is long.
- Separate facts from inferences.
