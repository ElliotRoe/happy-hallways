# The Student link is a Room for each class period

The Student link (ADR 0012) was one lasting address. Someone who once had it
could come back to it any time and keep guessing first names and PINs (ADR
0018) until one fit. Now each class period is a Room with its own six-digit
code, the way a classroom quiz game gives each game a code. Students type it at
/join or scan its QR code, shown on the kiosk, on the teacher's screen and in a
pop-out window for the board. When the Active Class changes, the Room ends and
the next class gets a new code, so a code is only worth anything during its own
class.

## Consequences

- Every Claim ends with its Room, so students set up their device again in each
  class. This replaces the "students share devices" setting, which ended Claims
  when the class changed: now that always happens.
- Wrong first-name-and-PIN tries are limited per device (5, then a minute's
  wait) and per Room (20 a minute from all devices together, then two minutes
  with no setups), so many devices can't guess faster.
- Six digits across every teacher can clash. A code another teacher's Room
  already has is replaced at once; the teacher's computer tells that apart
  from its own other tab, which says every few seconds that it holds the code.
- Codes are guessable in a way the old long random address wasn't, but a Room
  only shows numbers, never names (ADR 0018), and acting needs a first name and
  a PIN too.
- Old student link addresses show a page asking for the class's code.
