import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Removed StrictMode to prevent double useEffect calls in development
// which causes game initialization to run twice
createRoot(rootElement).render(<App />);
