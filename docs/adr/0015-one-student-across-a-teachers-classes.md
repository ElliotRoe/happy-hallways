# One student across a teacher's classes

This replaces ADR 0002, which made the same child in two classes two unrelated
students. Teachers asked again and again to see that a student just went in
the previous period, and to cap passes per day rather than per class; and a
student acting from their own device (ADR 0016) should be one person with one
PIN and one Claim, not one per period. So each teacher keeps a single Roster,
and a class draws its students from it. ADR 0002's worry, that "who is out right
now" becomes ambiguous across periods, does not arise: only the Active Class is
at the door, and the teacher's computer decides (ADR 0014).

## Consequences

- At import, a name that matches someone already on the Roster is offered as
  the same student, defaulting to yes. Teachers with existing data get a
  one-time screen offering the same merges.
- The Pass Allowance counts a student's passes across every class they have
  with the teacher. History can be read per student across classes.
- Exempt and Always-Go belong to the student, not the class.
- A Former Student has left one class; they stay in any other.
- This is one teacher's Roster. Sharing students between teachers is a separate
  decision still to be made.
