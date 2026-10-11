import { ReviewQueue } from "../../features/review";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    mission?: string | string[];
    configuration?: string | string[];
  }>;
}) {
  const { mission, configuration } = await searchParams;
  return (
    <ReviewQueue
      key={`${mission ?? "all"}:${configuration ?? "ALL"}`}
      initialConfiguration={
        configuration === "V1" || configuration === "V2" ? configuration : "ALL"
      }
      missionId={typeof mission === "string" ? mission : undefined}
    />
  );
}
