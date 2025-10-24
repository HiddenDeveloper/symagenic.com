// src/main.tsx
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ConversationHSMCoordinator } from "./contexts/ConversationHSMCoordinator";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConversationHSMCoordinator>
      <App />
    </ConversationHSMCoordinator>
  </React.StrictMode>,
);
