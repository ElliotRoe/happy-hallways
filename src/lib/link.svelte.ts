import type { DataConnection, Peer } from 'peerjs';
import {
  account,
  doorSetup,
  forgetReplacedKiosk,
  keptStudentId,
  markKioskSeen,
  onReload,
  onSave,
  pairDevice,
  receiveArrivals,
  receivePasses,
  receiveReturns,
  setNetworkBlocked,
} from './account.svelte';
import { clock } from './clock.svelte';
import { connectionReport, watchConnection } from './diagnostics';
import { newId } from './passes';
import { createPeer, keepAlive, pairingPrefix } from './peer';
import { perform } from './door.svelte';
import type { KioskMessage, LaptopMessage } from './types';

/**
 * The laptop's end of the kiosk connection. The two devices talk directly
 * (PeerJS over WebRTC); our matchmaking server only introduces them, and pass
 * data never passes through it. A network that blocks direct connections
 * relays the encrypted data through Cloudflare's relay (see peer.ts).
 *
 * This computer decides everything at the door; the kiosk asks it. See docs/adr/0014.
 */

const pairingMinutes = 10;
/** How long a device that found the code may take to open a direct connection. */
const connectSeconds = 20;

export const link = $state({
  /** live: the kiosk is connected. offline: we are listening, but it is not. taken: another tab holds this account. */
  status: 'off' as 'off' | 'offline' | 'live' | 'taken',
  pairing: null as null | { code: string; expiresAt: number; state: 'starting' | 'waiting' | 'connecting' | 'failed' },
  /** Why the last pairing attempt failed, for the teacher to send to support. */
  problem: null as null | { code: string; text: string },
});

let peer: Peer | null = null;
let kioskConnection: DataConnection | null = null;
let pairingPeer: Peer | null = null;
let starting: Promise<void> | null = null;
let pairingTimer = 0;

function send(connection: DataConnection | null, message: LaptopMessage) {
  if (connection?.open) connection.send(message);
}

/**
 * "Reconnect": the kiosk dials this laptop, so the laptop makes sure it's
 * listening right now. It skips the growing wait between tries after an
 * outage, and looks again if another tab seemed to hold the address.
 */
export function reconnectNow() {
  if (account.kiosk?.kind !== 'device' || kioskOnline()) return;
  if (link.status === 'taken') link.status = 'offline';
  if (peer && !peer.destroyed && peer.disconnected) peer.reconnect();
  else if (!peer || peer.destroyed) {
    peer = null;
    refreshLink();
  }
}

/**
 * Whether the paired kiosk is connected: to this tab, or to another tab of
 * Happy Hallways on this computer, which passes everything on. That tab
 * notes each time it hears from the kiosk, every few seconds.
 */
export function kioskOnline() {
  if (link.status === 'live') return true;
  const seen = account.kiosk?.kind === 'device' ? account.kiosk.lastSeenAt : undefined;
  return link.status === 'taken' && !!seen && clock.now - new Date(seen).getTime() < 30_000;
}

/** One line saying whether the kiosk is working, for the status box and Home. */
export function kioskState(): { text: string; dot: '' | 'live' | 'warn' } {
  const kiosk = account.kiosk;
  if (!kiosk) return { text: 'Kiosk not set up', dot: '' };
  if (kiosk.kind === 'this-computer') return { text: 'Kiosk on this computer', dot: 'live' };
  return kioskOnline() ? { text: 'Kiosk online', dot: 'live' } : { text: 'Kiosk offline', dot: 'warn' };
}

/** Keeps the kiosk's copy current whenever the teacher changes anything. */
let pushTimer = 0;
function pushSetup() {
  clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => send(kioskConnection, { type: 'setup', setup: doorSetup() }), 150);
}
onSave(pushSetup);

/**
 * Another tab changed the Account. If this tab is the one holding the
 * laptop's address, it must now accept the kiosk that tab paired (and let go
 * of one it stopped or replaced), and pass that tab's edits on to the door.
 */
onReload(() => {
  const kiosk = account.kiosk;
  const connectedTo = (kioskConnection?.metadata as { kioskId?: string } | undefined)?.kioskId;
  if (kioskConnection && (kiosk?.kind !== 'device' || kiosk.kioskId !== connectedTo)) {
    kioskConnection.close();
    kioskConnection = null;
    link.status = 'offline';
  }
  if (peer || starting) refreshLink();
  pushSetup();
});

/**
 * Listens for the kiosk when there is something to listen for: the paired
 * device, or a replaced one that may still owe passes. Call it after anything
 * about the kiosk changes; it starts, stops or leaves things as they are.
 */
export async function refreshLink() {
  const paired = account.kiosk?.kind === 'device';
  if (!paired) {
    kioskConnection?.close();
    kioskConnection = null;
  }
  if (!paired && !account.replacedKiosks.length) {
    peer?.destroy();
    peer = null;
    link.status = 'off';
    return;
  }
  // Another tab holds the address. Pages call this whenever anything changes,
  // so wait for the retry below rather than knocking again straight away.
  if (link.status === 'taken') return;
  if (link.status !== 'live') link.status = paired ? 'offline' : 'off';
  // Several screens call this at once; only the first may claim the address.
  if (peer || starting) return;
  starting = createPeer(account.laptopPeerId).then(async (created) => {
    peer = created;
    created.on('connection', accept);
    created.on('error', (error) => {
      // Two tabs (or two laptops with the same import) cannot both hold the
      // address. It may also be a reloaded page's old connection, which the
      // server frees shortly, so look again in a little while.
      if (error.type === 'unavailable-id' && peer === created) {
        link.status = 'taken';
        created.destroy();
        peer = null;
        setTimeout(() => {
          if (link.status !== 'taken') return;
          link.status = 'offline';
          refreshLink();
        }, 30_000);
      }
    });
    // Wait until the address is registered, so a kiosk that dials straight
    // away (as a newly paired one does) finds the laptop on its first try.
    if (!created.open) {
      await new Promise<void>((resolve) => {
        created.once('open', () => resolve());
        created.once('error', () => resolve());
        setTimeout(resolve, 10_000);
      });
    }
  });
  await starting;
  starting = null;
}

function accept(connection: DataConnection) {
  const { kioskId, secret } = (connection.metadata ?? {}) as { kioskId?: string; secret?: string };
  const kiosk = account.kiosk;
  if (kiosk?.kind === 'device' && kiosk.kioskId === kioskId && kiosk.secret === secret) {
    acceptCurrent(connection);
    return;
  }
  const replaced = account.replacedKiosks.find((each) => each.kioskId === kioskId && each.secret === secret);
  if (replaced) {
    acceptReplaced(connection, replaced.kioskId);
    return;
  }
  connection.on('open', () => connection.close());
}

function acceptCurrent(connection: DataConnection) {
  connection.on('open', () => {
    kioskConnection?.close();
    kioskConnection = connection;
    keepAlive(connection);
    link.status = 'live';
    markKioskSeen();
    send(connection, { type: 'setup', setup: doorSetup() });
  });
  connection.on('data', (data) => {
    const message = data as KioskMessage;
    markKioskSeen();
    if (message.type === 'act') {
      // A kiosk that hasn't heard about a merge may still tap the merged-away student.
      const action = 'studentId' in message.action ? { ...message.action, studentId: keptStudentId(message.action.studentId) } : message.action;
      perform(action, (notice, seconds) => send(connection, { type: 'notice', notice, seconds }));
    }
    if (message.type === 'returns') {
      receiveReturns(message.returns);
      send(connection, { type: 'returns-received', passIds: message.returns.map((back) => back.passId) });
    }
    if (message.type === 'arrivals') {
      receiveArrivals(message.arrivals);
      send(connection, { type: 'arrivals-received', arrivals: message.arrivals });
    }
    // Passes a kiosk saved before this version, handed over once.
    if (message.type === 'passes') {
      receivePasses(message.passes);
      send(connection, { type: 'ack', passes: message.passes.map(({ id, updatedAt }) => ({ id, updatedAt })) });
    }
  });
  connection.on('close', () => {
    if (kioskConnection !== connection) return;
    kioskConnection = null;
    link.status = 'offline';
  });
}

/** A replaced kiosk hands over the returns (or older passes) it was still holding, then is told to stand down. */
function acceptReplaced(connection: DataConnection, kioskId: string) {
  connection.on('data', (data) => {
    const message = data as KioskMessage;
    if (message.type === 'returns') {
      receiveReturns(message.returns);
      send(connection, { type: 'returns-received', passIds: message.returns.map((back) => back.passId) });
    }
    if (message.type === 'arrivals') {
      receiveArrivals(message.arrivals);
      send(connection, { type: 'arrivals-received', arrivals: message.arrivals });
    }
    if (message.type === 'passes') {
      receivePasses(message.passes);
      send(connection, { type: 'ack', passes: message.passes.map(({ id, updatedAt }) => ({ id, updatedAt })) });
    }
  });
  connection.on('open', () => {
    // Give it a moment to send its passes before telling it to stop.
    setTimeout(() => {
      send(connection, { type: 'replaced' });
      forgetReplacedKiosk(kioskId);
      setTimeout(refreshLink, 1000);
    }, 1500);
  });
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

function sixDigits() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}

/**
 * Shows a short code for the new device to dial. The code is single-use and
 * expires; once the devices connect, the kiosk gets a long secret and the
 * laptop's fixed address, and the code is thrown away.
 */
export async function beginPairing() {
  cancelPairing();
  // Every attempt is a fresh try: the network (or our relay) may have changed since the last one failed.
  link.problem = null;
  if (account.networkBlocked) setNetworkBlocked(false);
  const code = sixDigits();
  link.pairing = { code, expiresAt: Date.now() + pairingMinutes * 60_000, state: 'starting' };
  const temporary = await createPeer(pairingPrefix + code);
  pairingPeer = temporary;
  temporary.on('open', () => {
    if (link.pairing?.code === code) link.pairing.state = 'waiting';
  });
  temporary.on('error', async (error) => {
    if (pairingPeer !== temporary) return;
    if (error.type === 'unavailable-id') return beginPairing();
    if (!link.pairing) return;
    link.pairing.state = 'failed';
    link.problem = await connectionReport({
      problem: "Couldn't get a pairing code from the matchmaking server",
      side: 'teacher laptop',
      peerError: `${error.type}: ${error.message}`,
    });
  });
  temporary.on('connection', (connection) => {
    if (link.pairing?.code !== code) return;
    link.pairing.state = 'connecting';
    const watch = watchConnection(connection.peerConnection);
    // The device found the code but the network will not let the two talk
    // directly. Then only this computer can be the kiosk.
    const giveUp = setTimeout(async () => {
      // Read the connection's details before cancelling closes it.
      link.problem = await connectionReport({
        problem: `The door device found the code, but they couldn't connect within ${connectSeconds} seconds`,
        side: 'teacher laptop',
        connection: connection.peerConnection,
        watch,
      });
      setNetworkBlocked(true);
      cancelPairing();
    }, connectSeconds * 1000);
    connection.on('open', async () => {
      clearTimeout(giveUp);
      const kioskId = newId();
      const secret = newId() + newId();
      pairDevice(kioskId, secret);
      await refreshLink();
      send(connection, { type: 'paired', laptopPeerId: account.laptopPeerId, kioskId, secret, setup: doorSetup() });
      setTimeout(cancelPairing, 1500);
    });
  });
  clearTimeout(pairingTimer);
  pairingTimer = window.setTimeout(cancelPairing, pairingMinutes * 60_000);
}

export function cancelPairing() {
  clearTimeout(pairingTimer);
  pairingPeer?.destroy();
  pairingPeer = null;
  link.pairing = null;
}
