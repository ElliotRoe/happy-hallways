import type { DataConnection, Peer } from 'peerjs';

/** A pairing code is the last part of a temporary address the kiosk dials once. */
export const pairingPrefix = 'hallway-pair-';

/** The teacher's computer answers the Student link at this address followed by the Room code. See docs/adr/0019. */
export const studentLinkPrefix = 'hallway-room-';

/**
 * Happy Hallways' own matchmaking server (a standard PeerJS server). It only
 * introduces devices to each other; it stores nothing. Both names point at the
 * same server, so a kiosk and a laptop that reach it by different names still
 * find each other. Some school filters block teacher.dev, so it is the fallback.
 * Set VITE_PEER_HOST (and VITE_PEER_PORT, VITE_PEER_PATH, VITE_PEER_SECURE) in
 * .env.local to point at another one, e.g. a local `peerjs` server while testing.
 */
const env = import.meta.env;
const hosts = env.VITE_PEER_HOST ? [env.VITE_PEER_HOST as string] : ['peer.happyhallways.com', 'peer.teacher.dev'];
const server = {
  port: Number(env.VITE_PEER_PORT || 443),
  path: (env.VITE_PEER_PATH as string) || '/peerjs',
  secure: env.VITE_PEER_SECURE !== 'false',
};

/**
 * Google's public STUN server only tells each device its own network address.
 * When a network blocks direct connections, the encrypted data is relayed
 * through Cloudflare's TURN servers, which can't read it. /api/turn hands out
 * logins for them that expire, so they are fetched again every few hours.
 */
const stun: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };
const refreshRelayMs = 4 * 60 * 60_000;

/**
 * Set VITE_FORCE_TURN=true in .env.local to send everything through the relay,
 * even when a direct connection would work. Only for testing the relay.
 */
const iceTransportPolicy: RTCIceTransportPolicy = env.VITE_FORCE_TURN === 'true' ? 'relay' : 'all';

let relay: { servers: RTCIceServer[]; fetchedAt: number } | null = null;
let relayProblem = '';

async function iceServers(): Promise<RTCIceServer[]> {
  if (relay && Date.now() - relay.fetchedAt < refreshRelayMs) return [stun, ...relay.servers];
  try {
    const response = await fetch('/api/turn', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) relay = { servers: (await response.json()).iceServers, fetchedAt: Date.now() };
    relayProblem = response.ok ? '' : `answered ${response.status}`;
  } catch (error) {
    // No relay this time; devices can still connect directly where the network allows.
    relayProblem = String(error);
  }
  return relay ? [stun, ...relay.servers] : [stun];
}

/**
 * Finds the first matchmaking server name this device can reach, by asking it
 * for a spare address the way PeerJS itself would. Once one works, this page
 * keeps using it. If none answer, PeerJS tries the last one and reports why.
 */
let reachableHost: string | null = null;

async function pickHost(): Promise<string> {
  if (reachableHost) return reachableHost;
  if (hosts.length === 1) return hosts[0];
  for (const host of hosts) {
    const address = `${server.secure ? 'https' : 'http'}://${host}:${server.port}${server.path}/peerjs/id`;
    try {
      const response = await fetch(address, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      // A filter's block page can also answer "OK", so check it really sent an address.
      if (response.ok && /^[\w-]{8,}$/.test((await response.text()).trim())) return (reachableHost = host);
    } catch {
      // Blocked or offline; try the next name.
    }
  }
  return hosts[hosts.length - 1];
}

/** How this page is set up to connect, for a support report. */
export function connectionSetup() {
  const relayRoutes = relay?.servers.flatMap((server) => [server.urls].flat()) ?? [];
  return {
    matchmakingServer: reachableHost ?? hosts.join(' or ') + ' (not reached yet)',
    relay: relay ? `${relayRoutes.length} routes` : `no logins (${relayProblem || 'not asked yet'})`,
    relayOnly: iceTransportPolicy === 'relay',
  };
}

/** Every connection this page opened, so they can all be closed when it goes away. */
const live = new Set<Peer>();

/**
 * Closing a connection frees its address on the matchmaking server straight away.
 * Without this, a reload leaves the old address "taken" for a while and the new
 * page cannot claim it.
 */
function releaseAll() {
  for (const peer of live) peer.destroy();
  live.clear();
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', releaseAll);
// During development, Vite swaps code in place; close the old connections first.
import.meta.hot?.dispose(releaseAll);

/**
 * Opens a connection to our matchmaking server. If it drops, it tries
 * again after 3 seconds, then 6, 12… up to a minute, so an unreachable server
 * is not hammered.
 */
export async function createPeer(id?: string): Promise<Peer> {
  const { Peer } = await import('peerjs');
  const options = { ...server, host: await pickHost(), config: { iceServers: await iceServers(), iceTransportPolicy } };
  const peer = id ? new Peer(id, options) : new Peer(options);
  live.add(peer);

  // Pages stay open for days, so swap in fresh relay logins before the old ones expire.
  const refreshRelay = window.setInterval(async () => {
    options.config.iceServers = await iceServers();
  }, refreshRelayMs);

  let delay = 3000;
  let timer = 0;
  peer.on('open', () => (delay = 3000));
  peer.on('disconnected', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!peer.destroyed && peer.disconnected) peer.reconnect();
    }, delay);
    delay = Math.min(delay * 2, 60_000);
  });
  peer.on('close', () => {
    clearTimeout(timer);
    clearInterval(refreshRelay);
    live.delete(peer);
  });
  return peer;
}

/**
 * A direct connection can take a long time to notice that the other device has
 * vanished (battery died, Wi-Fi dropped). So both ends say "still here" every
 * few seconds, and treat a quiet connection as lost.
 */
const heartbeatMs = 5000;
const silentMs = 15_000;

export function keepAlive(connection: DataConnection) {
  let lastHeard = Date.now();
  connection.on('data', () => (lastHeard = Date.now()));
  const timer = window.setInterval(() => {
    if (!connection.open) return;
    if (Date.now() - lastHeard > silentMs) {
      clearInterval(timer);
      connection.close();
      return;
    }
    connection.send({ type: 'ping' });
  }, heartbeatMs);
  connection.on('close', () => clearInterval(timer));
}
