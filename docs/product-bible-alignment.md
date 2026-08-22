# MUJAWIB Product Bible Alignment

This file is the implementation guardrail for the current UI work. The source of truth is `MUJAWIB.txt`.

## Product Position

- MUJAWIB is a managed B2B Arabic voice operations platform, not a self-serve bot builder.
- The marketing site should sell operational outcomes: booking, transfer, lead, follow-up, QA, and integration health.
- Marketing content has a typed source in `lib/content/site.ts`, consumed by the landing sections and side pages. A database-backed editing surface is still future work and is not presented as complete.
- The operator console should prioritize calm operations: status, live calls, needs attention, list/detail/inspector, and publish/QA gates.

## Design System

- Arabic typography: IBM Plex Sans Arabic first.
- Canvas: `#F7F7F5` light direction and `#0B0D10` dark direction.
- Accent: one core violet/blue accent for focus, active states, and live voice moments.
- Radius: 12px controls, 16px panels, larger only for hero/product surfaces.
- Avoid: heavy gradients in dashboard, decorative bento overload, generic AI sparkle decoration, and technical metrics in client-facing copy.
- Final shared UI overrides now live in `app/design-system.css`, imported after `app/globals.css`; new cross-surface polish should go there instead of adding more scattered overrides.

## Current Landing Alignment

- Hero: consultative B2B message and demo CTA.
- Live Demo: three Arabic call scenarios: Saudi, Egyptian, and Arabic-English mixed.
- Outcomes: business outcomes rather than generic AI claims.
- Quality: Agent Factory, Arabic Voice Lab, publish gate, pronunciation dictionary.
- Operations: product screenshot and call-to-action into the operator console.
- Integrations: actions and systems, not a wall of logos.
- Deployment: Discovery → Build → Test → Go Live.
- Industries: four launch packs only.
- Mobile landing now keeps integrations compact in a 2-column grid and preserves dashboard screenshot readability without horizontal overflow.

## Current Console Alignment

- Sidebar follows Operator Console navigation from the Bible.
- Command palette exists through `Cmd/Ctrl+K`.
- Top bar now includes a durable, recipient-scoped Notification Center with unread state and direct operational links; it is shared by Console and Portal without exposing one workspace to another.
- Home prioritizes status, needs attention, metrics, live activity, and calls workspace.
- Home now includes an Operational Brief: Ask MUJAWIB, short reasoning, clients at risk, and direct next actions.
- Calls workspace uses List → Detail → Inspector.
- Calls and dashboard metrics now default to `origin=live`; seeded records require the explicit Demo filter.
- Call detail uses a typed transcript normalizer and an automatic post-call Structured Output. It explains the caller need, what happened, and the next action while a booking, lead, completion, or tool success still requires linked database evidence.
- Post-call processing runs behind the finished call, stores no OpenAI response by default, has versioned status metadata and an audited retry path, and never changes `call.outcome` from model prose.
- Context inspector exposes call outcome, QA, tools, and action affordances without navigation churn.
- Agents now behaves like an Agent Studio: Identity, Arabic Voice, Knowledge, Flows, Actions, Routing, QA, Versions, Prompt Compiler preview, and a blocked publish gate.
- QA now behaves like a Review Studio: prioritized queue, transcript excerpts, flagged tool/voice issues, correction checklist, publish impact, and explicit approve/escalate decisions.
- Voice Lab owns voice profiles and pronunciation; the separate Test Lab owns executable release evidence instead of displaying seeded scores as if they were real.
- Test Lab runs deterministic behavioral scenarios on the production Realtime model and the exact compiled version prompt, records transcript/tool requests without executing business mutations, and supplies the freshness-aware publish gate used by Agents and client readiness.
- Integrations now behaves like an Action Hub: operational readiness, health evidence, guarded endpoint setup, environment-only credential references, real tool execution metrics, and managed integration requests instead of logo rows.
- Console navigation, direct routes, and mutations now share one role policy; QA, Integrator, Ops, and Owner see only the operational surfaces they can actually use.
- Client Portal resolves the signed-in user's explicit workspace membership and never falls back to another client's data.
- Access Management now includes one-time, expiring workspace invitations. Public sign-up is disabled; a new identity can be created only behind a valid email-bound invitation, while an existing identity signs in and accepts the exact role. `/auth/continue` resolves the authorized console or portal and leaves unassigned accounts in an explicit pending state.
- Clients now shows account health, onboarding state, monthly call volume, and next operational action.
- Client detail now has one authoritative readiness journey shared with the server-side Go Live gate: business → published agent → tested phone → required integrations → QA → live.
- Templates now behaves like an industry template studio with sector packs, scenario coverage, and QA expectations.
- Phone now behaves like a Telephony Wizard: PBX/SIP, mobile forwarding, new number paths, tested route detail, route-test checklist, and fallback rules without exposing raw SIP setup as the main UI.
- System now behaves like a Governance Studio: platform health, usage/cost guardrails, roles, audit activity, and the internal/client visibility boundary.

## Current Client Portal Alignment

- `/portal` exists as a separate client-facing surface from `/console`.
- Client sees business outcomes: answered calls, bookings, resolved rate, after-hours opportunities.
- Client sees readable insights, top call reasons, recent calls, bookings, customers, business info, integrations, and change request status.
- Client calls now use a business-first List→Answer→Conversation workspace and avoid model, prompt, SIP, tool schema, and API secret details.
- Client call-derived metrics, bookings, callers, and conversation records are constrained to `origin=live`; seeded presentation data cannot appear as customer performance.
- Business Info now has a safe-change workflow: published knowledge, pending approval, review guardrails, source, risk, and last updated.
- Change Requests now include request composer, managed-service stages, owner, impact, next step, ETA, and non-technical tracking.
- Change Request state changes and integration incidents now reach the relevant client members in-app; email/Slack escalation remains a later channel, not a simulated success.

## Next Required Work

- Deepen Agent Factory into separate Identity, Voice, Knowledge, Flows, Actions, Routing, QA, and Versions screens.
- Add Browser Audio and Phone Test evidence, a durable worker for 50–100 scenario packs, version comparison, and per-accent approval history.
- Deepen Clients, Templates, Phone, and System into editable workflows with validation and saved states.
- Add richer client portal workflows for booking confirmation, customer follow-up, and business-info change submission.
- Expand drawer, editable form, and saved-state coverage beyond the current route and interaction smoke checks.
- Add configurable notification thresholds and real email/Slack escalation after in-app delivery is proven in production.
- Move post-call retries to a durable job runner before multi-instance scale; the current long-lived Render runtime is automatic and has a stale-state manual recovery path.

## QA Guardrails

- `pnpm ux:smoke` checks the marketing site, invitation/error journeys, all console routes, and all client portal routes on mobile and desktop.
- Interaction smoke always covers public theme switching. Operator command/call interactions run when an authenticated browser session is available; otherwise the result says `skip` explicitly and verifies the auth gate instead of claiming console coverage.
- The smoke test fails on horizontal overflow and on client-portal exposure of technical terms such as prompt/model/SIP/API/schema.
- Default target is `http://localhost:3009`; override with `MUJAWIB_BASE_URL`.
- Operator aggregates exclude `origin=seed`; “live now” also requires activity within the last two hours while preserving the stored call status for audit.
- Calls without `endedAt`, transcript, or a linked outcome remain visibly pending. The UI must not invent a successful business result.
- Accepted SIP calls now use one provider-neutral OpenAI sideband inside the Node web runtime. It persists typed transcript turns and call events, executes published-version tools idempotently, and closes a call only from clean control-channel evidence.
- Tool output is returned with `function_call_output` followed by `response.create`; a transfer or booking is never reported successful before its external action succeeds.
- Publish requires trusted Test Lab evidence created after the version's latest edit; old seeded runs and historical failures are never mistaken for the latest release decision.
