# Full names stay on the teacher's computer

This replaces ADR 0001, which discarded everything but a first name and a short
last-name prefix at import. Its reasons were the public door screen and a
hosted database that might leak; the hosted database is gone (ADR 0005), and
what the door shows is a display choice, not a storage one. Meanwhile one Roster
across classes (ADR 0015), and any later sharing between teachers, need to
recognise the same child reliably, which "Maya Che." can't do. So the teacher's
computer now keeps each student's full name. Everything students or passers-by
can see — the kiosk and the Student link — still receives only Display Names.

## Consequences

- Display Names need only be unique within a class, since that is all a kiosk
  or Student link ever shows; the teacher's own screens can use full names.
- The Backup file now holds full names, and the backup screen says so.
- Students imported before this change have no full name. Their Display Name
  stands in until the teacher pastes the class list again, which fills full
  names in by matching first name and prefix and asks when a match is unclear.
- Easy to reverse in this direction: dropping full names later is a truncation,
  not a re-import.
