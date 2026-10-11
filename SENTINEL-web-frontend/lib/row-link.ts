import type { MouseEvent } from "react";

// Lets a whole table row act like the link or button inside it. That control
// stays the keyboard and screen-reader target; the row is a larger mouse target.
export function forwardRowClick(event: MouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  if (target.closest("a, button") || window.getSelection()?.toString()) return;
  event.currentTarget.querySelector("a, button")?.dispatchEvent(
    new globalThis.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    }),
  );
}
