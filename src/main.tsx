import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { LiquidReferenceHeroV7 } from "@/components/LiquidReferenceHeroV7";
import "@/styles/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <LiquidReferenceHeroV7 />
  </StrictMode>,
);
