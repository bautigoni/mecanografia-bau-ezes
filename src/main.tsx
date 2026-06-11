import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { applyStoredGlass } from "./pages/GlassEditorPage";
import "./styles/global.css";

// Re-aplica los valores del editor liquid-glass (incluido el difuminado de
// modales) guardados en localStorage, antes del primer render.
applyStoredGlass();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
