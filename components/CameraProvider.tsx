"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface CameraContextType {
    stream: MediaStream | null;
    error: string | null;
    isStreaming: boolean;
    startCamera: () => Promise<void>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: React.ReactNode }) {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    // Auto-start camera on mount (optional, can be manual)
    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user",
                },
                audio: false,
            });
            setStream(mediaStream);
            setIsStreaming(true);
            setError(null);
        } catch (err: any) {
            console.error("Camera error:", err);
            setError(err.message || "Failed to access camera");
            setIsStreaming(false);
        }
    };

    return (
        <CameraContext.Provider value={{ stream, error, isStreaming, startCamera }}>
            {children}
        </CameraContext.Provider>
    );
}

export function useCamera() {
    const context = useContext(CameraContext);
    if (!context) {
        throw new Error("useCamera must be used within a CameraProvider");
    }
    return context;
}
