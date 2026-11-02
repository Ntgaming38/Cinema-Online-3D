export type VideoType = "youtube" | "hls" | "mp4" | "webm" | "direct" | "invalid";

export interface ParsedVideoInfo {
  type: VideoType;
  cleanUrl: string;
  youtubeId?: string;
  titleHint: string;
  embeddable: boolean;
  errorMessage?: string;
}

export function parseVideoUrl(input: string): ParsedVideoInfo {
  let trimmed = (input || "").trim();
  if (!trimmed) {
    return {
      type: "invalid",
      cleanUrl: "",
      titleHint: "Chưa có URL",
      embeddable: false,
      errorMessage: "URL video không được để trống."
    };
  }

  // 0. Direct 11-char YouTube Video ID input
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return {
      type: "youtube",
      cleanUrl: `https://www.youtube.com/watch?v=${trimmed}`,
      youtubeId: trimmed,
      titleHint: `YouTube: ${trimmed}`,
      embeddable: true
    };
  }

  // Auto-prepend https:// if omitted
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = "https://" + trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      type: "invalid",
      cleanUrl: trimmed,
      titleHint: "URL không hợp lệ",
      embeddable: false,
      errorMessage: "Vui lòng nhập định dạng URL hợp lệ (ví dụ: https://www.youtube.com/watch?v=...)."
    };
  }

  const hostname = url.hostname.toLowerCase();

  // 1. YouTube detection (including youtube.com, youtu.be, m.youtube.com, music.youtube.com)
  const isYouTube =
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtu.be";

  if (isYouTube) {
    let videoId: string | null = null;

    if (hostname === "youtu.be") {
      // https://youtu.be/VIDEO_ID
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        videoId = parts[0];
      }
    } else if (url.pathname.startsWith("/shorts/")) {
      // https://www.youtube.com/shorts/VIDEO_ID
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 1) {
        videoId = parts[1];
      }
    } else if (url.pathname.startsWith("/live/")) {
      // https://www.youtube.com/live/VIDEO_ID
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 1) {
        videoId = parts[1];
      }
    } else if (url.pathname.startsWith("/embed/")) {
      // https://www.youtube.com/embed/VIDEO_ID
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 1) {
        videoId = parts[1];
      }
    } else {
      // https://www.youtube.com/watch?v=VIDEO_ID
      videoId = url.searchParams.get("v");
    }

    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return {
        type: "youtube",
        cleanUrl: `https://www.youtube.com/watch?v=${videoId}`,
        youtubeId: videoId,
        titleHint: `YouTube: ${videoId}`,
        embeddable: true
      };
    }

    return {
      type: "invalid",
      cleanUrl: trimmed,
      titleHint: "YouTube không hợp lệ",
      embeddable: false,
      errorMessage: "Không tìm thấy mã video YouTube 11 ký tự hợp lệ từ URL này."
    };
  }

  // 2. HLS Stream (.m3u8)
  if (url.pathname.toLowerCase().endsWith(".m3u8") || url.search.toLowerCase().includes(".m3u8")) {
    const filename = url.pathname.split("/").pop() || "Luồng HLS";
    return {
      type: "hls",
      cleanUrl: trimmed,
      titleHint: `HLS: ${filename}`,
      embeddable: true
    };
  }

  // 3. WebM
  if (url.pathname.toLowerCase().endsWith(".webm")) {
    const filename = url.pathname.split("/").pop() || "Video WebM";
    return {
      type: "webm",
      cleanUrl: trimmed,
      titleHint: filename,
      embeddable: true
    };
  }

  // 4. MP4
  if (url.pathname.toLowerCase().endsWith(".mp4")) {
    const filename = url.pathname.split("/").pop() || "Video MP4";
    return {
      type: "mp4",
      cleanUrl: trimmed,
      titleHint: filename,
      embeddable: true
    };
  }

  // 5. Generic direct video link
  return {
    type: "direct",
    cleanUrl: trimmed,
    titleHint: url.pathname.split("/").pop() || url.hostname,
    embeddable: true
  };
}
