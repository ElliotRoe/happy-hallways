# Student devices show names; each class chooses what students see

Superseded in part by ADR 0024: devices without a Claim are never sent names; these settings now decide what set-up devices see.

ADR 0018 kept every other student's name off students' devices, because a
link could be forwarded and put a class list of minors on devices nobody
knows. Since ADR 0019 a device joins a Room that lasts one class period, with
a code shown only in the room, and the old code stops working when the class
changes. A forwarded code is useless by the next period, so the risk that
justified numbers-only is small, and the numbers-only view left Watching
students (in the Room without a Claim) unable to see what the kiosk on the
wall already shows them. So a Watching device sees names again, by default:
who's out and where, and who's in each Line, by Display Name, exactly as the
kiosk shows it. A claimed device sees its own student plus the same.

Teachers asked, often, to hide things instead: where students went (so
nobody times a trip to the bathroom with a friend), and who's waiting. So each
class has three settings under "What students can see", all on by default:

- **Show names on student devices.** Off, devices see only counts, as ADR
  0018 had it. This keeps the "students time their trips together" asks
  covered.
- **Show where students went.** Off, every pass is just "Out" on the kiosk's
  tiles and notices and on devices, and Lines are shown as one, but Lines and
  limits keep working. This is how a teacher hides the bathrooms; a Private
  destination (ADR 0021) can't have a Line, so it isn't the same.
- **Show who's in line.** Off, the kiosk's line strip and devices show only
  how many are waiting. Each student still sees their own place after tapping
  their name, or on their claimed device; the kiosk still calls the student
  who is Up Next.

Names stay on the kiosk's tiles whatever the settings (ADR 0003). The teacher
always sees everything.

## Consequences

- Supersedes ADR 0018. Claiming still sends no list of names: a student types
  their first name and PIN, matched on the teacher's computer.
- Private destinations still show only as "Out" (ADR 0021); Exempt and
  Always-Go are never shown to students (ADR 0011).
- A kiosk on an older version ignores the settings and shows everything until
  it refreshes.
- The Student devices page and Home count devices in the Room as set up and
  Watching.
