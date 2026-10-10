import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Record not found</h1>
      <Link href="/" className="btn blue">
        Return to overview
      </Link>
    </div>
  );
}
