# Data model and migration plan

## Current prototype model

The current browser-persisted Profile includes identity preference, stage, aspiration, interests, values, demonstrated skills, budget, location, relocation availability, weekly time, income deadline, family expectations, peer influence, social-status reflection, voluntary support needs and support mode. It also contains explicit priority entries: importance, self-reported certainty, confirmation state, supporting evidence, conflicting statements and an update timestamp. Unconfirmed entries do not affect pathway compatibility.

An Opportunity contains a route, tags, duration, estimated cost, income estimate, location mode, weekly hours, requirements, official discovery URLs, data-status label, evidence-quality score and route-to-priority fit values. An Eligibility result records satisfied checks, hard blockers, unresolved assumptions and missing information. A Pathway stores a plan label, separate compatibility, feasibility, evidence and coverage metrics, risks, milestones and conditions for reconsideration. A Scenario contains baseline and recalculated pathway snapshots. An ActionItem stores timing, estimated duration, reasoning, documents, official resource URL and a status of not-started, in-progress, completed, blocked, postponed or skipped. A replan proposal preserves completed items and awaits user confirmation.

## Required production migrations

Do not run these against a production database until an authenticated data owner and retention policy are approved.

| Table | Purpose | Critical controls |
| --- | --- | --- |
| profiles | Current confirmed profile plus monotonically increasing version | Row-level owner policy; field provenance; deletion support |
| profile_observations | User-confirmed interview, guardian and document observations | Source type, confirmation state, sensitivity flag; never raw media by default |
| conversations | Minimal text conversation metadata and consented messages | Owner policy; configurable retention; no model logging of secrets |
| opportunities | Curator-reviewed opportunity records | Source URL, verifier, verification timestamp, expiry, data classification |
| eligibility_rules | Versioned deterministic rules linked to opportunities | Immutable version and test fixture references |
| pathways | Structured Plan A–L snapshots when distinct routes exist | Profile version, rules version, source snapshot and selection state |
| scenarios | Baseline pathway ID, explicit changed fields and output snapshot | Must not change profile without explicit apply event |
| action_items | Selected pathway action plan and completion state | Preserve completed items through pathway changes |
| roadmap_revisions | User-reported obstacle, proposed task revision and approval decision | Owner policy; preserve baseline and completed tasks |
| timeline_events | User-visible audit history | Append-only actor, timestamp and event metadata |
| guardian_collaborators | Optional invited guardian relationship | Explicit learner or account-owner consent; revocable access |
| subscriptions | Provider-verified entitlement state | Server-webhook only; never trust a client subscription flag |
| payment_events | Payment-provider webhook receipt and processing record | Signature verification, idempotency and minimal data retention |

## Source-of-truth rules

Only confirmed profile facts become eligible for route calculation. A document extraction or model suggestion is a proposed observation until user confirmation. Opportunities may be displayed as verified live, cached with timestamp, user-provided, sample or unverified; the current starter catalogue is sample. Eligibility rules, not an LLM, decide hard constraints.
