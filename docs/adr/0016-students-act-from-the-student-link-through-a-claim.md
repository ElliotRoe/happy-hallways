---
status: amended by ADR-0018 and ADR-0019
---

# Students act from the Student link through a Claim

The Student link (ADR 0012) only looked. Teachers kept asking for students to
make passes from their own Chromebooks and phones, often because they have no
spare device for a kiosk. Now a student can Claim their own device on the link
by typing their first name and PIN (ADR 0018); from then on, until the class
ends, that device can start a pass, sign back in, join or leave a Line and make
a Request, exactly as at the kiosk. A kiosk becomes optional.

We chose claiming once per class over typing a PIN for every action: a PIN typed
for every trip is a PIN classmates learn, and a classmate who learns a PIN still
can't act from a device someone else has already claimed. We rejected having the
teacher confirm every action, and an honor system.

At first a Claim lasted until it was ended. ADR 0019 changed that: every Claim
ends with its class period's Room, so students set up their device again in each
class. That costs a PIN typed once a period rather than once ever, which is a
little more exposure, but a Claim is only ever worth one class, no code or token
outlives its period, and no "students share devices" setting is needed: a cart
Chromebook is free again as soon as the class changes.

## Consequences

- No server we run ever holds student data, a Claim, or a record of who did
  what. A claimed device keeps only a random token that means nothing outside
  the teacher's computer. This is a hard rule for every student-facing feature,
  and the privacy page and SECURITY.md say plainly where the data is, without
  claiming anything about privacy laws.
- A PIN is never a real school ID number, and stays 3 to 6 made-up digits,
  because it is now also what a student types to Claim a device.
- A student has at most one claimed device. The teacher can end any Claim or all
  of them; a student can end their own. Every Claim ends when its Room ends,
  as the class changes (ADR 0019).
- A claimed device acts only while its student's class is the Active Class.
  There is no location check; passes made from the link are marked as such.
- Requests from claimed devices are answered where kiosk Requests are: on the
  teacher's computer, or with the Teacher PIN at the kiosk. Answering from the
  teacher's phone is a separate decision.
- A Room admits up to 100 devices at once (60 at first, raised so a large
  class fits). A claimed device is never turned away; devices that only look
  fill whatever room is left.
- On their own claimed device, a student sees their own passes left, place in
  each Line and how long their own pass has run. ADR 0003 still keeps everyone's
  times off shared screens, and nobody ever sees anyone else's.
