import { MissionDetail } from "../../../features/mission-detail";

export default async function Page({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  const { missionId } = await params;
  return <MissionDetail missionId={missionId} />;
}