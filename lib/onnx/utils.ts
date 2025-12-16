import * as ort from "onnxruntime-web";

// Configure ONNX Runtime to use Wasm/WebGPU
ort.env.wasm.numThreads = 1; // Start with 1 for stability
ort.env.wasm.simd = true;

export const MODEL_INPUT_SIZE = 640;

export async function loadModel(modelPath: string) {
    try {
        const session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ["wasm"], // Fallback to 'webgpu' later if needed
            graphOptimizationLevel: "all",
        });
        return session;
    } catch (e) {
        console.error("Failed to load model:", e);
        throw e;
    }
}

/**
 * Preprocess image for YOLOv8
 * Input: HTMLCanvasElement or HTMLVideoElement
 * Output: Float32Array Tensor [1, 3, 640, 640]
 */
export function preprocess(source: HTMLVideoElement | HTMLCanvasElement): ort.Tensor {
    const canvas = document.createElement("canvas");
    canvas.width = MODEL_INPUT_SIZE;
    canvas.height = MODEL_INPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No context");

    // Resize and draw
    ctx.drawImage(source, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

    const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const { data } = imageData;

    const red: number[] = [];
    const green: number[] = [];
    const blue: number[] = [];

    // Normalize 0-255 -> 0.0-1.0
    for (let i = 0; i < data.length; i += 4) {
        red.push(data[i] / 255.0);
        green.push(data[i + 1] / 255.0);
        blue.push(data[i + 2] / 255.0);
    }

    // CHW format [1, 3, 640, 640]
    const float32Data = new Float32Array([...red, ...green, ...blue]);
    return new ort.Tensor("float32", float32Data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    label: number;
    prob: number;
}

/**
 * Parse YOLOv8 output
 * Output tensor shape: [1, 4 + num_classes, 8400]
 * We need to transpose and filter.
 */
export function postprocess(results: ort.InferenceSession.OnRunResult, imgWidth: number, imgHeight: number): BoundingBox[] {
    // Logic for post-processing varies slightly by export opset, 
    // but generally output[0] is the main output.
    // Standard YOLOv8 export: "output0"

    const output = results.output0 || results.images; // check your model's output name!
    if (!output) return [];

    const data = output.data as Float32Array;
    const [batch, channels, anchors] = output.dims; // [1, 6, 8400] usually (4 coords + 2 classes)

    // Transpose logic or iterate carefully
    // Channels: [cx, cy, w, h, prob_class0, prob_class1, ...]
    const boxes: BoundingBox[] = [];

    for (let i = 0; i < anchors; i++) {
        // Find max probability class
        // The data is likely flattened: first 8400 are cx, next 8400 are cy, etc...? 
        // OR it is interleaved?
        // YOLOv8 default export is usually [1, C, N] -> we iterate N

        // For [1, C, N], data layout: 
        // [cx0, cx1... cxN, cy0... cyN, w0... wN, h0... hN, prob0_0... prob0_N, prob1_0... prob1_N]

        // Let's assume standard layout.

        const STRIDE = anchors; // step between channels for same anchor index

        const cx = data[0 * STRIDE + i];
        const cy = data[1 * STRIDE + i];
        const w = data[2 * STRIDE + i];
        const h = data[3 * STRIDE + i];

        // Check classes
        let maxProb = 0;
        let maxLabel = 0;

        // Assuming 2 classes (Aadhaar, QR) -> Channels = 4 + 2 = 6
        // If generic yolov8n, classes=80. 
        // We should loop through channels 4 to C.

        for (let j = 4; j < channels; j++) {
            const prob = data[j * STRIDE + i];
            if (prob > maxProb) {
                maxProb = prob;
                maxLabel = j - 4;
            }
        }

        if (maxProb > 0.45) { // Threshold
            boxes.push({
                x: (cx - w / 2) * (imgWidth / MODEL_INPUT_SIZE),
                y: (cy - h / 2) * (imgHeight / MODEL_INPUT_SIZE),
                width: w * (imgWidth / MODEL_INPUT_SIZE),
                height: h * (imgHeight / MODEL_INPUT_SIZE),
                label: maxLabel,
                prob: maxProb,
            });
        }
    }

    return boxes; // Need NMS here ideally, but for demo simplistic filtering might work
}
