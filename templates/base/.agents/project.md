# Project: {{project.name}}

<!--
The project brain. Agents read this through AGENTS.md.
Fill the TODO sections once. Keep it short. Rules belong here, not in chat.
Edit this file, then run `agentic sync`.
-->

## What it does

TODO: one paragraph. What the system does and for whom.

## Users and roles

| Role | What they can do |
|---|---|
| TODO | TODO |

## Rules that must never break

TODO: the domain rules that no code change may violate. Be specific.

Examples of the shape:

- An order cannot exist without a customer.
- Refunds are manual, never automatic.
- Data for tenant A is never returned to tenant B.

## Stack

- Detected: {{stack}}
- Package manager: {{packageManager}}
- Services: TODO (database, queue, cache, object storage, third party APIs)

## Commands

See AGENTS.md. Fill anything marked "not configured" in `agentic.config.json`.

## Layout

| Path | What lives there |
|---|---|
| `{{source}}` | application code |
| `docs/specs/` | feature specs |
| `docs/plans/` | task plans |

## Data and sensitive paths

- TODO: where money, auth, personal data, and migrations live.
- Never read `.env`, keys, or credentials. `.env.example` is the only env file.

## External services

| Service | Used for | Env vars |
|---|---|---|
| TODO | TODO | TODO |

## Open questions

- TODO: anything an agent should ask instead of guessing.
