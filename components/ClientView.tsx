"use client";

import React, { useEffect, useRef } from "react";
import { useCamera } from "./CameraProvider";

export default function ClientView() {
    const { stream, error, isStreaming } = useCamera();
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    if (error) {
        return (
            <div className="flex items-center justify-center w-full h-full bg-red-50 text-red-600 rounded-lg">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-gray-800">
            <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                Client View (Raw)
            </div>

            {!isStreaming && (
                <div className="flex items-center justify-center h-full text-gray-400">
                    Waiting for camera...
                </div>
            )}

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
            />
        </div>
    );
}
