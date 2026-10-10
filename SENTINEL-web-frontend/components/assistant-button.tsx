"use client";
import { useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "./ui";
export function AssistantButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button
        aria-label="AI assistant"
        onClick={() => dialog.current?.showModal()}
      >
        <Sparkles className="icon" />
        <span className="assistant-label">Assistant</span>
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="assistant-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <header className="dialog-head">
          <h2 id="assistant-title">AI assistant</h2>
          <Button
            className="quiet square"
            aria-label="Close assistant"
            onClick={() => dialog.current?.close()}
          >
            <X className="icon" />
          </Button>
        </header>
        <div className="dialog-content stack">
          <strong>Coming soon</strong>
          <p className="small muted">
            A place to ask about inspections and review priorities. The
            assistant is not available yet.
          </p>
        </div>
      </dialog>
    </>
  );
}
