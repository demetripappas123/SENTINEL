import { notFound } from "next/navigation";
import { dataset } from "@sentinel/core";
import { MissionDetail } from "../../../features/mission-detail";
export function generateStaticParams() {
  return dataset.missions.map((m) => ({ missionId: m.mission_id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  const { missionId } = await params;
  if (!dataset.missions.some((m) => m.mission_id === missionId)) notFound();
  return <MissionDetail missionId={missionId} />;
}
