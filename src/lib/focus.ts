/** `onmousedown` handler for buttons that shouldn't take focus when clicked with a mouse (keyboard focus still works). */
export function preventMouseFocus(event: MouseEvent) {
  event.preventDefault();
}

/** True when a click was triggered from the keyboard (Enter/Space), so focus should follow the action. */
export function isKeyboardClick(event: MouseEvent): boolean {
  return event.detail === 0;
}
