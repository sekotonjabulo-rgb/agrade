import { useCallback, useEffect, useState } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const SERVER_URL = "https://agrade-cbwf.onrender.com/ask";

export default function App() {
  const [response, setResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAskGroq = useCallback(async (base64Image: string) => {
    setIsLoading(true);
    setResponse("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        setResponse("Server is waking up — try again in 30 seconds.");
      }, 15000);
      const res = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Image }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      setResponse(data.result);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setResponse("Server timed out. Try again in 30 seconds.");
      } else {
        setResponse("Error: " + String(err));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const shortcut = "CommandOrControl+Shift+G";
    const setupShortcut = async () => {
      try {
        await unregister(shortcut);
      } catch (_) {}
      await register(shortcut, async () => {
        const screenBase64 = await invoke<string>("capture_screen");
        handleAskGroq(screenBase64);
      });
    };
    setupShortcut();
    return () => { unregister(shortcut); };
  }, [handleAskGroq]);

  const handleAsk = async () => {
    const screenBase64 = await invoke<string>("capture_screen");
    handleAskGroq(screenBase64);
  };

  return (
    <div className="overlay-container">
      <div className="overlay-header">
        <div className="overlay-brand">
          <div className="overlay-dot" />
          <span className="overlay-title">Agrade</span>
        </div>
        <span className="overlay-shortcut">⌘⇧G</span>
      </div>

      <div className="response-area">
        {isLoading ? (
          <div className="response-thinking">
            <div className="thinking-bars">
              <span /><span /><span />
            </div>
            Analysing
          </div>
        ) : response ? (
          <p className="response-text">{response}</p>
        ) : (
          <p className="response-empty">Awaiting capture</p>
        )}
      </div>

      <div className="overlay-footer">
        <button
          className="ask-button"
          onClick={handleAsk}
          disabled={isLoading}
        >
          Capture Screen
        </button>
      </div>
    </div>
  );
}
