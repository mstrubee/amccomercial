import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale chunk errors after a new deploy.
// When the browser has an old index-*.js cached and tries to import a
// hashed chunk that no longer exists, force a one-time hard reload.
const RELOAD_FLAG = "__lov_chunk_reload__";
function isChunkLoadError(message?: string) {
  if (!message) return false;
  return (
    message.includes("Importing a module script failed") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError")
  );
}
function handleChunkError(message?: string) {
  if (!isChunkLoadError(message)) return;
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
}
window.addEventListener("error", (e) => handleChunkError(e?.message));
window.addEventListener("unhandledrejection", (e) => {
  const reason: any = e?.reason;
  handleChunkError(typeof reason === "string" ? reason : reason?.message);
});
// Clear the flag once the app successfully mounts.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 2000);
});

createRoot(document.getElementById("root")!).render(<App />);
