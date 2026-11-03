import { describe, expect, it, vi } from "vitest";
import { escapeCloses } from "./layers";

const press = (key: string, target: EventTarget = window) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

describe("escapeCloses", () => {
  it("closes only the newest layer, one per press", () => {
    const settings = vi.fn();
    const search = vi.fn();
    const removeSettings = escapeCloses(settings);
    const removeSearch = escapeCloses(search);

    press("Escape");
    expect(search).toHaveBeenCalledTimes(1);
    expect(settings).not.toHaveBeenCalled();

    // the search closing unregisters it, as its effect does
    removeSearch();
    press("Escape");
    expect(settings).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
    removeSettings();
  });

  it("claims the press it acts on", () => {
    const remove = escapeCloses(() => {});
    expect(press("Escape").defaultPrevented).toBe(true);
    remove();
    expect(press("Escape").defaultPrevented).toBe(false);
  });

  it("leaves a press alone once something else has handled it", () => {
    const close = vi.fn();
    const remove = escapeCloses(close);
    const field = document.createElement("input");
    document.body.append(field);
    // a search field clearing its text deals with Escape first
    field.addEventListener("keydown", (event) => event.preventDefault(), { once: true });

    press("Escape", field);
    expect(close).not.toHaveBeenCalled();

    press("Escape", field);
    expect(close).toHaveBeenCalledTimes(1);
    remove();
    field.remove();
  });

  it("ignores other keys", () => {
    const close = vi.fn();
    const remove = escapeCloses(close);
    press("Enter");
    press("Tab");
    expect(close).not.toHaveBeenCalled();
    remove();
  });

  it("unregisters the right layer when one in the middle closes first", () => {
    const [a, b, c] = [vi.fn(), vi.fn(), vi.fn()];
    const removeA = escapeCloses(a);
    const removeB = escapeCloses(b);
    const removeC = escapeCloses(c);
    removeB();
    press("Escape");
    expect(c).toHaveBeenCalledTimes(1);
    removeC();
    press("Escape");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    removeA();
  });
});
