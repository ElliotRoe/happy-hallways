---
status: superseded by ADR-0022
---

# The Student link shows no student names

The Student link (ADR 0012) showed anyone with it the Display Names of everyone
out or in line, and a student claiming a device (ADR 0016) was sent the whole
class's names to pick from. A link can be forwarded, so that put a class list of
minors on devices nobody knows. Now no other student's name ever leaves the
teacher's computer. Every device sees how the door stands in numbers: whether
passes are open, and how many are out and waiting at each destination. A
student sets up their device by typing their first name and PIN, matched on the
teacher's computer, so no list is sent; a claimed device then shows only its own
student's status. Names stay on the kiosk, the one screen that is in the room.

## Consequences

- Students can't see who is ahead of them in a Line, only how many are waiting
  and their own place.
- Claiming needs PINs to be on, so a teacher without PINs has a look-only link.
- Someone guessing must know a classmate's first name and their PIN; five wrong
  tries make a device wait a minute.
- Notices sent to a student's device never name anyone else (the kiosk's
  "Jordan, it's your turn" stays on the kiosk).
