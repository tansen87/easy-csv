import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { Toast, ToastContainer } from "@/components/setting/Toast";

const withProvider = (node: React.ReactElement) =>
  render(<LanguageProvider>{node}</LanguageProvider>);

describe("Toast action button (design 027 §4.3)", () => {
  it("renders an action button and fires it, dismissing the toast", () => {
    const onClose = vi.fn();
    const onClick = vi.fn();
    withProvider(
      <Toast
        message="Pipeline finished"
        type="success"
        onClose={onClose}
        duration={60_000}
        action={{ label: "View result", onClick }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View result" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Regression guard: toasts without an action must behave as before — the
  // completion toast is the only one that gains an extra button.
  it("renders no action button when none is given", () => {
    withProvider(
      <Toast
        message="Just a message"
        type="info"
        onClose={vi.fn()}
        duration={60_000}
      />,
    );

    expect(screen.queryByText("View result")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Just a message")).toBeInTheDocument();
  });

  it("is reachable through the container despite its pointer-events-none layer", () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    withProvider(
      <ToastContainer
        toasts={[
          {
            id: "1",
            message: "Pipeline finished",
            type: "success",
            action: { label: "View result", onClick },
            duration: 60_000,
          },
        ]}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View result" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("still auto-dismisses when a duration is set", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    withProvider(
      <Toast
        message="Bye"
        type="info"
        onClose={onClose}
        duration={1000}
        action={{ label: "View result", onClick: vi.fn() }}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
