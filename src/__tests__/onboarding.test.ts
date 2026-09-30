import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ONBOARDING_SEEN_KEY,
  hasSeenOnboarding,
  markOnboardingSeen,
  clearOnboarding,
} from "@/hooks/useOnboarding";

const realLocalStorage = window.localStorage;

/** Replace localStorage with one that throws, to test the degraded path. */
function breakLocalStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        throw new Error("storage disabled");
      },
      setItem() {
        throw new Error("storage disabled");
      },
      removeItem() {
        throw new Error("storage disabled");
      },
      clear() {
        throw new Error("storage disabled");
      },
    },
  });
}

describe("onboarding flag (design 027 §5)", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: realLocalStorage,
    });
    realLocalStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: realLocalStorage,
    });
  });

  it("starts unseen, flips to seen, and clears again", () => {
    expect(hasSeenOnboarding()).toBe(false);

    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
    expect(realLocalStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("done");

    clearOnboarding();
    expect(hasSeenOnboarding()).toBe(false);
    expect(realLocalStorage.getItem(ONBOARDING_SEEN_KEY)).toBeNull();
  });

  it("treats an unrelated stored value as unseen", () => {
    realLocalStorage.setItem(ONBOARDING_SEEN_KEY, "nope");
    expect(hasSeenOnboarding()).toBe(false);
  });

  // A store that throws must not crash startup, and must not nag on every open.
  it("degrades to 'seen' when localStorage is unavailable", () => {
    breakLocalStorage();

    expect(hasSeenOnboarding()).toBe(true);
    expect(() => markOnboardingSeen()).not.toThrow();
    expect(() => clearOnboarding()).not.toThrow();
  });
});
