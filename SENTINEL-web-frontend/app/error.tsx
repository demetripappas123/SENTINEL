"use client";
import { Button } from "../components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8" role="alert">
      <h1>Unable to load inspections</h1>
      <Button className="blue" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
