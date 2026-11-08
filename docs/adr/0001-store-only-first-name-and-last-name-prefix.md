---
status: superseded by ADR-0017
---

# Store only a first name and a last-name prefix

Student names are displayed on a screen mounted by a classroom door, where
anyone walking past can read them, and a database leak would expose a class list
of minors. Hallway therefore never stores a student's full last name: it keeps a
first name plus the fewest leading letters of the last name that tell the
student apart from everyone else in their class, and discards the rest at import
time.

## Consequences

Because the discarded letters are gone for good, this cannot be undone later by
running a migration — recovering full names would mean asking every teacher to
re-import every roster.

The prefix is capped at three letters, which is a privacy limit rather than a
technical one. Two students who still collide at three letters (two Maya Che...)
cannot be separated automatically, so the import stops and asks the teacher to
give one of them a different name or a nickname. Refusing the import is
deliberate: two identical names on the door screen means students sign out as
each other, and the day's log is wrong in a way nobody can untangle afterwards.
