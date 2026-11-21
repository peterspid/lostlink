import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { forbidden, handle, parseJson, requireUser } from "@/lib/api";
import { createItem, isDeskStaff } from "@/lib/items";
import { checkAlerts, runMatching } from "@/lib/matching";
import { rateLimit } from "@/lib/ratelimit";
import { searchItems, searchParamsSchema } from "@/lib/search";
import { itemCreateSchema } from "@/lib/validation";
import { sendGroupMessage } from "@/lib/nexconn/server";
import { MSG } from "@/lib/nexconn/messages";

export const maxDuration = 60;

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const params = searchParamsSchema.parse(Object.fromEntries(url.searchParams));
  const items = await searchItems(params);
  return NextResponse.json({ items });
});

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  await rateLimit(`post:${me.id}`, 20, 3600, "You've posted a lot this hour. Try again later.");
  const input = await parseJson(req, itemCreateSchema);
  let deskGroup: { id: string; name: string; group: string } | null = null;
  if (input.deskId) {
    if (!(await isDeskStaff(input.deskId, me.id))) throw forbidden("Only desk staff can log items for this desk.");
    const [d] = await db()
      .select({ id: schema.desks.id, name: schema.desks.name, group: schema.desks.nexconnGroupId })
      .from(schema.desks)
      .where(eq(schema.desks.id, input.deskId));
    deskGroup = d ?? null;
  }

  const item = await createItem(me.id, input);

  // Recompute matches for the new post now (so the poster sees them immediately); deliver the
  // notifications and check saved alerts after the response so posting stays fast on mobile.
  const jobs: (() => Promise<void>)[] = [];
  let matchCount = 0;
  try {
    const r = await runMatching(item, { defer: (j) => jobs.push(j) });
    matchCount = r.kept;
  } catch (err) {
    console.error("[items] matching failed", err);
  }
  after(async () => {
    await Promise.all(jobs.map((j) => j().catch((err) => console.error("[items] notify failed", err))));
    await checkAlerts(item).catch((err) => console.error("[items] alerts failed", err));
  });

  if (deskGroup) {
    const group = deskGroup;
    after(() =>
    sendGroupMessage(
      group.group,
      MSG.DESK,
      {
        deskId: group.id,
        title: `${me.name} logged "${item.title}"`,
        body: `Ref ${item.code}${item.placeLabel ? `, found at ${item.placeLabel}` : ""}.`,
        href: `/items/${item.id}`,
      },
      `New item logged: ${item.title}`,
    ).catch((err) => console.error("[items] desk notice failed", err)),
    );
  }

  return NextResponse.json({ item: { id: item.id, code: item.code }, matchCount }, { status: 201 });
});
