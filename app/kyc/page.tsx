"use client";

import React, { useEffect, useRef, useState } from "react";
import ClientView from "@/components/ClientView";
import AgentView from "@/components/AgentView";
import { CameraProvider, useCamera } from "@/components/CameraProvider";
import { useCapture } from "@/lib/hooks/useCapture";
import { Camera, ShieldCheck, AlertCircle, ScanFace, CreditCard, CheckCircle2, Loader2 } from "lucide-react";

type KYCStep = "FACE_CAPTURE" | "ID_CAPTURE" | "VERIFYING" | "RESULT";

function KYCContent() {
    const { startCamera, stream, error } = useCamera();
    const { captureFrame } = useCapture();

    // State
    const [step, setStep] = useState<KYCStep>("FACE_CAPTURE");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [faceImage, setFaceImage] = useState<string | null>(null);
    const [idImage, setIdImage] = useState<string | null>(null);
    const [verificationResult, setVerificationResult] = useState<any>(null);

    // Hidden video for capturing frames
    const captureVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        startCamera();
    }, []);

    // Bind stream to hidden capture video
    useEffect(() => {
        if (captureVideoRef.current && stream) {
            captureVideoRef.current.srcObject = stream;
        }
    }, [stream]);

    const startCountdown = () => {
        setCountdown(3);
    };

    // Countdown Logic
    useEffect(() => {
        if (countdown === null) return;

        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 10);
            return () => clearTimeout(timer);
        } else {
            // Countdown finished -> Capture
            handleCapture();
            setCountdown(null);
        }
    }, [countdown]);

    const handleCapture = () => {
        if (!captureVideoRef.current) return;

        const frame = captureFrame(captureVideoRef.current);
        if (!frame) return;

        if (step === "FACE_CAPTURE") {
            setFaceImage(frame);
            setStep("ID_CAPTURE");
        } else if (step === "ID_CAPTURE") {
            setIdImage(frame);
            verifyIdentity(faceImage!, frame);
        }
    };

    const verifyIdentity = async (face: string, id: string) => {
        setStep("VERIFYING");
        try {
            const res = await fetch("/api/kyc/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ faceImage: face, idImage: id }),
            });
            const data = await res.json();
            setVerificationResult(data);
        } catch (e) {
            console.error(e);
            setVerificationResult({ error: "Verification Failed" });
        }
        setStep("RESULT");
    };

    const resetFlow = () => {
        setStep("FACE_CAPTURE");
        setFaceImage(null);
        setIdImage(null);
        setVerificationResult(null);
    };

    return (
        <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans">
            {/* Hidden Capture Video (Must be rendered for capture) */}
            <video
                ref={captureVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute w-1 h-1 opacity-0 pointer-events-none"
            />

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md z-20">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Camera size={20} className="text-white" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">
                        Secure<span className="text-blue-500">KYC</span> Live
                    </h1>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-4 text-sm font-medium">
                    <div className={`flex items-center gap-2 ${step === "FACE_CAPTURE" ? "text-blue-400" : "text-neutral-600"}`}>
                        <ScanFace size={18} /> Face
                    </div>
                    <div className="w-8 h-px bg-neutral-800"></div>
                    <div className={`flex items-center gap-2 ${step === "ID_CAPTURE" ? "text-blue-400" : "text-neutral-600"}`}>
                        <CreditCard size={18} /> ID Card
                    </div>
                    <div className="w-8 h-px bg-neutral-800"></div>
                    <div className={`flex items-center gap-2 ${step === "RESULT" ? "text-green-400" : "text-neutral-600"}`}>
                        <CheckCircle2 size={18} /> Result
                    </div>
                </div>

                <button
                    onClick={resetFlow}
                    className="text-xs bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded transition-colors"
                >
                    Reset Session
                </button>
            </header>

            {/* Main Split View */}
            <main className="flex-1 flex overflow-hidden p-4 gap-4 relative">



                {/* Left Panel: Client View */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-sm font-medium text-neutral-400">Client Feed (Raw)</h2>
                        <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded text-neutral-500">LOCAL</span>
                    </div>
                    <div className="flex-1 relative bg-black rounded-xl border border-neutral-800 shadow-2xl overflow-hidden group">
                        {/* Client-specific Countdown Overlay */}
                        {countdown !== null && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none">
                                <div className="text-9xl font-bold text-white animate-pulse">
                                    {countdown === 0 ? "HOLD" : countdown}
                                </div>
                            </div>
                        )}
                        <ClientView mode={step === "FACE_CAPTURE" ? "FACE" : step === "ID_CAPTURE" ? "ID" : "NONE"} />
                        {/* Overlay instruction for Client */}
                        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                            <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                                {step === "FACE_CAPTURE" ? "Please look at the camera" :
                                    step === "ID_CAPTURE" ? "Please hold your ID card up" : "Processing..."}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Agent View */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-sm font-medium text-blue-400">Agent Interface</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-900/50">
                                AI ACTIVE
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 relative bg-black rounded-xl border border-blue-900/40 shadow-2xl overflow-hidden ring-1 ring-blue-900/20 flex flex-col">
                        {/* Video Area */}
                        <div className="flex-1 relative overflow-hidden">
                            <AgentView mode={step === "FACE_CAPTURE" ? "FACE" : step === "ID_CAPTURE" ? "ID" : "NONE"} />

                            {/* Captured Previews */}
                            <div className="absolute top-4 right-4 flex flex-col gap-2">
                                {faceImage && <img src={faceImage} alt="Face" className="w-20 h-20 rounded border-2 border-green-500 object-cover bg-black" />}
                                {idImage && <img src={idImage} alt="ID" className="w-20 h-20 rounded border-2 border-green-500 object-cover bg-black" />}
                            </div>
                        </div>

                        {/* Agent Controls */}
                        <div className="h-24 bg-neutral-900 border-t border-neutral-800 p-4 flex items-center justify-between z-30">
                            <div>
                                <h3 className="text-sm font-bold text-white">
                                    {step === "FACE_CAPTURE" ? "Step 1: Verify User" :
                                        step === "ID_CAPTURE" ? "Step 2: Verify ID" : "Verification Complete"}
                                </h3>
                                <p className="text-xs text-neutral-400">
                                    {step === "FACE_CAPTURE" ? "Ask user to look straight" :
                                        step === "ID_CAPTURE" ? "Ask user to show Aadhaar" : "Review results below"}
                                </p>
                            </div>

                            {step === "FACE_CAPTURE" && (
                                <button
                                    onClick={() => startCountdown()}
                                    disabled={countdown !== null}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95"
                                >
                                    <ScanFace size={20} /> Capture Face
                                </button>
                            )}

                            {step === "ID_CAPTURE" && (
                                <button
                                    onClick={() => startCountdown()}
                                    disabled={countdown !== null}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95"
                                >
                                    <CreditCard size={20} /> Capture ID
                                </button>
                            )}

                            {step === "VERIFYING" && (
                                <div className="flex items-center gap-2 text-yellow-500 font-medium animate-pulse">
                                    <Loader2 size={18} className="animate-spin" /> Verifying...
                                </div>
                            )}

                            {step === "RESULT" && (
                                <div className="flex items-center gap-2 text-green-500 font-medium">
                                    <CheckCircle2 size={18} /> Done
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </main>

            {/* Verification Result Overlay */}
            {step === "RESULT" && verificationResult && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative">
                        <button onClick={resetFlow} className="absolute top-4 right-4 text-neutral-500 hover:text-white">✕</button>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Identity Verified</h2>
                                <p className="text-neutral-400">Match Score: <span className="text-green-400 font-mono font-bold">{verificationResult.faceMatchScore}%</span></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-neutral-500 uppercase">Extracted Data (OCR)</h3>
                                <div className="bg-neutral-800 p-4 rounded-lg space-y-2 font-mono text-sm">
                                    <p><span className="text-neutral-500">Name:</span> {verificationResult.extractedData.name}</p>
                                    <p><span className="text-neutral-500">No:</span>   {verificationResult.extractedData.idNumber}</p>
                                    <p><span className="text-neutral-500">DOB:</span>  {verificationResult.extractedData.dob}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-neutral-500 uppercase">Proof of Identity</h3>
                                <div className="flex gap-2">
                                    <img src={faceImage!} alt="Face Proof" className="w-1/2 rounded-lg object-cover bg-neutral-800 h-32" />
                                    <img src={idImage!} alt="ID Proof" className="w-1/2 rounded-lg object-cover bg-neutral-800 h-32" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={resetFlow} className="px-4 py-2 text-neutral-300 hover:text-white">Close</button>
                            <button onClick={() => alert("Approved!")} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold text-white shadow-lg shadow-green-900/20">Approve KYC</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="h-10 border-t border-neutral-800 bg-neutral-900 flex items-center px-6 text-xs text-neutral-500 justify-between">
                <div>System Ready</div>
                <div>{error && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {error}</span>}</div>
            </footer>
        </div>
    );
}

export default function KYCPage() {
    return (
        <CameraProvider>
            <KYCContent />
        </CameraProvider>
    );
}
