import { redirect } from "next/navigation";
import { mapUrl } from "@/lib/offline-plan";

/** The per-passage chart now lives in the hub map. */
export default async function ChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(mapUrl(id));
}
