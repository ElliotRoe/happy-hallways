---
status: amended by ADR-0016, ADR-0018 and ADR-0019
---

# Students view the Line from a link, served by the teacher's computer

Until now, the only place a student could see who was out, or how far along
the Line they were, was the kiosk by the door. Now the teacher can open a
**Student link** and post it, say in Google Classroom. On their own Chromebook or phone, students see what the
door screen shows about the Active Class: who is out and where they went, each
Line in order, and whether passes are open or it's a No-Pass Time. The page
updates itself as passes start and end. It only looks; signing out still
happens at the kiosk.

Students' devices connect to the **teacher's computer**, not the kiosk, over
the same PeerJS and WebRTC connection the kiosk uses, relayed through
Cloudflare's TURN servers where a network blocks direct connections (see ADR
0005). We chose the teacher's computer because it already hears everything the
door knows (the kiosk sends it every pass, the Line and the Active Class) or
is the kiosk itself; because a kiosk is often a cheap tablet that should spend
its effort on the door; and because the teacher opens, closes and replaces the
link from the computer they are sitting at. We kept to no server: a hosted
page would have meant a class list of minors stored somewhere we run.

## Consequences

- The link works only while Happy Hallways is open on the teacher's computer
  and the link is open. Otherwise students see that they can't reach their
  teacher's computer, or that the link is closed, and the page keeps trying.
  It starts closed.
- Anyone with the link can see the Display Names on it. The link holds a long
  random id; "Get a new link" gives it a new one, and the old one stops working
  at once. Closing it turns everyone away while keeping the same link for next
  time.
- Students see only what the door screen already shows the whole room. Never
  how long anyone has been out (ADR 0003), the PIN, the rest of the roster, or
  whether a student is exempt or can always go (ADR 0011). A pass by an
  Always-Go Student shows as an ordinary pass.
- At most 40 devices watch at once, each holding its own connection to the
  teacher's browser; the rest are told there are too many people viewing and
  try again later.
- Only one tab can answer the link. Another tab of Happy Hallways on the same
  computer shows how many are watching and takes over if that tab closes, as it
  does for the kiosk's address.
- Messages are typed, so a student asking for a pass from their own device
  (ADR 0009) can be added later over the same link, without changing it. That
  would need the student to prove who they are, which this link does not do.
- The link's id is part of the Backup, so restoring it on another computer
  keeps the same link.
