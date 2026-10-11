import { Replay } from "../../features/replay";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    mission?: string | string[];
    action?: string | string[];
  }>;
}) {
  const { mission, action } = await searchParams;
  return (
    <Replay
      key={`${mission ?? ""}:${action ?? ""}`}
      initialMission={typeof mission === "string" ? mission : undefined}
      initialAction={typeof action === "string" ? action : undefined}
    />
  );
}
