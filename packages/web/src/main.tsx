import { initWasm } from "@miu2d/engine/wasm";
import { createRoot } from "react-dom/client";
import "@miu2d/shared/i18n"; // 初始化 i18n
import "./styles/index.css";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// 初始化 WASM 后再渲染应用
initWasm().then(() => {
  createRoot(rootElement).render(<App />);
});
