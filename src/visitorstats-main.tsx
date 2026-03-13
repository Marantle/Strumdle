import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import VisitorStats from "./pages/VisitorStats";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VisitorStats />
  </StrictMode>,
);
