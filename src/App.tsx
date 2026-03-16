import { useCallback, useEffect, useState, useRef } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const SERVER_URL = "https://agrade-cbwf.onrender.com/ask";

interface Message {
  role: "user" | "ai";
  text: string;
  screenshotOnly?: boolean;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  };

  const handleAskGroq = useCallback(async (base64Image: string, userMessage?: string, screenshotOnly?: boolean) => {
    const userText = userMessage?.trim() || "";
    setMessages(prev => [...prev, {
      role: "user",
      text: userText || "",
      screenshotOnly: screenshotOnly && !userText,
    }]);
    setIsLoading(true);
    setTimeout(scrollToBottom, 50);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        setMessages(prev => [...prev, {
          role: "ai",
          text: "Server is waking up — try again in 30 seconds.",
        }]);
      }, 15000);
      const res = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Image, message: userText }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      setMessages(prev => [...prev, { role: "ai", text: data.result }]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "ai", text: "Error: " + String(err) }]);
      }
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 50);
    }
  }, []);

  useEffect(() => {
    const shortcut = "CommandOrControl+Shift+G";
    const setupShortcut = async () => {
      try { await unregister(shortcut); } catch (_) {}
      await register(shortcut, async () => {
        const screenBase64 = await invoke<string>("capture_screen");
        handleAskGroq(screenBase64, message, true);
        setMessage("");
      });
    };
    setupShortcut();
    return () => { unregister(shortcut); };
  }, [handleAskGroq, message]);

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return;
    const screenBase64 = await invoke<string>("capture_screen");
    handleAskGroq(screenBase64, message, false);
    setMessage("");
  };

  const handleCaptureOnly = async () => {
    if (isLoading) return;
    const screenBase64 = await invoke<string>("capture_screen");
    handleAskGroq(screenBase64, "", true);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="hud-root">
      <div className="hud-panel">
        <div className="hud-header">
          <span className="hud-title">agrade</span>
          <div className={`hud-status ${isLoading ? "active" : ""}`} />
        </div>
        <div className="hud-body" ref={bodyRef}>
          <div className="hud-messages">
            {messages.map((msg, i) => (
              msg.role === "user" ? (
                <div key={i} className="hud-bubble-row user">
                  <div className="hud-bubble user">
                    {msg.screenshotOnly ? (
                      <div className="hud-screenshot-tag">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                        Screenshot captured
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ) : (
                <div key={i} className="hud-ai-response">
                  {msg.text}
                </div>
              )
            ))}
            {isLoading && (
              <div className="hud-thinking">
                <span /><span /><span />
              </div>
            )}
          </div>
        </div>
        <div className="hud-footer">
          <div className="hud-footer-row">
            <button
              className="hud-icon-btn"
              onClick={handleCaptureOnly}
              disabled={isLoading}
              title="Capture screen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <div className="hud-input-row">
              <textarea
                ref={inputRef}
                className="hud-input"
                placeholder="Ask anything about screen or conversation..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
              />
              <button
                className="hud-send-btn"
                onClick={handleSubmit}
                disabled={isLoading || !message.trim()}
                title="Send"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
