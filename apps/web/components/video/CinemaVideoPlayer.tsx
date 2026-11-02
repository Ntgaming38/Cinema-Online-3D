"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { parseVideoUrl, ParsedVideoInfo } from "@/lib/video-parser";
import { YouTubePlayer, UnifiedPlayerRef } from "./YouTubePlayer";
import { NativeVideoPlayer } from "./NativeVideoPlayer";
import { Play, Pause, RotateCcw, RotateCw, Maximize, AlertCircle, Film } from "lucide-react";

export interface CinemaVideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}

interface CinemaVideoPlayerProps {
  sourceUrl: string;
  videoTitle?: string;
  isPlaying: boolean;
  canControl: boolean;
  onCommand: (action: "play" | "pause" | "seek", positionSec?: number) => void;
  onTitleDetected?: (title: string) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const CinemaVideoPlayer = forwardRef<CinemaVideoPlayerRef, CinemaVideoPlayerProps>(function CinemaVideoPlayer(
  { sourceUrl, videoTitle, isPlaying, canControl, onCommand, onTitleDetected },
  ref
) {
  const activePlayerRef = useRef<UnifiedPlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const parsedInfo: ParsedVideoInfo = parseVideoUrl(sourceUrl);

  // Poll current time and duration smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      if (activePlayerRef.current) {
        const t = activePlayerRef.current.getCurrentTime();
        const d = activePlayerRef.current.getDuration();
        if (Number.isFinite(t)) setCurrentTime(t);
        if (Number.isFinite(d) && d > 0) setDuration(d);
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => {
      activePlayerRef.current?.play();
    },
    pause: () => {
      activePlayerRef.current?.pause();
    },
    seekTo: (seconds: number) => {
      activePlayerRef.current?.seekTo(seconds);
      setCurrentTime(seconds);
    },
    getCurrentTime: () => {
      return activePlayerRef.current?.getCurrentTime() || 0;
    }
  }));

  const handleStateChange = (playing: boolean, positionSec: number) => {
    if (!canControl) return;
    setCurrentTime(positionSec);
    onCommand(playing ? "play" : "pause", positionSec);
  };

  // Explicit seek event forwarded from player
  const handleUserSeek = (positionSec: number) => {
    if (!canControl) return;
    setCurrentTime(positionSec);
    onCommand("seek", positionSec);
  };

  const handleSeekOffset = (offsetSec: number) => {
    if (!canControl || !activePlayerRef.current) return;
    const current = activePlayerRef.current.getCurrentTime();
    const newPos = Math.max(0, current + offsetSec);
    activePlayerRef.current.seekTo(newPos);
    setCurrentTime(newPos);
    onCommand("seek", newPos);
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl || !activePlayerRef.current) return;
    const newPos = Number(e.target.value);
    activePlayerRef.current.seekTo(newPos);
    setCurrentTime(newPos);
    onCommand("seek", newPos);
  };

  const handleTogglePlay = () => {
    if (!canControl) return;
    const current = activePlayerRef.current?.getCurrentTime() || 0;
    if (isPlaying) {
      activePlayerRef.current?.pause();
      onCommand("pause", current);
    } else {
      activePlayerRef.current?.play();
      onCommand("play", current);
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="cinema-player-shell" style={{ width: "100%", borderRadius: "12px", overflow: "hidden", background: "#06050b", border: "1px solid #2d2242", display: "flex", flexDirection: "column" }}>
      {/* Video Viewport */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#030206", overflow: "hidden" }}>
        {!sourceUrl ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#857a9b", gap: "10px", padding: "20px", textAlign: "center" }}>
            <Film size={44} style={{ opacity: 0.6, color: "#a855f7" }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: "15px", color: "#d8c7f8" }}>Chưa có video nào được chọn</p>
            <p style={{ margin: 0, fontSize: "12px", maxWidth: "380px" }}>Chủ phòng hãy dán link YouTube (watch, youtu.be, shorts), MP4, WebM hoặc HLS (.m3u8) để bắt đầu chiếu.</p>
          </div>
        ) : parsedInfo.type === "youtube" && parsedInfo.youtubeId ? (
          <YouTubePlayer
            ref={activePlayerRef}
            videoId={parsedInfo.youtubeId}
            canControl={canControl}
            onStateChange={handleStateChange}
            onSeek={handleUserSeek}
            onError={msg => setErrorMessage(msg)}
            onTitleLoaded={title => onTitleDetected?.(title)}
          />
        ) : parsedInfo.type === "hls" || parsedInfo.type === "mp4" || parsedInfo.type === "webm" || parsedInfo.type === "direct" ? (
          <NativeVideoPlayer
            ref={activePlayerRef}
            sourceUrl={parsedInfo.cleanUrl}
            isHls={parsedInfo.type === "hls"}
            canControl={canControl}
            onStateChange={handleStateChange}
            onSeek={handleUserSeek}
            onTimeUpdate={(t, d) => {
              if (Number.isFinite(t)) setCurrentTime(t);
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }}
            onError={msg => setErrorMessage(msg)}
          />
        ) : (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#f87171", gap: "8px", padding: "20px", textAlign: "center" }}>
            <AlertCircle size={36} />
            <p style={{ margin: 0, fontWeight: 600 }}>URL video không được hỗ trợ</p>
            <p style={{ margin: 0, fontSize: "12px", color: "#fca5a5" }}>{parsedInfo.errorMessage || "Vui lòng nhập link YouTube hoặc file MP4/HLS hợp lệ."}</p>
          </div>
        )}
      </div>

      {/* Interactive Seek Bar & Timeline */}
      {duration > 0 && (
        <div style={{ padding: "6px 14px 2px", background: "#0e0a1a", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "10px", color: "#a78bfa", minWidth: "35px" }}>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.5}
            value={currentTime}
            onChange={handleScrubberChange}
            disabled={!canControl}
            style={{
              flex: 1,
              accentColor: "#a855f7",
              cursor: canControl ? "pointer" : "default",
              height: "4px"
            }}
            title={canControl ? "Kéo để tua video cho cả phòng" : "Chỉ Chủ phòng / Quản trị viên mới được tua"}
          />
          <span style={{ fontSize: "10px", color: "#9ca3af", minWidth: "35px" }}>{formatTime(duration)}</span>
        </div>
      )}

      {/* Control Bar */}
      <div style={{ padding: "10px 14px", background: "linear-gradient(180deg, #120e20, #0c0916)", borderTop: "1px solid #281d3d", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {canControl ? (
            <>
              <button
                type="button"
                onClick={handleTogglePlay}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: isPlaying ? "#4a2175" : "#7c3aed",
                  color: "#fff",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "12px",
                  boxShadow: "0 2px 10px rgba(124, 58, 237, 0.3)"
                }}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                {isPlaying ? "Tạm dừng" : "Phát"}
              </button>

              <button
                type="button"
                onClick={() => handleSeekOffset(-10)}
                title="Lùi 10 giây (Tua cho cả phòng)"
                style={{ background: "#211b33", border: "1px solid #3d2f57", color: "#d8c7f8", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
              >
                <RotateCcw size={13} /> -10s
              </button>

              <button
                type="button"
                onClick={() => handleSeekOffset(10)}
                title="Tiến 10 giây (Tua cho cả phòng)"
                style={{ background: "#211b33", border: "1px solid #3d2f57", color: "#d8c7f8", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
              >
                <RotateCw size={13} /> +10s
              </button>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#a79bc2", background: "#1b1429", padding: "6px 12px", borderRadius: "20px", border: "1px solid #382552" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: isPlaying ? "#22c55e" : "#eab308" }} />
              {isPlaying ? "Đang phát (Chủ phòng điều khiển)" : "Tạm dừng (Chủ phòng điều khiển)"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {videoTitle && (
            <span style={{ fontSize: "11px", color: "#c4b5fd", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {videoTitle}
            </span>
          )}
          <button
            type="button"
            onClick={handleFullscreen}
            title="Toàn màn hình trình phát"
            style={{ background: "transparent", border: "1px solid #392b52", color: "#c4b5fd", borderRadius: "8px", padding: "6px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>
    </div>
  );
});
