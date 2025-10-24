// src/main.tsx
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from '@sentry/react';

import App from "./App";
import { ConversationHSMCoordinator } from "./machines/ConversationHSMCoordinator";

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://9d2731127a7ed888f9f54782a7051cfb@o4509942645784576.ingest.us.sentry.io/4509942670163968',
  environment: import.meta.env.MODE || 'development',
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConversationHSMCoordinator>
      <App />
    </ConversationHSMCoordinator>
  </React.StrictMode>,
);
