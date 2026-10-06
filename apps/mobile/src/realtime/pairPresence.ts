/** Last known WS room size for this pair (socket count). Used by outbox flush heuristics. */
let lastRoomSize = 0;

export function setLastRoomSize(n: number) {
  lastRoomSize = Math.max(0, Math.floor(n));
}

export function getLastRoomSize() {
  return lastRoomSize;
}
