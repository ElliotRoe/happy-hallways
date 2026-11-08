---
status: superseded by ADR-0014
---

# Local-first, with the kiosk in charge of the door

Hallway has no server. A teacher's data lives in their laptop's browser, and the
kiosk talks to that laptop directly, device to device, after a one-time pairing.
A small matchmaking server of our own (a standard PeerJS server) introduces the
two devices and stores nothing. Pass data normally travels directly between
them; on networks that forbid that, it is relayed, still encrypted, through
Cloudflare's TURN relay. We dropped the hosted database because accounts, passwords and a
server holding a class list of minors were costs teachers never asked for, and
the export file gives them a way back if a browser is lost.

Because laptops close and leave the room, the kiosk is the authority on what is
happening at the door right now — who is out and whether the pass limit is
reached — and keeps working without the laptop. The laptop is the permanent
record: it collects the kiosk's passes whenever the two can reach each other,
and its roster, destinations, pass limit and active class win over the kiosk's
copy.

## Consequences

- A device becomes a kiosk only by pairing successfully. If the network blocks
  a direct connection between devices, the only kiosk on offer is the teacher's
  own computer — passes are never collected somewhere they cannot later reach.
- One kiosk per teacher. Pairing a new one replaces the old; if the old kiosk
  comes back holding passes the laptop has not seen, those are kept before it
  is told it has been replaced.
- When a return is recorded on both devices, the earlier time wins.
- Clearing the browser's site data loses everything not yet exported.
