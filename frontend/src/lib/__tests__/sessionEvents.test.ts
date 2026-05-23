import { describe, it, expect, vi, beforeEach } from "vitest";
import { sessionEvents } from "@/lib/sessionEvents";

describe("sessionEvents", () => {
  beforeEach(() => {
    // Unsubscribe any lingering listeners from prior tests by re-importing wouldn't help;
    // instead we rely on each test managing its own subscription.
  });

  it("calls a registered listener when session expires", () => {
    const listener = vi.fn();
    const unsubscribe = sessionEvents.onSessionExpired(listener);

    sessionEvents.emitSessionExpired();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not call a listener after it is unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = sessionEvents.onSessionExpired(listener);
    unsubscribe();

    sessionEvents.emitSessionExpired();

    expect(listener).not.toHaveBeenCalled();
  });

  it("calls all registered listeners", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubA = sessionEvents.onSessionExpired(listenerA);
    const unsubB = sessionEvents.onSessionExpired(listenerB);

    sessionEvents.emitSessionExpired();

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });

  it("does not call remaining listeners when only one is unsubscribed", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubA = sessionEvents.onSessionExpired(listenerA);
    const unsubB = sessionEvents.onSessionExpired(listenerB);
    unsubA();

    sessionEvents.emitSessionExpired();

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubB();
  });
});
