import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

// Fetch runtime config from backend and initialise analytics if a tag ID is set.
fetch("/api/v1/config")
  .then((r) => r.json())
  .then((cfg: { google_tag_id?: string }) => {
    if (cfg.google_tag_id) initAnalytics(cfg.google_tag_id);
  })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
