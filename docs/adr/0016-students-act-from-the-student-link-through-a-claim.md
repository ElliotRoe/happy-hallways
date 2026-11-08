---
status: amended by ADR-0018
---

# Students act from the Student link through a Claim

The Student link (ADR 0012) only looked. Teachers kept asking for students to
make passes from their own Chromebooks and phones, often because they have no
spare device for a kiosk. Now a student can Claim their own device on the link
by typing their first name and PIN once (ADR 0018); from then on that device can
start a pass, sign back in, join or leave a Line and make a Request, exactly as
at the kiosk. A kiosk becomes optional.

We chose claiming once over typing a PIN for every action, because a PIN typed
all day on personal devices is a PIN classmates learn, and a classmate who
learns a PIN still can't act from a device someone else has already claimed.
We rejected having the teacher confirm every action, and an honor system.

## Consequences

- No server we run ever holds student data, a Claim, or a record of who did
  what. A claimed device keeps only a random token that means nothing outside
  the teacher's computer. This is a hard rule for every student-facing feature,
  and the privacy page and SECURITY.md say so in terms of FERPA and COPPA.
- A PIN is never a real school ID number, and stays 3 to 6 made-up digits,
  because it is now also what a student types to Claim a device.
- A student has at most one claimed device. The teacher can end any Claim or all
  of them; a student can end their own. A teacher with shared devices (carts)
  can have every Claim end when the Active Class changes.
- A claimed device acts only while its student's class is the Active Class.
  There is no location check; passes made from the link are marked as such.
- Requests from claimed devices are answered where kiosk Requests are: on the
  teacher's computer, or with the Teacher PIN at the kiosk. Answering from the
  teacher's phone is a separate decision.
- The link admits up to 60 devices. A claimed device is never turned away;
  devices that only look fill whatever room is left.
- On their own claimed device, a student sees their own passes left, place in
  each Line and how long their own pass has run. ADR 0003 still keeps everyone's
  times off shared screens, and nobody ever sees anyone else's.
