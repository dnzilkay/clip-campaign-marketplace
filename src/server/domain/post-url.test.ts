import { describe, expect, it } from "vitest";

import { normalizePostUrl } from "./post-url";

describe("normalizePostUrl", () => {
  it.each([
    [
      "https://www.tiktok.com/@creator/video/7412345678901234567?lang=en",
      "tiktok",
      "https://tiktok.com/@creator/video/7412345678901234567",
    ],
    [
      "https://www.instagram.com/reel/C9Example123/?utm_source=test",
      "instagram",
      "https://instagram.com/reel/C9Example123",
    ],
    [
      "https://youtube.com/shorts/dQw4w9WgXcQ?feature=share",
      "youtube",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
    ],
    [
      "https://youtu.be/dQw4w9WgXcQ?t=1",
      "youtube",
      "https://youtu.be/dQw4w9WgXcQ",
    ],
  ])("normalizes a real post URL", (input, platform, normalizedUrl) => {
    expect(normalizePostUrl(input)).toEqual({ platform, normalizedUrl });
  });

  it.each([
    "https://tiktok.com/@creator",
    "https://instagram.com/creator",
    "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://example.com/shorts/dQw4w9WgXcQ",
    "http://youtu.be/dQw4w9WgXcQ",
  ])("rejects a non-post URL: %s", (input) => {
    expect(normalizePostUrl(input)).toBeNull();
  });
});
