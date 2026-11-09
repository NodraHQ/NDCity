import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentResident } from "@/lib/resident";

export const dynamic = "force-dynamic";

/** Quem está logado neste navegador. */
export async function GET() {
  const r = await currentResident();
  if (!r) return NextResponse.json({ resident: null });
  return NextResponse.json({
    resident: {
      handle: r.handle,
      citySlug: r.house?.citySlug ?? null,
      perks: r.perks,
      hasPassword: !!(await getStore().getPasswordHash(r.handle)),
      subscription: await getStore()
        .getLiveSubscription(r.handle)
        .then((s) => (s && s.status !== "pending" ? { status: s.status } : null)),
    },
  });
}
