"use client";

import React, { useEffect, useRef, useState } from "react";
import { useCamera } from "./CameraProvider";
import * as ort from "onnxruntime-web";
import { loadModel, preprocess, postprocess, BoundingBox } from "@/lib/onnx/utils";

// Path to model in public folder
const MODEL_PATH = "/models/yolov8_trained_model.onnx";

interface AgentViewProps {
    mode?: "FACE" | "ID" | "NONE";
}

export default function AgentView({ mode = "NONE" }: AgentViewProps) {
    const { stream, error: cameraError, isStreaming } = useCamera();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [modelLoading, setModelLoading] = useState(true);
    const [modelError, setModelError] = useState<string | null>(null);
    const sessionRef = useRef<ort.InferenceSession | null>(null);
    const requestRef = useRef<number | null>(null);

    // Load ONNX Model
    useEffect(() => {
        const initModel = async () => {
            try {
                console.log("Loading model...");
                const session = await loadModel(MODEL_PATH);
                sessionRef.current = session;
                setModelLoading(false);
                console.log("Model loaded successfully");
            } catch (e: any) {
                console.error("Model load failed:", e);
                // Fallback or error message
                setModelError("Failed to load detection model. Masking disabled.");
                setModelLoading(false);
            }
        };
        initModel();
    }, []);

    // Bind stream to video
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Detection Loop
    useEffect(() => {
        const detectFrame = async () => {
            if (
                !videoRef.current ||
                !canvasRef.current ||
                videoRef.current.readyState !== 4
            ) {
                requestRef.current = requestAnimationFrame(detectFrame);
                return;
            }

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // 1. Inference First (Calculate what to hide)
            let boxes: BoundingBox[] = [];
            // Safe width/height for initial inference
            const inferWidth = canvas.width || 640;
            const inferHeight = canvas.height || 480;

            if (sessionRef.current && !modelError) {
                try {
                    const tensor = preprocess(video);
                    const feeds: Record<string, ort.Tensor> = {};
                    feeds[sessionRef.current.inputNames[0]] = tensor;
                    const results = await sessionRef.current.run(feeds);
                    boxes = postprocess(results, inferWidth, inferHeight);
                } catch (e) {
                    console.error("Inference error:", e);
                }
            }

            // 2. Setup Canvas
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            if (video.videoWidth === 0) {
                // Loading placeholder
                ctx.fillStyle = "#111";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#666";
                ctx.font = "20px sans-serif";
                ctx.fillText("Initializing Video...", 20, 50);
                requestRef.current = requestAnimationFrame(detectFrame);
                return;
            }

            // 3. Draw Scene based on Mode & Detection
            if (mode === "ID") {
                // A. Draw Blurred Background (Always)
                const ctxAny = ctx as any;
                ctxAny.filter = 'blur(15px)'; // Strong blur
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctxAny.filter = 'none';

                // B. If Masking Detected -> Reveal Center & Apply Masks
                // Strict Privacy: Only unblur if "Aadhaar Number" (Class 0) is found.
                // This prevents accidentally showing the number if the AI only sees a Photo/QR.
                const isSensitiveDataFound = boxes.some(box => box.label === 0);

                if (isSensitiveDataFound) {
                    const boxW = canvas.width * 0.6;
                    const boxH = canvas.height * 0.55;
                    const boxX = (canvas.width - boxW) / 2;
                    const boxY = (canvas.height - boxH) / 2;

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(boxX, boxY, boxW, boxH);
                    ctx.clip();

                    // Draw Sharp Video in Center
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Draw Black Masks on top of the Sharp Video
                    ctx.fillStyle = "black";
                    boxes.forEach((box: BoundingBox) => {
                        ctx.fillRect(box.x, box.y, box.width, box.height);
                    });

                    ctx.restore();
                } else {
                    // C. No Detection? Draw a semi-transparent overlay
                    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = "white";
                    ctx.font = "16px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("Looking for ID Card...", canvas.width / 2, canvas.height / 2);
                }

            } else {
                // Standard Mode (Face / None) -> Full Sharp
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Draw Masks
                ctx.fillStyle = "black";
                boxes.forEach((box: BoundingBox) => {
                    ctx.fillRect(box.x, box.y, box.width, box.height);
                });
            }

            requestRef.current = requestAnimationFrame(detectFrame);
        };

        if (isStreaming) {
            detectFrame();
        }

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isStreaming, modelError, mode]);

    if (cameraError) return <div className="text-red-500">{cameraError}</div>;

    return (
        <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-gray-800">
            {/* ... Agent Label and Warnings ... */}
            <div className="absolute top-4 right-4 z-10 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg animate-pulse">
                Agent View (Masked)
            </div>

            {modelLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-white">
                    Loading AI Model...
                </div>
            )}

            {modelError && (
                <div className="absolute top-16 right-4 z-20 bg-yellow-600 text-white px-3 py-1 rounded text-xs">
                    Warning: Masking Offline
                </div>
            )}

            {/* Overlays - Mirroring ClientView */}
            {mode === "FACE" && (
                <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-80 rounded-[50%] border-4 border-dashed border-blue-400/50 shadow-[0_0_100px_rgba(0,0,0,0.5)]"></div>
                    <div className="absolute mt-96 text-blue-300 font-medium text-sm bg-black/50 px-3 py-1 rounded-full">
                        Face Guide
                    </div>
                </div>
            )}

            {mode === "ID" && (
                <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                    <div className="w-[650px] h-[400px] rounded-xl border-4 border-dashed border-yellow-400/50 shadow-[0_0_100px_rgba(0,0,0,0.5)]"></div>
                    <div className="absolute mt-80 text-yellow-300 font-medium text-sm bg-black/50 px-3 py-1 rounded-full">
                        ID Guide
                    </div>
                </div>
            )}

            {/* Hidden Source Video (Must be rendered for dimensions) */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
            />

            {/* Main Display Canvas (Video + Mask) */}
            <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
            />
        </div>
    );
}
