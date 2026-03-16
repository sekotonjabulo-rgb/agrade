import { useCallback, useEffect, useState, useRef } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

const SERVER_URL = "https://agrade-cbwf.onrender.com/ask";

interface Message {
  role: "user" | "ai";
  text: string;
  screenshotOnly?: boolean;
}

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

const stripMarkdown = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`(.+?)`/gs, '$1')
    .replace(/^\s*[-•]\s/gm, '· ');
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  };

  const sendToServer = async (
    userText: string,
    base64Image?: string,
    currentHistory?: HistoryEntry[]
  ) => {
    const hist = currentHistory ?? history;
    setIsLoading(true);
    setTimeout(scrollToBottom, 50);

    const updatedHistory: HistoryEntry[] = [
      ...hist,
      { role: "user", content: userText || "[screenshot captured]" },
    ];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        setMessages(prev => [...prev, {
          role: "ai",
          text: "Server is waking up — try again in 30 seconds.",
        }]);
      }, 15000);

      const body: Record<string, unknown> = {
        message: userText,
        history: updatedHistory,
      };
      if (base64Image) body.base64Image = base64Image;

      const res = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json();
      const aiText = stripMarkdown(data.result || data.message || "No response received.");
      setMessages(prev => [...prev, { role: "ai", text: aiText }]);
      setHistory([...updatedHistory, { role: "assistant", content: aiText }]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "ai", text: "Error: " + String(err) }]);
      }
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return;
    const userText = message.trim();
    setMessage("");
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    await sendToServer(userText);
  };

  const handleCaptureWithMessage = async () => {
    if (isLoading) return;
    const userText = message.trim();
    const screenBase64 = await invoke<string>("capture_screen");
    setMessage("");
    setMessages(prev => [...prev, {
      role: "user",
      text: userText || "",
      screenshotOnly: !userText,
    }]);
    await sendToServer(userText, screenBase64);
  };

  const handleAskGroq = useCallback(async (base64Image: string, userMessage?: string) => {
    const userText = userMessage?.trim() || "";
    setMessages(prev => [...prev, {
      role: "user",
      text: userText || "",
      screenshotOnly: !userText,
    }]);
    await sendToServer(userText, base64Image, history);
  }, [history]);

  useEffect(() => {
    const shortcuts: string[] = [
      "CommandOrControl+Shift+G",
      "CommandOrControl+B",
      "Control+H",
      "Control+Left",
      "Control+Right",
      "Control+Up",
      "Control+Down",
    ];

    const setupShortcuts = async () => {
      for (const s of shortcuts) {
        try { await unregister(s); } catch (_) {}
      }

      await register("CommandOrControl+Shift+G", async () => {
        const screenBase64 = await invoke<string>("capture_screen");
        handleAskGroq(screenBase64, message);
        setMessage("");
      });

      await register("CommandOrControl+B", async () => {
        const win = getCurrentWindow();
        await win.show();
        await win.setFocus();
      });

      await register("Control+H", async () => {
        await getCurrentWindow().hide();
      });

      const STEP = 40;

      await register("Control+Left", async () => {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        await win.setPosition({ type: "Physical", x: pos.x - STEP, y: pos.y } as any);
      });

      await register("Control+Right", async () => {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        await win.setPosition({ type: "Physical", x: pos.x + STEP, y: pos.y } as any);
      });

      await register("Control+Up", async () => {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        await win.setPosition({ type: "Physical", x: pos.x, y: pos.y - STEP } as any);
      });

      await register("Control+Down", async () => {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        await win.setPosition({ type: "Physical", x: pos.x, y: pos.y + STEP } as any);
      });
    };

    setupShortcuts();
    return () => { shortcuts.forEach(s => unregister(s)); };
  }, [handleAskGroq, message]);

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

  const clearConversation = () => {
    setMessages([]);
    setHistory([]);
  };

  return (
    <div className="hud-root">
      <div className="hud-panel">
        <div className="hud-header" data-tauri-drag-region>
          <span className="hud-title" data-tauri-drag-region>agrade</span>
          <div className="hud-header-actions">
            {messages.length > 0 && (
              <>
                <button className="hud-action-btn" onClick={copyLastResponse} title="Copy last response">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
                <button className="hud-action-btn" onClick={clearConversation} title="Clear conversation">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </button>
              </>
            )}
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
            <button className="hud-icon-btn" onClick={handleCaptureWithMessage} disabled={isLoading} title="Capture screen">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
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
