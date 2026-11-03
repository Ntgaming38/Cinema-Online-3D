"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface UnifiedPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

interface YouTubePlayerProps {
  videoId: string;
  canControl: boolean;
  onStateChange?: (isPlaying: boolean, positionSec: number) => void;
  onSeek?: (positionSec: number) => void;
  onError?: (errorMessage: string) => void;
  onReady?: () => void;
  onTitleLoaded?: (title: string) => void;
}

export const YouTubePlayer = forwardRef<UnifiedPlayerRef, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, canControl, onStateChange, onSeek, onError, onReady, onTitleLoaded },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const isRemoteActionRef = useRef<boolean>(false);
  const lastReportedTimeRef = useRef<number>(0);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);

  // 1. Ensure YouTube Iframe API script is reliably loaded
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkYT = () => {
      if (window.YT && window.YT.Player) {
        setIsApiLoaded(true);
        return true;
      }
      return false;
    };

    if (checkYT()) return;

    // Inject script if not present
    let script = document.getElementById("yt-iframe-api") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "yt-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      setIsApiLoaded(true);
    };

    // Polling interval in case onYouTubeIframeAPIReady already fired before mount
    const timer = setInterval(() => {
      if (checkYT()) {
        clearInterval(timer);
      }
    }, 150);

    return () => clearInterval(timer);
  }, []);

  // 2. Initialize YouTube Player
  useEffect(() => {
    if (!isApiLoaded || !containerRef.current || !videoId) return;

    let destroyed = false;
    setInternalError(null);
    setIsBuffering(true);

    const playerElement = document.createElement("div");
    playerElement.style.width = "100%";
    playerElement.style.height = "100%";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(playerElement);

    try {
      const ytPlayer = new window.YT.Player(playerElement, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 1, // Keep controls accessible for volume & manual click
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          playsinline: 1,
          iv_load_policy: 3
        },
        events: {
          onReady: (event: any) => {
            if (destroyed) return;
            playerRef.current = event.target;
            setIsBuffering(false);

            try {
              const videoData = event.target.getVideoData();
              if (videoData && videoData.title && onTitleLoaded) {
                onTitleLoaded(videoData.title);
              }
            } catch {
              // ignore
            }

            if (onReady) onReady();
          },
          onStateChange: (event: any) => {
            if (destroyed) return;
            const state = event.data;
            const currentTime = typeof event.target.getCurrentTime === "function" ? event.target.getCurrentTime() : 0;

            if (state === window.YT.PlayerState.BUFFERING) {
              setIsBuffering(true);
            } else {
              setIsBuffering(false);
            }

            // If this state change was initiated by remote server command, don't echo back
            if (isRemoteActionRef.current) {
              return;
            }

            if (!canControl) {
              // If member cannot control, prevent sending commands
              return;
            }

            const isJump = Math.abs(currentTime - lastReportedTimeRef.current) > 2.5;
            if (isJump) {
              onSeek?.(currentTime);
            }
            lastReportedTimeRef.current = currentTime;

            if (state === window.YT.PlayerState.PLAYING) {
              onStateChange?.(true, currentTime);
            } else if (state === window.YT.PlayerState.PAUSED) {
              onStateChange?.(false, currentTime);
            }
          },
          onError: (event: any) => {
            if (destroyed) return;
            setIsBuffering(false);
            let msg = "Không thể phát video YouTube này.";
            if (event.data === 101 || event.data === 150) {
              msg = "Chủ sở hữu video YouTube không cho phép phát lại trên trang web khác (Embedding disabled). Vui lòng chọn một video YouTube khác.";
            } else if (event.data === 100) {
              msg = "Video YouTube này đã bị xóa hoặc được đặt ở chế độ riêng tư.";
            } else if (event.data === 2) {
              msg = "Mã video YouTube không hợp lệ.";
            } else if (event.data === 5) {
              msg = "Trình phát HTML5 của YouTube gặp sự cố với video này.";
            }
            setInternalError(msg);
            onError?.(msg);
          }
        }
      });

      playerRef.current = ytPlayer;
    } catch (err) {
      console.error("YouTube init error:", err);
      const msg = "Lỗi khởi tạo trình phát YouTube.";
      setInternalError(msg);
      onError?.(msg);
    }

    return () => {
      destroyed = true;
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try {
          playerRef.current.destroy();
        } catch {}
      }
      playerRef.current = null;
    };
  }, [isApiLoaded, videoId, canControl]);

  // Imperative handle for parent to control playback remotely without triggering echo loops
  useImperativeHandle(ref, () => ({
    play: () => {
      if (playerRef.current && typeof playerRef.current.playVideo === "function") {
        isRemoteActionRef.current = true;
        try {
          playerRef.current.playVideo();
        } catch {}
        setTimeout(() => {
          isRemoteActionRef.current = false;
        }, 600);
      }
    },
    pause: () => {
      if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
        isRemoteActionRef.current = true;
        try {
          playerRef.current.pauseVideo();
        } catch {}
        setTimeout(() => {
          isRemoteActionRef.current = false;
        }, 600);
      }
    },
    seekTo: (seconds: number) => {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        isRemoteActionRef.current = true;
        try {
          playerRef.current.seekTo(seconds, true);
        } catch {}
        setTimeout(() => {
          isRemoteActionRef.current = false;
        }, 600);
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        return playerRef.current.getCurrentTime();
      }
      return 0;
    },
    getDuration: () => {
      if (playerRef.current && typeof playerRef.current.getDuration === "function") {
        return playerRef.current.getDuration();
      }
      return 0;
    },
    setVolume: (volume: number) => {
      playerRef.current?.setVolume?.(Math.max(0, Math.min(100, volume)));
    },
    setMuted: (muted: boolean) => {
      if (!playerRef.current) return;
      if (muted) playerRef.current.mute?.();
      else playerRef.current.unMute?.();
    },
  }));

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: "260px" }}>
      <div
        ref={containerRef}
        className="yt-embed-container"
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0
        }}
      />

      {isBuffering && !internalError && (
        <div style={{ position: "absolute", pointerEvents: "none", display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.7)", padding: "10px 18px", borderRadius: "10px", zIndex: 10, backdropFilter: "blur(4px)" }}>
          <span className="spinner" style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #a855f7", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: "12px", color: "#e9d5ff", fontWeight: 600 }}>Đang kết nối YouTube...</span>
        </div>
      )}

      {internalError && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(18, 16, 28, 0.95)", color: "#ff8080", padding: "24px", textAlign: "center", zIndex: 20 }}>
          <p style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px", color: "#fca5a5" }}>⚠️ Không thể phát video YouTube</p>
          <p style={{ fontSize: "13px", color: "#fecaca", maxWidth: "460px", lineHeight: "1.5" }}>{internalError}</p>
        </div>
      )}
    </div>
  );
});
