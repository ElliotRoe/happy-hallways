# Happy Hallways

Happy Hallways records students leaving the classroom and coming back. A kiosk by the
door signs them out and in; the teacher watches from their own laptop. Everything
lives on the teacher's own devices; there is no server and no sign-in.

## Language

**Class**:
A group of students from the teacher's Roster seen together during one period.
_Avoid_: Section, classroom, group

**Roster**:
Every student a teacher teaches, across all their classes, each appearing once.
_Avoid_: Class list, student list, directory

**Student**:
One child on the teacher's Roster. The same child taught in two classes is one
student, so their passes, PIN and Claim follow them from class to class.
_Avoid_: Pupil, kid, roster entry

**Display Name**:
The only form of a student's name that students or passers-by ever see, on the
kiosk — a first name plus as many leading letters of the last name as it takes
to tell them apart from everyone else in their class ("Maya C.", or "Maya Che."
if a Maya Cha. shares the room). The student's full name stays on the teacher's
computer. A Student device shows no names but its own student's.
_Avoid_: Full name, last initial, student name

**Destination**:
A place a student may go. The teacher keeps one list for all their classes. A
destination may carry the number of minutes that trip is expected to take; one
without a time can never be Overdue. Each has a color and an icon, so students
recognise it at the kiosk. The kiosk and students' devices show destinations in
the teacher's order. A Private destination (the Nurse, the Counselor) shows
wherever students can see only as "Out", never by name or icon, and has no Pass
Limit or Line; the teacher always sees where.
_Avoid_: Reason, location, place

**Pass**:
One round trip — a student left for a destination and has, or has not yet, come
back.
_Avoid_: Trip, hall pass

**Pass Limit**:
The most students who may be out at the same time. The teacher chooses, in
Pass Options, how it works for all their classes: either each destination has
its own, or none at all — so the Restroom takes one at a time while the Nurse
and the Counselor take any number — or there is one Class Limit. Changing
between the two keeps the other's settings for when the teacher changes back.
_Avoid_: Max out, cap, capacity

**Class Limit**:
A Pass Limit shared by the whole class: the most students who may be out at
once, wherever they are going, counting only destinations marked as counting
toward it. Students still pick a destination, and it is still recorded. A trip
to a destination that doesn't count, such as the Nurse, is never held up and
takes none of its spots. While it is on, the limits on each destination are
kept but not used.
_Avoid_: Total limit, room limit, Pass Allowance (that is how many passes each student gets)

**Pass Allowance**:
How many passes each student may take in a stretch of time: per day, per week,
or since the teacher last reset it (for a quarter or a term). One setting for
all the teacher's classes, in Pass Options, counted for each student across
every class they have with the teacher. Only destinations marked as counting use it up; a trip to the
Nurse, for example, need not. When a student has used it all, the kiosk either
stops them or warns them and lets them go, as the teacher chooses. Off unless
the teacher turns it on.
_Avoid_: Pass Limit (that is how many may be out at once), quota, budget, cap

**Request**:
A blocked student asking the teacher to let them go, made at the kiosk or from
a claimed Student device. The
teacher sees what the student wants to do and answers yes or no, either on Home
or with their PIN at the kiosk; a yes starts the pass at once. Whatever was
blocking them, the teacher's choice is the same.
A student has at most one waiting Request. It ends unanswered if they cancel
it, the Active Class changes, or nothing blocks them any more. Asking needs the
kiosk to reach the teacher's laptop; otherwise only the PIN will do.
_Avoid_: Override, ask, permission

**Extra Pass**:
A pass taken after a student has used up their Pass Allowance, because the
teacher approved their Request or because the allowance only warns. It is
recorded and counted like any other pass, and marked as extra so the teacher
can see it later. A pass cancelled at the door is never extra, because it never
counts.
_Avoid_: Override, excused pass, bonus pass

**No-Pass Exception**:
A pass taken during No-Pass Time because the teacher approved the student's
Request. It is marked so the teacher can see it later.
_Avoid_: Extra Pass (that lifts the Pass Allowance), override, excused pass

**Line Skip**:
A pass taken once its Pass Limit is reached — the destination's own, or the
Class Limit — ahead of anyone in the Line, because the teacher approved the
student's Request. Those in line keep their places. It is marked so the
teacher can see it later.
_Avoid_: Cutting, priority, override

**Exempt Student**:
A student the Pass Allowance does not apply to. They never run out, but still
wait for a Pass Limit and No-Pass Time like everyone else. Every trip is still
recorded, and the kiosk never shows that they are exempt.
_Avoid_: Unlimited student, special student, accommodation

**Always-Go Student**:
A student the teacher has marked "Can always go", usually for a medical need
written into an IEP or 504 plan. Nothing at the kiosk ever holds them back:
not the Pass Allowance, a Pass Limit, the Line or No-Pass Time. They never join
a Line, and their trips take none of a Pass Limit's spots, so they never keep
anyone else waiting. Every pass they take is recorded and marked so the
teacher can see it later, and the kiosk never shows that they can always go.
_Avoid_: Exempt Student (that lifts only the Pass Allowance), unlimited student, medical pass, override

**PIN**:
A few digits (3 to 6) a student types at the kiosk after tapping their name, or
once to Claim their own device, so a classmate can't sign out or in as them. The
teacher turns PINs on or off for all their classes at once, on the Roster; they
are off unless the teacher turns them on. A class can then stop asking for them
(say, the youngest grades), and its students just tap their name and can't set
up their own device. A student has one PIN in every class.
Happy Hallways makes up a 4-digit PIN for each student, different from everyone
else's on the Roster and from the Teacher PIN; the teacher can change one or
bring their own in the class list.
The kiosk asks for it before anything that acts as that student, and never
shows it. A student who forgot theirs can be let through with the Teacher PIN.
It is never a real school ID number.
_Avoid_: Student ID, lunch number, code, password

**Teacher PIN**:
The teacher's own 4 to 8 digits, which unlock the teacher menu at the kiosk,
let a blocked student go, and stand in for a student's forgotten PIN.
_Avoid_: Password, admin code

**No-Pass Time**:
A stretch of the clock when the class on the kiosk may not start passes. Most
come from the Current Schedule and apply only while the teacher is On Schedule:
each schedule has its own, either the first or last minutes of a period
(set on each period, and copied to the rest in one click), or a fixed time
drawn on it. The teacher can also start one by hand from Home at any time, on or off
schedule, which lasts until they end it, even as classes change. Students already out can always come back,
and if the Line is on, students may join it and go once the No-Pass Time ends.
_Avoid_: Blackout, lockout, quiet time

**Line**:
Students waiting at the kiosk once a Pass Limit is reached, in the order they
joined, each with the destination they want. Each destination with its own
Pass Limit has its own line, and a destination with none never has one. Under
a Class Limit there is one line, the **Class Line**, for every destination
that counts toward it. A teacher turns lines on in Pass Options. When a spot
opens it is held for the first in that line, who is **Up Next**; nobody else
may take it, but students headed somewhere the line doesn't cover are not held
up. The line belongs to the class on the kiosk and empties when the class
changes. Being in line is not a pass and leaves nothing in history.
_Avoid_: Queue, wait list

**Schedule**:
A plan for one kind of school day, made of Periods and named by the teacher
however they like ("A Day", "Early Release"). A teacher whose day is the same
every day has just one; one with rotating days has one for each. The same class
may sit in different periods on different schedules.
_Avoid_: Bell schedule, timetable, rotation

**Period**:
One stretch of the clock in a Schedule, belonging to one class or to none, such
as lunch or planning. A period with a class may have No-Pass Time in its first
and last minutes.
_Avoid_: Class (that is the students), block, slot

**Current Schedule**:
The schedule the teacher last picked with "Use this". It stays picked, day
after day, until the teacher picks another; Happy Hallways never works out which
day it is. A teacher may have no schedules at all.
_Avoid_: Today's schedule, default schedule

**On Schedule**:
Whether the kiosk is following the Current Schedule, moving the Active Class by
itself as each period starts. Moving the class by hand, after a warning, takes
the teacher off schedule, and they stay off — even the next day — until they
put it back. Putting it back, or picking a schedule, jumps to whatever period
the clock is in, not to where they left off. Off schedule, the only No-Pass
Time is one the teacher starts by hand.
_Avoid_: Auto mode, autopilot, paused schedule

**Kiosk**:
The locked, student-facing device by the classroom door. A teacher has at most
one kiosk at a time; pairing a new one disconnects the old. A teacher may have
none, and students act from their Student devices instead. The kiosk acts only while
it can reach the teacher's computer, which decides who may leave.
_Avoid_: Kiosk mode, door screen, station, student mode

**Pairing**:
Making a device the teacher's kiosk, by typing a short code or scanning a QR code
shown on the teacher's laptop. It happens once; afterwards the kiosk finds the
laptop again on its own. The code is single-use and short-lived. A device that
has not paired successfully is never a kiosk; if pairing is impossible on the
network, the teacher's own computer is the kiosk.
_Avoid_: Linking, connecting, logging in

**Student device**:
A student's own Chromebook or phone, used the way they use the kiosk, by
joining the class's Room with its code or QR code. The teacher turns student
devices on or off for all their classes. Anyone in the Room sees what each
class lets students see: by default what the kiosk shows, who's out and where
and who's in each Line, or only how many (see ADR 0022). A device holding a Claim can also act as
that student, and shows that student their own status: start a pass, sign back
in, join or leave a Line, and make a Request. Students' devices connect to the
teacher's computer, not the kiosk, so they work only while Happy Hallways is
open there, and only while the teacher has student devices turned on.
_Avoid_: Student link (its old name), share link, public view, student view, student mode

**Room**:
What student devices join for one class period, with the class's code (or its QR
code) shown on the kiosk, the teacher's screen and the class's Settings. Each class
keeps its code, but the code works only while that class is the Active Class: each
time the Active Class changes, the old Room closes and the new class's opens, and
every Claim ends. Between classes there is no Room.
_Avoid_: Lobby, session, game, link (for the code)

**Claim**:
A Student device made to act as its student, by
typing their first name and PIN after joining the Room. It needs PINs to be on.
A student has at most one claimed device. A Claim lasts until its Room ends,
when the class changes; the teacher can end one sooner, and the device goes back
to only looking. Nothing about the Claim is kept anywhere but the teacher's
computer and the student's device.
_Avoid_: Login, account, sign-in, session, pairing (that makes a kiosk)

**Watching**:
A Student device in the Room without a Claim. It gets only counts, never a
name, and can't act as anyone. The Student devices page counts devices
that joined, and how many of them can take passes (hold a Claim).
_Avoid_: Anonymous mode, guest, viewer

**Active Class**:
The class the kiosk is currently showing. Changing it ends every pass still open
in the class being left. While the teacher is On Schedule it moves by itself as
each Period starts, and between periods there is none, so nobody can leave.
Otherwise it moves only when someone deliberately moves it — from the teacher's
laptop, or at the kiosk with the teacher's PIN — and moving it by hand takes the
teacher off schedule. Browsing a different class on the laptop does not move it.
_Avoid_: Current class, selected class

**Home**:
The teacher's one page for the school day, showing the Active Class right now:
who is out, each Line, open Requests and any No-Pass Time. From it the teacher
switches the Active Class or the Current Schedule, and steps off or back on
schedule.
_Avoid_: Dashboard, Now tab, class page

**History**:
Every pass and every answered Request, across all classes, for looking back
afterwards. Corrections are made there.
_Avoid_: Audit log, pass log, records

**Overdue**:
A pass that has lasted longer than its destination's expected minutes. Only Home and
History say a pass is overdue; kiosk mode never does.
_Avoid_: Late, over time, flagged

**Overdue Reminder**:
The teacher's laptop drawing the teacher's attention to a pass the moment it
becomes Overdue, naming the student, where they went and how long they have been
gone. It lasts until the student is back, whether they signed in or the teacher
marked them back; it cannot be waved away while they are still out. It shows in
Needs you. It never appears on the kiosk, so when the teacher's own computer is
the kiosk there is no reminder, and overdue passes are reviewed afterwards in
History.
_Avoid_: Alert, alarm, notification, flag

**Needs you**:
The panel in the corner of every teacher page holding what is waiting on the
teacher right now: Requests to answer and Overdue Reminders, with how the class
stands and the switch to stop or open passes. It slides up by itself when
something new needs the teacher.
_Avoid_: Notifications, inbox, control panel, requests tab

**Correction**:
A teacher's after-the-fact change to a pass — giving it to the student it really
belonged to, or adjusting when it started or ended. The pass is changed in place
and shows that it was corrected; the earlier reading is not kept.
_Avoid_: Edit, fix, override

**Former Student**:
A student who has left a class part-way through the year. They disappear from
that class's door screen but keep every trip they ever took, so the class's
history stays whole, and they stay in any other class they are still in. A
student who has history is never truly deleted.
_Avoid_: Archived student, deleted student, inactive student

**Attendance**:
The teacher's own record of whether each student came to each class on each
day: present, Tardy or Absent. It is one teacher's notes, not the school's
official attendance. It is one setting for all the teacher's classes, in Pass
Options, with the same Tardy and Absent minutes everywhere; it is off unless
the teacher turns it on.
_Avoid_: Roll call, register, official attendance

**Arrival**:
A student tapping in when they come into class, recorded with the time. It
happens only at the kiosk or by the teacher, never from a claimed device.
_Avoid_: Check-in, sign in, clock in, sign back in (that ends a pass)

**Tardy**:
A student whose Arrival came after their period began on the Schedule, plus
any grace minutes the teacher allows. Without a Schedule, only the teacher
marks a student Tardy. The teacher can mark a Tardy as excused.
_Avoid_: Late (Overdue is a pass that runs over time), tardy pass

**Absent**:
A student who did not come to a class that day. A student with no Arrival
becomes Absent once the teacher's set minutes have passed or the period ends,
but only in a class that became the Active Class that day.
An Absent student is hidden from the door; a later Arrival makes them Tardy.
At the kiosk, "Just arrived?" lets them arrive by typing their first name (and
PIN), without ever listing who is Absent.
"Gone for the day" makes a student Absent in the teacher's remaining classes
that day.
_Avoid_: Missing, away, out (that is a student on a pass)

**Backup**:
A single file holding everything the teacher's laptop knows: classes, students
(with their PINs), passes, destinations, Pass Options, schedules, the kiosk pairing and the Room. Restoring it replaces
everything in that browser and puts the teacher back exactly where they were.
Happy Hallways has no accounts or sign-in; the backup is the only copy that leaves the
browser.
_Avoid_: Account, profile, export file
