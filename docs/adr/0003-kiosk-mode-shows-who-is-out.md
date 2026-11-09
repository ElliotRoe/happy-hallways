---
status: amended by ADR-0016 and ADR-0021
---

# Kiosk mode shows who is currently out

Kiosk mode displays each student's current state — "Out — Restroom" — so that a
returning student taps their own name and is offered "I'm back" instead of
having to know which action applies to them. This reverses an earlier stance, so
the reasoning matters.

When the door screen was a limited link account, it genuinely could not read the
pass log, and the interface said so. Since kiosk mode became the teacher's own
session locked behind a PIN, that restriction has been self-imposed rather than
enforced: the screen already holds a token that can read the roster and the log.
Keeping the interface deliberately ignorant bought no real protection while
costing every student a step and a chance to sign out when they meant to sign
in.

## Consequences

`SECURITY.md` claimed the kiosk does not request pass history. That claim must
be rewritten when this ships, not left standing.

Kiosk mode still shows no timing information of any kind — no elapsed minutes,
no overdue marker, no colour change. Overdue is a judgement for the teacher's
dashboard. A screen at the front of the room that visibly counts up against a
child is a different product than the one we are building.
