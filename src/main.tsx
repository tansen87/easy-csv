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
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
