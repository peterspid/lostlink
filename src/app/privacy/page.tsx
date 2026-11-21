import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Eye, KeyRound, Lock, MapPin, MessagesSquare, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader, Pictogram } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy and safety",
  description: "What LostLink shows publicly, what stays private, and how chats, blocking and account deletion work.",
};

const SECTIONS = [
  {
    icon: Eye,
    title: "What everyone can see",
    body: "A post's kind (lost or found), title, category, description, photos, colour, the time window and a place name. Found items never show brand, material or distinguishing marks publicly. People see your first name only.",
  },
  {
    icon: MapPin,
    title: "Locations are blurred",
    body: "Public pins are moved randomly within about 300 metres of the real spot. Only you, and staff of a desk that logged the item, see the exact location.",
  },
  {
    icon: Lock,
    title: "Verification answers stay private",
    body: "The questions a finder sets are shown to claimants, but the expected answers never are. A claimant's answers are visible only to the finder. Repeated wrong claims on the same item are blocked.",
  },
  {
    icon: MessagesSquare,
    title: "Chats without phone numbers",
    body: "Claim chats, photos, meeting points, read receipts and live notices are delivered through Nexconn's messaging service. Your phone number and email are never shared with the other person.",
  },
  {
    icon: Ban,
    title: "Blocking and reporting",
    body: "You can block or report anyone from a chat, claim or post. Blocked people can't message you or claim your items. Posts reported by three different people are hidden automatically.",
  },
  {
    icon: KeyRound,
    title: "Your account",
    body: "We store your name, email and a hashed password (never the password itself). Photos you upload are stored to show on your post. AI reads photos only to suggest details you can edit.",
  },
  {
    icon: Trash2,
    title: "Deleting everything",
    body: "Posts expire after 60 days unless you renew them. Deleting your account from your profile removes your posts, claims, alerts and desks straight away.",
  },
  {
    icon: ShieldCheck,
    title: "Meeting safely",
    body: "Meet in a busy public place: a café, a station entrance or a security desk. You never have to pay a finder, and nobody from LostLink will ask you for money.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader icon={<ShieldCheck />} title="Privacy and safety" description="LostLink is built so you can get your things back without giving strangers your details. Here's exactly what's shared and what isn't." />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-3xl border border-line bg-surface p-5">
            <Pictogram size="sm">
              <Icon />
            </Pictogram>
            <h2 className="mt-3 font-display text-[19px] font-extrabold">{title}</h2>
            <p className="mt-1.5 text-[15px] text-ink-2">{body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-[15px] text-ink-2">
        Something wrong with a post or a person? Use the <span className="font-semibold text-ink">Report</span> option on it, or{" "}
        <Link href="/profile" className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">
          manage blocked people from your profile
        </Link>
        .
      </p>
    </div>
  );
}
