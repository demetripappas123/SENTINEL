import { ReviewQueue } from "../../features/review";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string | string[] }>;
}) {
  const { mission } = await searchParams;
  return (
    <ReviewQueue
      missionId={typeof mission === "string" ? mission : undefined}
    />
  );
}
