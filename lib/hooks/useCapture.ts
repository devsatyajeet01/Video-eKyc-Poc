import { useCallback } from "react";

export function useCapture() {
    const captureFrame = useCallback((videoElement: HTMLVideoElement): string | null => {
        if (!videoElement || videoElement.readyState !== 4) return null;

        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) return null;

        // Draw current frame
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Convert to Base64 (JPEG)
        return canvas.toDataURL("image/jpeg", 0.9);
    }, []);

    return { captureFrame };
}
