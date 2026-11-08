# The teacher's computer is the only source of truth

This replaces ADR 0005's split, in which the kiosk was in charge of the door and
kept working while the laptop was closed. Once students can act from their own
devices through the Student link (ADR 0016), which reach the teacher's computer
and not the kiosk, two devices would each be deciding who may leave, and their
Lines, limits and Pass Allowances would drift apart. So the teacher's computer
decides everything: who may leave, the Line, Requests and limits. The kiosk and
every claimed device only ask it and show its answer. We are still local-first,
with no server holding a class list: devices reach the teacher's computer
peer-to-peer, through the TURN relay where a network forbids that.

## Consequences

- The door works only while Happy Hallways is open and awake on the teacher's
  computer. When it can't be reached, the kiosk and the Student link start no
  passes, admit nobody from a Line and answer no Requests; they say they are
  waiting for the teacher's computer. Teachers who carry their laptop to a
  meeting or close the lid at lunch stop the door. We accept that.
- One exception: a student coming back is a fact, not a decision. A
  disconnected kiosk or claimed device records the time they came back and hands
  it over on reconnecting, so a dropped connection never leaves a pass running.
  An Arrival (ADR 0020) is the same kind of fact, and a disconnected kiosk
  records it the same way.
- To soften the cost, the teacher's computer keeps its screen awake while a
  class is Active, warns before its tab closes while students are out, and setup
  says plainly that the laptop must stay open.
- The kiosk no longer keeps an outbox of passes, and "the earlier return wins"
  only applies to returns recorded while disconnected.
- If a network blocks devices connecting, the teacher's own computer is still
  the only kiosk on offer.
