import { useCallback, useEffect, useState, useRef } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import "./App.css";

const SERVER_URL = "https://agrade-cbwf.onrender.com/ask";

interface Message {
  role: "user" | "ai";
  text: string;
  screenshotOnly?: boolean;
}

const stripMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`(.+?)`/gs, '$1')
    .replace(/^\s*[-•]\s/gm, '· ');
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [visible, setVisible] = useState<boolean>(true);
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
      setMessages(prev => [...prev, { role: "ai", text: stripMarkdown(data.result) }]);
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
    const step = 30;
    const handleKey = async (e: KeyboardEvent) => {
      const win = getCurrentWindow();

      if (e.ctrlKey && e.key === 'h') {
        setVisible(false);
        await win.hide();
        return;
      }

      if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const pos = await win.outerPosition();
        const x = pos.x;
        const y = pos.y;
        if (e.key === 'ArrowLeft') await win.setPosition(new PhysicalPosition(x - step, y));
        if (e.key === 'ArrowRight') await win.setPosition(new PhysicalPosition(x + step, y));
        if (e.key === 'ArrowUp') await win.setPosition(new PhysicalPosition(x, y - step));
        if (e.key === 'ArrowDown') await win.setPosition(new PhysicalPosition(x, y + step));
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const captureShortcut = "CommandOrControl+Shift+G";
    const showShortcut = "CommandOrControl+B";

    const setupShortcuts = async () => {
      try { await unregister(captureShortcut); } catch (_) {}
      try { await unregister(showShortcut); } catch (_) {}

      await register(captureShortcut, async () => {
        const screenBase64 = await invoke<string>("capture_screen");
        handleAskGroq(screenBase64, message, true);
        setMessage("");
      });

      await register(showShortcut, async () => {
        const win = getCurrentWindow();
        await win.show();
        await win.setFocus();
        setVisible(true);
      });
    };

    setupShortcuts();
    return () => {
      unregister(captureShortcut);
      unregister(showShortcut);
    };
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

  const copyLastResponse = () => {
    const lastAi = [...messages].reverse().find(m => m.role === "ai");
    if (lastAi) navigator.clipboard.writeText(lastAi.text);
  };

  const clearConversation = () => setMessages([]);

  if (!visible) return null;

  return (
    <div className="hud-root">
      <div className="hud-panel">
        <div className="hud-header">
          <span className="hud-title">agrade</span>
          <div className="hud-header-actions">
            <button className="hud-action-btn" onClick={copyLastResponse} title="Copy last response">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button className="hud-action-btn" onClick={clearConversation} title="Clear conversation">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
            <div className={`hud-status ${isLoading ? "active" : ""}`} />
          </div>
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
                    ) : msg.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="hud-ai-response">{msg.text}</div>
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
            <button className="hud-icon-btn" onClick={handleCaptureOnly} disabled={isLoading} title="Capture screen">
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
              <button className="hud-send-btn" onClick={handleSubmit} disabled={isLoading || !message.trim()} title="Send">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
          <p className="hud-hint">⇧ arrows to move · ⌃H hide · ⌃B show</p>
        </div>
      </div>
    </div>
  );
}
