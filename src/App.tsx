import { useCallback, useEffect, useState } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export default function App() {
  const [response, setResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAskGroq = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 512,
        }),
      });
      const data = await res.json();
      setResponse(data.choices[0].message.content);
    } catch (err) {
      setResponse("Error reaching Groq.");
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
        handleAskGroq(
          `Based on this screen content, provide a helpful response: ${screenText}`,
        );
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
          handleAskGroq(
            `Based on this screen content, provide a helpful response: ${screenText}`,
          );
        }}
      >
        Ask
      </button>
    </div>
  );
}