export const CATEGORIES = [
  { id: "phone", label: "Phone" },
  { id: "wallet", label: "Wallet or purse" },
  { id: "keys", label: "Keys" },
  { id: "bag", label: "Bag or backpack" },
  { id: "id-card", label: "ID or cards" },
  { id: "electronics", label: "Electronics" },
  { id: "jewelry", label: "Jewelry or watch" },
  { id: "clothing", label: "Clothing" },
  { id: "eyewear", label: "Glasses" },
  { id: "documents", label: "Documents or books" },
  { id: "bottle", label: "Bottle or flask" },
  { id: "umbrella", label: "Umbrella" },
  { id: "toy", label: "Toy" },
  { id: "pet", label: "Pet" },
  { id: "other", label: "Something else" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Something else";
}
