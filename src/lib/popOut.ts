/** Opens the Room code in its own small window, to put on the board or a second screen. See docs/adr/0019. */
export function popOutRoom() {
  window.open('/room', 'happy-hallways-room', 'popup,width=560,height=720');
}
