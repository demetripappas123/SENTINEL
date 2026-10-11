"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ArrowUp, Plus, Sparkles, X } from "lucide-react";
import { Button } from "./ui";

const MIN_WIDTH = 320;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 380;
const OPEN_KEY = "sentinel:chat-open";
const WIDTH_KEY = "sentinel:chat-width";

type ChatMessage = { id: number; role: "user" | "assistant"; text: string };

type SideChatValue = {
  open: boolean;
  width: number;
  toggle: () => void;
  close: () => void;
  setWidth: (width: number) => void;
};

export const SideChatContext = createContext<SideChatValue | null>(null);

function useSideChat() {
  const value = useContext(SideChatContext);
  if (!value) throw new Error("Chat is outside its provider");
  return value;
}

export function SideChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [width, setWidthState] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(WIDTH_KEY));
    if (storedWidth >= MIN_WIDTH && storedWidth <= MAX_WIDTH) setWidthState(storedWidth);
    if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "l") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      event.preventDefault();
      setOpen((current) => {
        const next = !current;
        localStorage.setItem(OPEN_KEY, next ? "1" : "0");
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      return next;
    });
  };
  const close = () => {
    setOpen(false);
    localStorage.setItem(OPEN_KEY, "0");
  };
  const setWidth = (next: number) => {
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
    setWidthState(clamped);
    localStorage.setItem(WIDTH_KEY, String(clamped));
  };

  return (
    <SideChatContext.Provider value={{ open, width, toggle, close, setWidth }}>
      {children}
    </SideChatContext.Provider>
  );
}

export function SideChatToggle() {
  const { open, toggle } = useSideChat();
  return (
    <Button aria-expanded={open} aria-label="AI assistant" onClick={toggle}>
      <Sparkles className="size-4" />
      <span className="assistant-label">Assistant</span>
    </Button>
  );
}

export function SideChatPanel() {
  const { open, close, setWidth, width } = useSideChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const userId = nextId.current++;
    const replyId = nextId.current++;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text },
      { id: replyId, role: "assistant", text: "Gemini isn't connected yet." },
    ]);
    setDraft("");
    if (input.current) input.current.style.height = "";
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  function onResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    const move = (ev: PointerEvent) => setWidth(startWidth - (ev.clientX - startX));
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
  }

  return (
    <aside aria-label="Chat" className="side-chat" hidden={!open}>
      <div
        aria-label="Resize chat"
        aria-orientation="vertical"
        className="side-chat-resize"
        role="separator"
        onPointerDown={onResizeStart}
      />
      <header className="side-chat-head">
        <h2>Chat</h2>
        <Button
          aria-label="New chat"
          className="quiet square"
          onClick={() => setMessages([])}
        >
          <Plus className="size-4" />
        </Button>
        <Button aria-label="Close chat" className="quiet square" onClick={close}>
          <X className="size-4" />
        </Button>
      </header>
      <div aria-live="polite" className="side-chat-log" ref={log}>
        <div className="side-chat-thread">
          {messages.length === 0 ? (
            <p className="side-chat-empty">
              Ask about an inspection or a review priority. Gemini isn't connected yet.
            </p>
          ) : (
            messages.map((message) => (
              <p className={"side-chat-bubble " + message.role} key={message.id}>
                {message.text}
              </p>
            ))
          )}
        </div>
      </div>
      <form className="side-chat-composer" onSubmit={onSubmit}>
        <textarea
          aria-label="Message"
          placeholder="Ask about an inspection"
          ref={input}
          rows={1}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            event.target.style.height = "0px";
            event.target.style.height = Math.min(event.target.scrollHeight, 160) + "px";
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Button aria-label="Send message" disabled={!draft.trim()} onClick={send}>
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </aside>
  );
}
