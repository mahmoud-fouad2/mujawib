# MUJAWIB Product Bible Alignment

This file is the implementation guardrail for the current UI work. The source of truth is `MUJAWIB.txt`.

## Product Position

- MUJAWIB is a managed B2B Arabic voice operations platform, not a self-serve bot builder.
- The marketing site should sell operational outcomes: booking, transfer, lead, follow-up, QA, and integration health.
- Marketing content now has a typed control layer in `lib/marketing-content.ts`, consumed by landing sections, side pages, and the console Site Content route.
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
- Home prioritizes status, needs attention, metrics, live activity, and calls workspace.
- Home now includes an Operational Brief: Ask MUJAWIB, short reasoning, clients at risk, and direct next actions.
- Calls workspace uses List → Detail → Inspector.
- Context inspector exposes call outcome, QA, tools, and action affordances without navigation churn.
- Agents now behaves like an Agent Studio: Identity, Arabic Voice, Knowledge, Flows, Actions, Routing, QA, Versions, Prompt Compiler preview, and a blocked publish gate.
- QA now behaves like a Review Studio: prioritized queue, transcript excerpts, flagged tool/voice issues, correction checklist, publish impact, and explicit approve/escalate decisions.
- Voice Lab now behaves like an Arabic QA lab: voice profiles, language/number/date policies, mandatory Voice Test Pack, pronunciation dictionary, interruption/noise behavior, sample comparison, and publish gate.
- Integrations now behaves like an Action Hub: action names, last success, error rate, affected agents/clients, fallback policy, sync events, and managed integration requests instead of logo rows.
- Clients now shows account health, onboarding state, monthly call volume, and next operational action.
- Templates now behaves like an industry template studio with sector packs, scenario coverage, and QA expectations.
- Phone now behaves like a Telephony Wizard: PBX/SIP, mobile forwarding, new number paths, tested route detail, route-test checklist, and fallback rules without exposing raw SIP setup as the main UI.
- System now behaves like a Governance Studio: platform health, usage/cost guardrails, roles, audit activity, and the internal/client visibility boundary.
- Site Content now gives the operator/admin side a safe surface for managing landing sections, footer links, side pages, and future CMS-backed content.

## Current Client Portal Alignment

- `/portal` exists as a separate client-facing surface from `/console`.
- Client sees business outcomes: answered calls, bookings, resolved rate, after-hours opportunities.
- Client sees readable insights, top call reasons, recent calls, bookings, customers, business info, integrations, and change request status.
- Client calls pages avoid model, prompt, SIP, tool schema, and API secret details.
- Business Info now has a safe-change workflow: published knowledge, pending approval, review guardrails, source, risk, and last updated.
- Change Requests now include request composer, managed-service stages, owner, impact, next step, ETA, and non-technical tracking.

## Next Required Work

- Deepen Agent Factory into separate Identity, Voice, Knowledge, Flows, Actions, Routing, QA, and Versions screens.
- Deepen Voice Lab into profiles, per-accent approval history, and scenario test packs.
- Deepen Clients, Templates, Phone, and System into editable workflows with validation and saved states.
- Add richer client portal workflows for booking confirmation, customer follow-up, and business-info change submission.
- Expand drawer, editable form, and saved-state coverage beyond the current route and interaction smoke checks.

## QA Guardrails

- `pnpm ux:smoke` checks the marketing site, all console routes, and all client portal routes on mobile and desktop.
- Interaction smoke now covers theme switching, the operator command surface, and calls list-to-inspector behavior.
- The smoke test fails on horizontal overflow and on client-portal exposure of technical terms such as prompt/model/SIP/API/schema.
- Default target is `http://127.0.0.1:3009`; override with `MUJAWIB_BASE_URL`.
