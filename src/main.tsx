import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
