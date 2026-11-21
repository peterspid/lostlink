import { NextResponse, after } from "next/server";
import type { Desk } from "@/lib/db/schema";
import { forbidden, handle, parseJson, requireUser } from "@/lib/api";
import { createItem, firstName, isDeskStaff } from "@/lib/items";
import { ensureDeskGroup, getDesk } from "@/lib/desks";
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
  let desk: Desk | null = null;
  if (input.deskId) {
    if (!(await isDeskStaff(input.deskId, me.id))) throw forbidden("Only desk staff can log items for this desk.");
    desk = await getDesk(input.deskId);
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

  if (desk) {
    const d = desk;
    after(() =>
      ensureDeskGroup(d)
        .then(() =>
          sendGroupMessage(
            d.nexconnGroupId,
            MSG.DESK,
            {
              deskId: d.id,
              title: `${firstName(me.name)} logged "${item.title}"`,
              body: `Ref ${item.code}${item.placeLabel ? `, found at ${item.placeLabel}` : ""}.`,
              href: `/items/${item.id}`,
            },
            `New item logged: ${item.title}`,
          ),
        )
        .catch((err) => console.error("[items] desk notice failed", err)),
    );
  }

  return NextResponse.json({ item: { id: item.id, code: item.code }, matchCount }, { status: 201 });
});
