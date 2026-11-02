import { notFound } from "next/navigation";
import TheaterRoom from "@/components/theater/TheaterRoom";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-zA-Z0-9_-]{3,12}$/.test(code)) notFound();
  return <TheaterRoom roomCode={code.toUpperCase()} />;
}
