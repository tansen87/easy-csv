import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useLanguage, resolveSystemLanguage, LanguageProvider } from "@/i18n";
import { translations, type Language } from "@/i18n/translations";

function setNavigatorLanguage(lang: string) {
  Object.defineProperty(navigator, "language", {
    configurable: true,
    get: () => lang,
  });
}

function Harness() {
  const { language, effectiveLanguage, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="effective-language">{effectiveLanguage}</span>
      <span data-testid="text">{t.rows}</span>
      <button data-testid="switch-en" onClick={() => setLanguage("en")}>
        to-en
      </button>
      <button data-testid="switch-system" onClick={() => setLanguage("system")}>
        to-system
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <LanguageProvider>
      <Harness />
    </LanguageProvider>,
  );
}

describe("resolveSystemLanguage", () => {
  afterEach(() => {
    setNavigatorLanguage("en-US");
  });

  it.each([
    ["zh-CN", "zh"],
    ["zh-TW", "zh"],
    ["zh-HK", "zh"],
    ["zh-Hans", "zh"],
    ["zh", "zh"],
    ["en-US", "en"],
    ["fr-FR", "en"],
    ["", "en"],
  ] as [string, Language][])(
    "navigator.language = %s → %s",
    (raw, expected) => {
      setNavigatorLanguage(raw);
      expect(resolveSystemLanguage()).toBe(expected);
    },
  );
});

describe("getInitialLanguage (via Provider)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setNavigatorLanguage("en-US");
  });

  it("no stored value → 'system'", () => {
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("system");
  });

  it("stored 'zh' → 'zh'", () => {
    window.localStorage.setItem("easy-csv-language", "zh");
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("zh");
  });

  it("stored 'system' → 'system'", () => {
    window.localStorage.setItem("easy-csv-language", "system");
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("system");
  });

  it("stored invalid value → 'system'", () => {
    window.localStorage.setItem("easy-csv-language", "ja");
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("system");
  });

  it("localStorage throws → 'system'", () => {
    const spy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("localStorage blocked");
      });
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("system");
    spy.mockRestore();
  });
});

describe("LanguageProvider integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setNavigatorLanguage("en-US");
  });

  it("system preference + Chinese system language → zh effective & translations", () => {
    setNavigatorLanguage("zh-CN");
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("system");
    expect(screen.getByTestId("effective-language").textContent).toBe("zh");
    expect(screen.getByTestId("text").textContent).toBe(translations.zh.rows);
  });

  it("system preference + English system language → en effective & translations", () => {
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("system");
    expect(screen.getByTestId("effective-language").textContent).toBe("en");
    expect(screen.getByTestId("text").textContent).toBe(translations.en.rows);
  });

  it("explicit 'en' preference ignores system language", () => {
    window.localStorage.setItem("easy-csv-language", "en");
    setNavigatorLanguage("zh-CN");
    renderProvider();
    expect(screen.getByTestId("language").textContent).toBe("en");
    expect(screen.getByTestId("effective-language").textContent).toBe("en");
    expect(screen.getByTestId("text").textContent).toBe(translations.en.rows);
  });

  it("setLanguage updates effective language and persists", () => {
    setNavigatorLanguage("zh-CN");
    renderProvider();
    expect(screen.getByTestId("effective-language").textContent).toBe("zh");

    fireEvent.click(screen.getByTestId("switch-en"));
    expect(screen.getByTestId("language").textContent).toBe("en");
    expect(screen.getByTestId("effective-language").textContent).toBe("en");
    expect(screen.getByTestId("text").textContent).toBe(translations.en.rows);
    expect(window.localStorage.getItem("easy-csv-language")).toBe("en");

    fireEvent.click(screen.getByTestId("switch-system"));
    expect(screen.getByTestId("language").textContent).toBe("system");
    expect(screen.getByTestId("effective-language").textContent).toBe("zh");
    expect(window.localStorage.getItem("easy-csv-language")).toBe("system");
  });
});
