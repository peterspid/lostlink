import { describe, expect, it } from "vitest";
import { boundingBox, distanceMeters, formatDistance, fuzzLocation } from "@/lib/geo";
import { formatWhen, humanDuration, timeAgo } from "@/lib/time";
import { alertMatchesText, answerLooksRight } from "@/lib/text-match";

describe("geo", () => {
  it("computes haversine distance", () => {
    expect(Math.round(distanceMeters(28.6315, 77.2167, 28.6315, 77.2167))).toBe(0);
    const d = distanceMeters(28.6315, 77.2167, 28.6405, 77.2167);
    expect(d).toBeGreaterThan(990);
    expect(d).toBeLessThan(1010);
  });

  it("fuzzes locations deterministically within ~400 m but never exactly", () => {
    const a = fuzzLocation(28.6315, 77.2167, "item1");
    const b = fuzzLocation(28.6315, 77.2167, "item1");
    expect(a).toEqual(b);
    const d = distanceMeters(28.6315, 77.2167, a.lat, a.lng);
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(450);
  });

  it("builds a bounding box containing the radius", () => {
    const box = boundingBox(28.6, 77.2, 5000);
    expect(distanceMeters(28.6, 77.2, box.maxLat, 77.2)).toBeGreaterThan(4900);
    expect(box.minLng).toBeLessThan(77.2);
  });

  it("formats distances for people", () => {
    expect(formatDistance(20)).toBe("right here");
    expect(formatDistance(420)).toBe("400 m away");
    expect(formatDistance(2600)).toBe("2.6 km away");
  });
});

describe("time", () => {
  it("formats durations", () => {
    expect(humanDuration(5 * 60_000)).toBe("5 min");
    expect(humanDuration(2 * 3600_000)).toBe("2 h");
    expect(humanDuration(26 * 3600_000)).toBe("1 day");
    expect(timeAgo(new Date(Date.now() - 3 * 3600_000))).toBe("3 h ago");
  });

  it("formats a time range", () => {
    expect(formatWhen("2026-11-18T10:00:00Z", "2026-11-18T10:01:00Z")).toMatch(/18 Nov/);
  });
});

describe("text matching", () => {
  it("accepts a claimant answer phrased differently", () => {
    expect(answerLooksRight("Ontario driver's licence", "An Ontario driver's licence")).toBe(true);
    expect(answerLooksRight("blue cat sticker", "a sticker of a blue cat")).toBe(true);
    expect(answerLooksRight("blue cat sticker", "red dog")).toBe(false);
  });

  it("matches alerts by keywords or similarity", () => {
    const item = { title: "Black leather wallet", description: "found at bus stop", category: "wallet", attributes: { color: "black" } };
    expect(alertMatchesText("black wallet", item, null)).toBe(true);
    expect(alertMatchesText("blue umbrella", item, null)).toBe(false);
    expect(alertMatchesText("purse", item, 0.8)).toBe(true);
  });
});
