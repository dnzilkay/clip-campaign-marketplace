import type { CreateSubmissionInput } from "@/shared/schemas/submission";

type Platform = CreateSubmissionInput["platform"];

const PLATFORM_PATTERNS: Record<Platform, RegExp[]> = {
  tiktok: [/^\/@[^/]+\/video\/\d+\/?$/],
  instagram: [/^\/(?:reel|p)\/[^/]+\/?$/],
  youtube: [/^\/shorts\/[A-Za-z0-9_-]+\/?$/, /^\/[A-Za-z0-9_-]+\/?$/],
};

function platformForUrl(url: URL): Platform | null {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (
    (hostname === "tiktok.com" || hostname === "m.tiktok.com") &&
    PLATFORM_PATTERNS.tiktok.some((pattern) => pattern.test(url.pathname))
  ) {
    return "tiktok";
  }

  if (
    hostname === "instagram.com" &&
    PLATFORM_PATTERNS.instagram.some((pattern) => pattern.test(url.pathname))
  ) {
    return "instagram";
  }

  if (
    ((hostname === "youtube.com" &&
      PLATFORM_PATTERNS.youtube[0]!.test(url.pathname)) ||
      (hostname === "youtu.be" &&
        PLATFORM_PATTERNS.youtube[1]!.test(url.pathname)))
  ) {
    return "youtube";
  }

  return null;
}

export function normalizePostUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const platform = platformForUrl(url);

  if (!platform || url.protocol !== "https:") {
    return null;
  }

  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/$/, "");

  return {
    platform,
    normalizedUrl: url.toString().replace(/\/$/, ""),
  };
}
