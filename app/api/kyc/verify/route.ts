import { NextRequest, NextResponse } from "next/server";
import { RekognitionClient, CompareFacesCommand } from "@aws-sdk/client-rekognition";
import { ImageAnnotatorClient } from "@google-cloud/vision";

// --- Configuration ---
// Ensure these ENV variables are set in .env.local
const awsClient = new RekognitionClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

// For Google, it usually looks for GOOGLE_APPLICATION_CREDENTIALS file path
// OR we can pass credentials object directly if we parse them from env
const googleClient = new ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Fix common newline issue in env
    },
    // projectId: process.env.GOOGLE_PROJECT_ID 
});

// Helper: Convert Data URL to Buffer
function parseImage(dataUrl: string): Buffer {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64Data, "base64");
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { faceImage, idImage } = body;

        if (!faceImage || !idImage) {
            return NextResponse.json(
                { error: "Missing face or ID image" },
                { status: 400 }
            );
        }

        console.log("Processing Verification Request...");

        // 1. Prepare Buffers
        console.log("Parsing Images...");
        console.log("Face Image Header:", faceImage.substring(0, 50) + "...");

        const faceBuffer = parseImage(faceImage);
        const idBuffer = parseImage(idImage);

        console.log("Face Buffer Size:", faceBuffer.length, "bytes");
        console.log("ID Buffer Size:", idBuffer.length, "bytes");

        if (faceBuffer.length === 0 || idBuffer.length === 0) {
            throw new Error("One of the image buffers is empty.");
        }

        // 2. AWS Rekognition: Face Match
        let faceMatchScore = 0;
        try {
            console.log("Calling AWS Rekognition...");
            const command = new CompareFacesCommand({
                SourceImage: { Bytes: faceBuffer },
                TargetImage: { Bytes: idBuffer },
                SimilarityThreshold: 70, // Minimum confidence
            });
            const awsRes = await awsClient.send(command);

            // Get the best match
            if (awsRes.FaceMatches && awsRes.FaceMatches.length > 0) {
                faceMatchScore = awsRes.FaceMatches[0].Similarity || 0;
            } else {
                faceMatchScore = 0;
            }
            console.log("AWS Score:", faceMatchScore);
        } catch (awsError: any) {
            console.error("AWS Error:", awsError);
            // Handle "No Face Detected" specifically (InvalidParameterException)
            if (awsError.name === 'InvalidParameterException' || awsError.message?.includes('no faces')) {
                return NextResponse.json({
                    verified: false,
                    faceMatchScore: 0,
                    message: "No face detected in one of the photos. Please retake."
                });
            }
        }

        // 3. Google Vision: OCR
        let extractedData = { name: "Not Found", idNumber: "Not Found", dob: "Not Found" };
        try {
            console.log("Calling Google Vision...");
            const [result] = await googleClient.textDetection({
                image: { content: idBuffer }
            });

            const text = result.fullTextAnnotation?.text || "";
            console.log("OCR Text Length:", text.length);

            // Simple Regex Parsing (Customize for Aadhaar/PAN)
            const aadhaarRegex = /\d{4}\s\d{4}\s\d{4}/;
            const dobRegex = /\d{2}\/\d{2}\/\d{4}/;
            // Name usually appears below specific keywords, difficult to parse perfectly without structured logic

            extractedData = {
                name: "EXTRACTED USER", // Placeholder - Requires complex parsing logic
                idNumber: text.match(aadhaarRegex)?.[0] || "No ID Found",
                dob: text.match(dobRegex)?.[0] || "No DOB Found",
            };

        } catch (googleError) {
            console.error("Google Vision Error:", googleError);
        }

        /* 
        // --- OLD MOCK IMPLEMENTATION (Commented) ---
        const mockResponse = {
          verified: true,
          faceMatchScore: 98.5,
          extractedData: {
            idNumber: "#### #### 1234",
            name: "SATYAJEET SINGH",
            dob: "01/01/1995"
          },
          message: "Verification Successful"
        };
        await new Promise(resolve => setTimeout(resolve, 1500));
        return NextResponse.json(mockResponse); 
        */

        // 4. Return Real Result
        return NextResponse.json({
            verified: faceMatchScore > 80,
            faceMatchScore: parseFloat(faceMatchScore.toFixed(2)),
            extractedData,
            message: faceMatchScore > 80 ? "Identity Verified" : "Verification Failed (Face Mismatch)"
        });

    } catch (e: any) {
        console.error("Verification Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
