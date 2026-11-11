# Names go only to devices set up with a PIN

Supersedes the "Watching devices see names" part of ADR 0022.

ADR 0022 sent who's out and who's in line, by Display Name, to every device in
the Room, on the grounds that a code lasted one class period and was shown only
in the room. Since ADR 0023 a class keeps its code, so a code that got around
reaches more people, and anyone holding it while the class is on would get a
list of minors' names. So a Watching device (in the Room without a Claim) is
never sent a name: it gets whether passes are open, how many are out at each
destination, and how many are waiting in each Line. The teacher's computer
leaves the names out before sending, so they never reach the device at all.

A device set up with a first name and PIN (a Claim) gets the names too, if the
class's "Show names on student devices" and "Show who's in line" are on: having
a PIN is good evidence the device belongs to someone in the class.

## Consequences

- Each device gets its own view: the teacher's computer works out the counts
  view and the named view, and sends each device the one it's allowed. A device
  that sets up starts getting names at once; one whose Claim ends goes back to
  counts.
- Notices and a student's own status already go only to that student's claimed
  device, and are unchanged.
- The class settings in ADR 0022 now decide only what set-up devices see (and
  the kiosk).
