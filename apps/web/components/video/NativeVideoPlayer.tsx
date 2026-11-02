"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import Hls from "hls.js";
import { UnifiedPlayerRef } from "./YouTubePlayer";

interface NativeVideoPlayerProps {
  sourceUrl: string;
  isHls: boolean;
  canControl: boolean;
  onStateChange?: (isPlaying: boolean, positionSec: number) => void;
  onSeek?: (positionSec: number) => void;
  onError?: (errorMessage: string) => void;
  onReady?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export const NativeVideoPlayer = forwardRef<UnifiedPlayerRef, NativeVideoPlayerProps>(function NativeVideoPlayer(
  { sourceUrl, isHls, canControl, onStateChange, onSeek, onError, onReady, onTimeUpdate },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isRemoteActionRef = useRef<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);

  // Initialize Video & HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;

    setInternalError(null);
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60
        });

        hls.loadSource(sourceUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          onReady?.();
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setIsBuffering(false);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setInternalError("Lỗi luồng phát HLS (.m3u8). Không thể tải dữ liệu video.");
                onError?.("Lỗi luồng phát HLS.");
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native Safari HLS
        video.src = sourceUrl;
      } else {
        const msg = "Trình duyệt của bạn không hỗ trợ định dạng HLS (.m3u8).";
        setInternalError(msg);
        onError?.(msg);
      }
    } else {
      // Direct MP4 / WebM
      video.src = sourceUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [sourceUrl, isHls]);

  useImperativeHandle(ref, () => ({
    play: () => {
      const video = videoRef.current;
      if (video) {
        isRemoteActionRef.current = true;
        video.play().catch(() => {}).finally(() => {
          setTimeout(() => {
            isRemoteActionRef.current = false;
          }, 400);
        });
      }
    },
    pause: () => {
      const video = videoRef.current;
      if (video) {
        isRemoteActionRef.current = true;
        video.pause();
        setTimeout(() => {
          isRemoteActionRef.current = false;
        }, 400);
      }
    },
    seekTo: (seconds: number) => {
      const video = videoRef.current;
      if (video && Number.isFinite(seconds)) {
        isRemoteActionRef.current = true;
        video.currentTime = seconds;
        setTimeout(() => {
          isRemoteActionRef.current = false;
        }, 400);
      }
    },
    getCurrentTime: () => {
      return videoRef.current?.currentTime || 0;
    },
    getDuration: () => {
      return videoRef.current?.duration || 0;
    }
  }));

  const handlePlay = () => {
    setIsBuffering(false);
    if (isRemoteActionRef.current) return;
    if (!canControl) {
      videoRef.current?.pause();
      return;
    }
    const current = videoRef.current?.currentTime || 0;
    onStateChange?.(true, current);
  };

  const handlePause = () => {
    if (isRemoteActionRef.current) return;
    if (!canControl) return;
    const current = videoRef.current?.currentTime || 0;
    onStateChange?.(false, current);
  };

  const handleSeeked = () => {
    if (isRemoteActionRef.current) return;
    if (!canControl) return;
    const current = videoRef.current?.currentTime || 0;
    const isPlaying = !videoRef.current?.paused;
    onSeek?.(current);
    onStateChange?.(isPlaying, current);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    onTimeUpdate?.(video.currentTime, video.duration || 0);
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: "260px" }}>
      <video
        ref={videoRef}
        className="w-full h-full block"
        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#050509" }}
        controls={canControl}
        playsInline
        crossOrigin="anonymous"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onLoadedData={() => {
          setIsBuffering(false);
          onReady?.();
        }}
        onError={() => {
          setIsBuffering(false);
          const msg = "Không thể phát tệp video này. Hãy kiểm tra đường dẫn hoặc quyền truy cập CORS.";
          setInternalError(msg);
          onError?.(msg);
        }}
      />

      {isBuffering && !internalError && (
        <div style={{ position: "absolute", pointerEvents: "none", display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: "8px", zIndex: 10 }}>
          <span className="spinner" style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #a855f7", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: "12px", color: "#e9d5ff" }}>Đang tải video...</span>
        </div>
      )}

      {internalError && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(18, 16, 28, 0.95)", color: "#ff8080", padding: "20px", textAlign: "center", zIndex: 20 }}>
          <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "8px" }}>⚠️ Lỗi phát video</p>
          <p style={{ fontSize: "13px", color: "#fca5a5", maxWidth: "450px" }}>{internalError}</p>
        </div>
      )}
    </div>
  );
});
