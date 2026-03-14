import { useCallback, useEffect, useState } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const SERVER_URL = "https://agrade-cbwf.onrender.com/ask";

export default function App() {
  const [response, setResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAskGroq = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setResponse("Thinking...");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        setResponse("Server is waking up, please try again in 30 seconds.");
      }, 10000);

      const res = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
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
        const screenText = await invoke<string>("capture_screen");
        handleAskGroq(`Based on this screen content, provide a helpful response: ${screenText}`);
      });
    };

    setupShortcut();

    return () => {
      unregister(shortcut);
    };
  }, [handleAskGroq]);

  return (
    <div className="overlay-container">
      <div className="response-box">
        {isLoading ? "Thinking..." : response || "Press Ctrl+Shift+G or Ask."}
      </div>
      <button
        className="ask-button"
        onClick={async () => {
          const screenText = await invoke<string>("capture_screen");
          handleAskGroq(`Based on this screen content, provide a helpful response: ${screenText}`);
        }}
      >
        Ask
      </button>
    </div>
  );
}
