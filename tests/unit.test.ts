import { parseVideoUrl } from "../apps/web/lib/video-parser";
import { hashPassword, comparePassword, signAuthToken, verifyAuthToken } from "../apps/web/lib/auth";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ CINEMA-ONLINE-3D ===\n");

  // 1. Video Parser Tests
  console.log("1. Kiểm tra Video URL Parser:");
  
  const ytWatch = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert(ytWatch.type === "youtube" && ytWatch.youtubeId === "dQw4w9WgXcQ", "YouTube watch URL");

  const ytShort = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=10");
  assert(ytShort.type === "youtube" && ytShort.youtubeId === "dQw4w9WgXcQ", "YouTube youtu.be URL");

  const ytShorts = parseVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ");
  assert(ytShorts.type === "youtube" && ytShorts.youtubeId === "dQw4w9WgXcQ", "YouTube Shorts URL");

  const ytEmbed = parseVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert(ytEmbed.type === "youtube" && ytEmbed.youtubeId === "dQw4w9WgXcQ", "YouTube Embed URL");

  const ytLive = parseVideoUrl("https://www.youtube.com/live/dQw4w9WgXcQ");
  assert(ytLive.type === "youtube" && ytLive.youtubeId === "dQw4w9WgXcQ", "YouTube Live URL");

  const ytNoHttps = parseVideoUrl("youtube.com/watch?v=dQw4w9WgXcQ");
  assert(ytNoHttps.type === "youtube" && ytNoHttps.youtubeId === "dQw4w9WgXcQ", "YouTube URL without https://");

  const ytDirectId = parseVideoUrl("dQw4w9WgXcQ");
  assert(ytDirectId.type === "youtube" && ytDirectId.youtubeId === "dQw4w9WgXcQ", "Direct 11-character YouTube ID");

  const hls = parseVideoUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
  assert(hls.type === "hls" && hls.embeddable === true, "HLS .m3u8 stream detection");

  const mp4 = parseVideoUrl("https://example.com/video.mp4");
  assert(mp4.type === "mp4" && mp4.embeddable === true, "MP4 video detection");

  const webm = parseVideoUrl("https://example.com/sample.webm");
  assert(webm.type === "webm" && webm.embeddable === true, "WebM video detection");

  const invalid = parseVideoUrl("not a valid url");
  assert(invalid.type === "invalid" && !invalid.embeddable, "Invalid URL handling");

  // 2. Auth & Cryptography Tests
  console.log("\n2. Kiểm tra Authentication & Token:");

  const plainPass = "cinemaPassword2026!";
  const hash = await hashPassword(plainPass);
  const match = await comparePassword(plainPass, hash);
  const mismatch = await comparePassword("wrongPassword", hash);
  assert(match === true && mismatch === false, "Password hash & verification with bcrypt");

  const payload = {
    userId: "usr_test_123",
    username: "cinematester",
    displayName: "Tester Pro",
    isGuest: false
  };

  const token = signAuthToken(payload);
  const verified = verifyAuthToken(token);
  assert(verified?.userId === "usr_test_123" && verified?.username === "cinematester", "JWT token signing & verification");

  const fakeVerified = verifyAuthToken("invalid.jwt.token");
  assert(fakeVerified === null, "Rejection of forged or invalid JWT tokens");

  console.log(`\n=== TỔNG KẾT: ${passedCount} PASS, ${failedCount} FAIL ===`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
