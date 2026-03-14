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
    try {
      const res = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setResponse(data.result);
    } catch (err) {
      setResponse("Error: " + String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const shortcut = "CommandOrControl+Alt+A";

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
        {isLoading ? "Thinking..." : response || "Press Ask to test Groq."}
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
