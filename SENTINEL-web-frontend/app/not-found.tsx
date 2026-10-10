import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-2xl font-semibold">Record not found</h1>
      <Link href="/" className={buttonVariants()}>
        Return to overview
      </Link>
    </div>
  );
}
