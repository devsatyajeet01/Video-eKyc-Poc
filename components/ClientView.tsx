"use client";

import React, { useEffect, useRef } from "react";
import { useCamera } from "./CameraProvider";

interface ClientViewProps {
    mode?: "FACE" | "ID" | "NONE";
}

export default function ClientView({ mode = "NONE" }: ClientViewProps) {
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

            {/* Overlays */}
            {mode === "FACE" && (
                <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-80 rounded-[50%] border-4 border-dashed border-blue-400/50 shadow-[0_0_100px_rgba(0,0,0,0.5)]"></div>
                    <div className="absolute mt-96 text-blue-300 font-medium text-sm bg-black/50 px-3 py-1 rounded-full">
                        Position Face Here
                    </div>
                </div>
            )}

            {mode === "ID" && (
                <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                    <div className="w-[650px] h-[400px] rounded-xl border-4 border-dashed border-yellow-400/50 shadow-[0_0_100px_rgba(0,0,0,0.5)]"></div>
                    <div className="absolute mt-80 text-yellow-300 font-medium text-sm bg-black/50 px-3 py-1 rounded-full">
                        Fit ID Card Here (Close Up)
                    </div>
                </div>
            )}

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
