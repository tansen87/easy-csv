import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter/index.css";
import "@fontsource/jetbrains-mono/index.css";
import App from "@/app/App";
import "./index.css";
import { AppProviders } from "@/app/providers/AppProviders";
import { usesCustomTitleBar } from "@/lib/platform";

// The Windows title bar is drawn in CSS, so the window itself is
// transparent and the rounded corners come from `.app-window`
// (see index.css). Other platforms keep the opaque native frame.
if (usesCustomTitleBar) {
  document.documentElement.dataset.customChrome = "true";
  // Default to "not maximized" *before* the first render: the CSS applies
  // the 8px radius only when this attribute reads "false", and TitleBar
  // writes it asynchronously after `isMaximized()` resolves — without the
  // default here the very first frames paint with square corners (071-era
  // QA feedback: "顶部有时候不是圆角"). A maximized start corrects itself
  // on the first resize event.
  document.documentElement.dataset.windowMaximized = "false";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
