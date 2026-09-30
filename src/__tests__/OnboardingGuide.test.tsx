import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { FirstStepGuide } from "@/components/onboarding/FirstStepGuide";
import { CommandList } from "@/modules/logs/CommandList";
import { xanCommands } from "@/data/commands";

function renderGuide(overrides: Partial<Parameters<typeof FirstStepGuide>[0]> = {}) {
  const props = {
    showGuide: true,
    commandCount: 61,
    onAddStep: vi.fn(),
    onAskAi: vi.fn(),
    onSeeExample: vi.fn(),
    onDismissGuide: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <LanguageProvider>
      <FirstStepGuide {...props} />
    </LanguageProvider>,
  );
  return { ...utils, props };
}

describe("FirstStepGuide (design 027 §4.2)", () => {
  it("renders the guide card only while the guide is due", () => {
    renderGuide({ showGuide: true });
    expect(screen.queryByTestId("onboarding-guide")).not.toBeNull();
  });

  it("hides the card once the guide has been seen", () => {
    renderGuide({ showGuide: false });
    expect(screen.queryByTestId("onboarding-guide")).toBeNull();
  });

  /**
   * Every route in the card must lead into a real action. There is deliberately
   * no mock/ghost node: "add an operation" has exactly one entry point (the
   * command panel), and the card's button opens that.
   */
  it("routes each option to its own action", () => {
    const { props } = renderGuide();

    fireEvent.click(screen.getByTestId("onboarding-add-step"));
    expect(props.onAddStep).toHaveBeenCalledTimes(1);
    expect(props.onAskAi).not.toHaveBeenCalled();
    expect(props.onSeeExample).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("onboarding-ask-ai"));
    expect(props.onAskAi).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("onboarding-see-example"));
    expect(props.onSeeExample).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("onboarding-dismiss"));
    expect(props.onDismissGuide).toHaveBeenCalledTimes(1);
  });

  it("keeps the gesture card available even without the guide", () => {
    renderGuide({ showGuide: false });
    expect(document.body.textContent).not.toBe("");
    // The gesture card is a persistent affordance, toggled rather than removed.
    const toggle = screen.getByRole("button", { expanded: false });
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { expanded: true }),
    ).toBeInTheDocument();
  });

  it("starts the gesture card expanded on the first run only", () => {
    renderGuide({ showGuide: true, gestureCardExpanded: true });
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });
});

describe("sample-pipeline reveal caption (design 027 §11.2)", () => {
  it("renders the step caption with its progress and fires skip", () => {
    const onSkipReveal = vi.fn();
    renderGuide({
      showGuide: false,
      reveal: { caption: "Click search → drop empty amounts", step: { index: 2, total: 3 } },
      onSkipReveal,
    });

    const pill = screen.getByTestId("onboarding-reveal");
    expect(pill.textContent).toContain("Click search → drop empty amounts");
    expect(pill.textContent).toContain("2/3");

    fireEvent.click(screen.getByTestId("onboarding-reveal-skip"));
    expect(onSkipReveal).toHaveBeenCalledTimes(1);
  });

  // Reading speed varies, so the pace must be the user's to set.
  it("offers a Next button that advances immediately", () => {
    const onAdvanceReveal = vi.fn();
    renderGuide({
      showGuide: false,
      reveal: { caption: "Click dedup", step: { index: 1, total: 3 } },
      onAdvanceReveal,
      onSkipReveal: vi.fn(),
    });

    fireEvent.click(screen.getByTestId("onboarding-reveal-next"));
    expect(onAdvanceReveal).toHaveBeenCalledTimes(1);
  });

  // Nothing left to advance to, so offering "Next" would be a dead button.
  it("offers Run instead of Next once the last step is on screen", () => {
    const onAdvanceReveal = vi.fn();
    renderGuide({
      showGuide: false,
      reveal: { caption: "Click groupby", step: { index: 3, total: 3 } },
      onAdvanceReveal,
      onSkipReveal: vi.fn(),
    });

    // Clicking it runs the pipeline (the handler switches on the index), so the
    // button stays — only its label changes.
    expect(screen.getByTestId("onboarding-reveal-next")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-reveal-next").textContent).toBe(
      "Run it",
    );
  });

  // The "now running it" phase has no step counter.
  it("renders without a counter when the step is omitted", () => {
    renderGuide({
      showGuide: false,
      reveal: { caption: "Three steps built — running it…" },
    });

    const pill = screen.getByTestId("onboarding-reveal");
    expect(pill.textContent).not.toMatch(/\d\/\d/);
  });

  it("renders no pill when there is nothing being revealed", () => {
    renderGuide({ showGuide: false, reveal: null });
    expect(screen.queryByTestId("onboarding-reveal")).toBeNull();
  });
});

describe("CommandList first-step hint (design 027 §4.2 item 2)", () => {
  const renderList = (showFirstStepHint: boolean) =>
    render(
      <LanguageProvider>
        <CommandList
          commands={xanCommands}
          onCommandClick={vi.fn()}
          searchQuery=""
          onSearchChange={vi.fn()}
          isVisible
          onClose={vi.fn()}
          showFirstStepHint={showFirstStepHint}
        />
      </LanguageProvider>,
    );

  it("shows the hint while the pipeline is still empty", () => {
    renderList(true);
    expect(
      screen.queryByTestId("command-list-first-step-hint"),
    ).not.toBeNull();
  });

  it("hides the hint once there is at least one step", () => {
    renderList(false);
    expect(screen.queryByTestId("command-list-first-step-hint")).toBeNull();
  });
});
