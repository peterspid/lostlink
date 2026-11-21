import { describe, expect, it } from "vitest";
import { MATCH_NOTIFY_THRESHOLD, embeddingText, explainMatch, keywordOverlap, scoreMatch, semanticScore, type MatchSide } from "@/lib/match-score";

const base = new Date("2026-11-18T10:00:00Z");
const h = (n: number) => new Date(base.getTime() + n * 3600_000);

const lost: MatchSide = {
  category: "wallet",
  title: "Black leather wallet",
  description: "Bifold with my licence inside",
  attributes: { color: "black", brand: "Tommy Hilfiger", material: "leather" },
  lat: 28.6315,
  lng: 77.2167,
  occurredFrom: h(-2),
  occurredTo: h(0),
};

const found: MatchSide = {
  category: "wallet",
  title: "Wallet found near metro",
  description: "Black wallet",
  attributes: { color: "Black", brand: "tommy hilfiger" },
  lat: 28.6334,
  lng: 77.2191,
  occurredFrom: h(2),
  occurredTo: h(2),
};

describe("scoreMatch", () => {
  it("scores a close, same-brand, same-colour find above the notify threshold", () => {
    const s = scoreMatch(lost, found, 0.84);
    expect(s.excluded).toBe(false);
    expect(s.score).toBeGreaterThan(MATCH_NOTIFY_THRESHOLD);
    expect(s.brand).toBeTruthy();
    expect(s.color).toBe("black");
    expect(s.distanceM).toBeGreaterThan(200);
    expect(s.distanceM).toBeLessThan(500);
  });

  it("excludes different categories", () => {
    expect(scoreMatch(lost, { ...found, category: "phone" }, 0.9).excluded).toBe(true);
  });

  it("lets 'other' match any category but with a penalty", () => {
    const same = scoreMatch(lost, found, 0.8).score;
    const other = scoreMatch(lost, { ...found, category: "other" }, 0.8);
    expect(other.excluded).toBe(false);
    expect(other.score).toBeLessThan(same);
  });

  it("excludes items found well before the loss", () => {
    expect(scoreMatch(lost, { ...found, occurredFrom: h(-48), occurredTo: h(-47) }, 0.9).excluded).toBe(true);
  });

  it("excludes items farther than 30 km", () => {
    expect(scoreMatch(lost, { ...found, lat: 28.95 }, 0.9).excluded).toBe(true);
  });

  it("falls back to keyword overlap without embeddings", () => {
    const s = scoreMatch(lost, found, null);
    expect(s.score).toBeGreaterThan(0.4);
  });

  it("ranks the nearer of two identical finds higher", () => {
    const near = scoreMatch(lost, found, 0.8).score;
    const far = scoreMatch(lost, { ...found, lat: 28.7, lng: 77.3 }, 0.8).score;
    expect(near).toBeGreaterThan(far);
  });
});

describe("explainMatch", () => {
  it("writes readable reasons from the owner's side", () => {
    const reasons = explainMatch(scoreMatch(lost, found, 0.84), "owner");
    expect(reasons[0]).toMatch(/^Same brand/);
    expect(reasons).toContain("Same color: black");
    expect(reasons.some((r) => /m away$/.test(r))).toBe(true);
    expect(reasons).toContain("Found 4 h after you lost it");
  });

  it("phrases time from the finder's side", () => {
    expect(explainMatch(scoreMatch(lost, found, 0.84), "finder")).toContain("Lost 4 h before you found it");
  });
});

describe("helpers", () => {
  it("maps similarity onto 0..1", () => {
    expect(semanticScore(0.5)).toBe(0);
    expect(semanticScore(0.95)).toBe(1);
    expect(semanticScore(0.76)).toBeCloseTo(0.5, 1);
  });

  it("measures keyword overlap ignoring stop words", () => {
    expect(keywordOverlap({ title: "black wallet", description: "", attributes: {} }, { title: "Wallet, black leather", description: "", attributes: {} })).toBe(1);
  });

  it("never puts verification answers into embedding text", () => {
    const text = embeddingText({ kind: "found", ...found });
    expect(text).toContain("Color: Black");
    expect(text).not.toMatch(/licence/);
  });
});
