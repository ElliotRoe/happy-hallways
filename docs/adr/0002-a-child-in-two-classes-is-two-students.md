---
status: superseded by ADR-0015
---

# The same child in two classes is two unrelated students

A teacher who has the same child in Period 1 and Period 5 gets two independent
roster entries, and nothing in the product connects them — not analytics, not
export, not the door screen. We considered a shared student identity with a
join to each class, and rejected it: it is rare, it makes "who is out right now"
ambiguous across periods, and a shared record would let one class's history be
read from another.

This is the kind of thing a future contributor will read as an oversight and
offer to normalise. It is not an oversight. If cross-class identity is ever
genuinely wanted, it should arrive as a deliberate feature with its own decision
recorded here, not as a schema cleanup.
