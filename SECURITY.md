# Hallway Security Model

Hallway is a local-first prototype. There is no server holding student data:
each teacher's Roster, classes and passes live in their own browser's local
storage, and that browser (the teacher's computer) decides everything at the
door. See `docs/adr/0014-the-teachers-computer-is-the-only-source-of-truth.md`.

**No student data on any server we run** is a hard rule for every
student-facing feature (`docs/adr/0016`).

## Where student data lives

This is a plain description of where data is. It makes no claim about any law
or regulation.

- **Records stay on the teacher's computer.** Every record Hallway keeps (the
  Roster, passes, History, Attendance) lives only in the teacher's own
  browser. We never receive, store or have access to it.
- **Students' devices** talk only to their teacher's computer. The only thing a
  student's device keeps is a Claim's random token (see below), which
  identifies nobody and means nothing outside that teacher's computer.
- **What passes through our servers:** the matchmaking server sees randomly
  generated device addresses; the TURN relay carries encrypted traffic it can't
  read; `/api/turn` hands out relay logins. None of them see names, PINs,
  passes or anything else about a student.
- **Full names never leave the teacher's computer**, except in a Backup file
  the teacher chooses to download (`docs/adr/0017`).
- **PINs are never real school ID numbers**: 3 to 6 made-up digits
  (`docs/adr/0013`, `docs/adr/0016`).

## What is stored, and where

- **On the teacher's computer:** everything, in local storage, unencrypted:
  the Roster with each student's **full name**, the letters shown for them in
  each class, PINs, passes, History, Attendance (the teacher's own log of
  arrivals, tardies and absences, `docs/adr/0020`), Claims and settings. Anyone who can use
  that browser profile can read it. The **backup file** is ordinary JSON that
  includes full names and PINs, and should be kept like any other class record.
- **Student names on the kiosk** are always the Display Name: a first name
  plus the fewest letters of the last name needed to tell classmates apart (at
  most three). The Student link shows no student names at all, except a
  claimed device's own student's (`docs/adr/0018`).
- **Student PINs** (only for classes that turn them on) are short numbers made
  up by Hallway or the teacher, never school ID numbers. A student has one PIN
  across all of the teacher's classes. PINs are in the backup file, but never
  in the History CSV.
- **On a paired kiosk:** what the teacher's computer shows it: each class's
  Display Names, destinations and limits, the teacher's PIN, the student PINs
  of classes that ask for them, open and today's passes, the Line and Requests.
  While it can't reach the teacher's computer it also keeps the times students
  signed back in or arrived, until it hands them over. Absent students are left
  off it. It never holds full names or the
  full history.
- **On a student's device, through the Student link:** while the teacher has
  it open, the name of the class on the door, whether passes are open, and how
  many students are out or waiting at each destination, shown while the page is
  open and not saved. Never a student's name. A device the student has Claimed
  also keeps one random token in its local storage, and is shown that student's
  own name, passes left, place in line and how long their own pass has run.

## The connection between kiosk and laptop

- Hallway's matchmaking server (`peer.happyhallways.com`, also reachable as
  `peer.teacher.dev`; a standard PeerJS server)
  introduces the two devices. It sees their randomly generated addresses but
  stores nothing and never receives pass data.
- Pass data travels over WebRTC's encrypted channel, directly between the
  devices where the network allows. Where it doesn't, it is relayed through
  Cloudflare's TURN servers (`turn.cloudflare.com`, also offered as
  `turn.happyhallways.com` and `turn.teacher.dev`), which pass the encrypted
  data along without being able to read it. The browser gets relay logins
  from `/api/turn` that expire after 12 hours; the Cloudflare token that
  creates them stays on the server. Anyone can ask `/api/turn` for logins, so
  someone could use the relay at our expense; a Cloudflare usage alert would catch
  that. Google's public STUN server helps each device learn its own network
  address; it sees no pass data.
- The kiosk sends the teacher's computer what a student did; the teacher's
  computer decides and answers. While they can't reach each other, the kiosk
  starts no passes; it only records students coming back.
- When pairing fails, the teacher can copy a connection report to send to
  support. It holds the browser, app version, connection states and error
  messages, but no student data, network addresses or relay logins.
- The 6-digit pairing code is a temporary address. It works once and expires
  after 10 minutes. A code could, rarely, be guessed by someone else in those
  minutes, and their device would become the kiosk. Pairing again replaces it.
- After pairing, the kiosk proves itself with a long random secret. The laptop
  ignores connections without the current kiosk's secret, except that a
  replaced kiosk may hand over returns it still holds, once.

## The Student link

- Students' browsers connect to the teacher's computer the same way the kiosk
  does: introduced by the matchmaking server, then over WebRTC's encrypted
  channel, directly or through the TURN relay. The kiosk is never involved.
- **Rooms** (`docs/adr/0019`): each class period is a Room with its own
  six-digit code, shown on the kiosk and the teacher's screen. When the class
  on the door changes, the Room ends and its code stops working; the next class
  gets a new one. Students join at `/join` or by scanning the code's QR code.
  "New code" replaces the current one at once, and "Close student link" turns
  everyone away. A code another teacher's Room already holds is replaced.
- **Anyone with the code can see what the Room shows**: numbers only, never a
  name, so a code passed around gives away nothing about who is in the class
  (`docs/adr/0018`).
- **Claims** (`docs/adr/0016`): a student types their first name and PIN once,
  and only while PINs are on; no list of names is ever sent to their device.
  The teacher's computer then gives that device a long random token. A
  device holding a valid token may act as that student only: start a pass,
  sign back in, join or leave a Line, make a Request, or undo its own pass,
  and only while that student's class is on the door. It can never do what the
  teacher's PIN does. The teacher's computer checks every action. A student has
  at most one claimed device; claiming another ends the first. Every Claim ends
  with its Room; the teacher can end one or all sooner. After 5 wrong tries a
  device waits a minute, and after 20 wrong tries in a minute from all devices
  together, nobody in that Room can set up a device for two minutes.
- The teacher's PIN is never accepted on a student's device.
- At most 60 devices can connect at once. A claimed device is never turned
  away; it takes the place of a device that is only looking.
- The connections are served by the teacher's open browser tab. Closing it, or
  the computer sleeping, ends them.

## What the PIN does and doesn't do

The teacher PIN locks the Hallway interface on the kiosk (switching class,
unpairing, leaving kiosk mode). It is stored in plain text in local storage on
the teacher's computer and the kiosk, so it does not stop a technically capable
person with access to the device's browser tools. For real classroom use, run
the kiosk device in its operating system's managed kiosk or guided-access mode.

Student PINs are the same: they stop a classmate tapping someone else's name,
not a determined attacker. At the kiosk there is no lockout after wrong tries,
and the teacher PIN also works for any student who forgot theirs. No student
PIN may equal the teacher PIN, so a student's own PIN never opens the teacher
menu.

## Kiosk screen

The kiosk shows who is out and where they went, never how long they've been
gone or whether they are overdue (`docs/adr/0003`). When the Pass Limit is
reached it says how many are out, never who. Only a student's own claimed
device shows how long their own pass has run.
