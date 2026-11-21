import { NextResponse } from "next/server";
import { handle, parseJson, requireUser } from "@/lib/api";
import { createClaim } from "@/lib/claims";
import { listClaimsFor } from "@/lib/claim-view";
import { claimCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  const me = await requireUser();
  return NextResponse.json({ claims: await listClaimsFor(me.id) });
});

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const input = await parseJson(req, claimCreateSchema);
  const { id } = await createClaim(me.id, input);
  return NextResponse.json({ id }, { status: 201 });
});
