import { NextRequest, NextResponse } from 'next/server';

// Image Generation API — HuggingFace Inference with multiple model fallbacks
export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
        }

        // Try HuggingFace models in order of preference
        const models = [
            'stabilityai/stable-diffusion-xl-base-1.0',
            'runwayml/stable-diffusion-v1-5',
        ];

        const hfToken = process.env.HF_TOKEN || '';

        for (const model of models) {
            let retries = 3;
            let waitTime = 2000;

            while (retries > 0) {
                try {
                    // Using the new router.huggingface.co endpoint (api-inference is deprecated)
                    const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`;

                    const headers: Record<string, string> = {
                        'Content-Type': 'application/json'
                    };
                    if (hfToken) {
                        headers['Authorization'] = `Bearer ${hfToken}`;
                    }

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            inputs: prompt,
                        }),
                        signal: AbortSignal.timeout(60000), // longer timeout for image gen
                    });

                    if (response.ok) {
                        const contentType = response.headers.get('content-type') || 'image/png';
                        const imageBuffer = await response.arrayBuffer();

                        if (imageBuffer.byteLength > 1000) { // Sanity check — real images are > 1KB
                            const base64 = Buffer.from(imageBuffer).toString('base64');
                            return NextResponse.json({
                                imageUrl: `data:${contentType};base64,${base64}`,
                                model: model.split('/')[1] || model
                            });
                        }
                    }

                    // Handle "Model is loading" (HTTP 503) from HuggingFace
                    if (response.status === 503) {
                        console.warn(`HF model ${model} is loading. Retrying in ${waitTime / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        waitTime *= 2; // exponential backoff
                        retries--;
                        continue;
                    }

                    console.warn(`HF model ${model} failed: ${response.status}`);
                    break; // Unrecoverable error, try next model
                } catch (e) {
                    console.warn(`HF model ${model} error:`, e);
                    break;
                }
            }
        }

        // All HuggingFace models failed — generate a styled placeholder
        // Use a reliable SVG-based image as absolute last resort
        const svgPlaceholder = generatePlaceholderSVG(prompt);
        return NextResponse.json({
            imageUrl: svgPlaceholder,
            model: 'placeholder',
            note: 'HuggingFace models unavailable. Add HF_TOKEN env var for reliable image generation.'
        });

    } catch (error: any) {
        console.error('Image generation error:', error);
        return NextResponse.json({
            imageUrl: generatePlaceholderSVG('Image'),
            model: 'error-fallback'
        }, { status: 200 });
    }
}

function generatePlaceholderSVG(prompt: string): string {
    // Create a nice SVG placeholder that always works
    const truncatedPrompt = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1a0533;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0d1117;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="1024" height="768" fill="url(#bg)" rx="16"/>
        <text x="512" y="340" text-anchor="middle" fill="#a855f7" font-family="system-ui" font-size="64" font-weight="bold">🎨</text>
        <text x="512" y="400" text-anchor="middle" fill="#e2e8f0" font-family="system-ui" font-size="20" font-weight="600">Image Generation</text>
        <text x="512" y="435" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="14">"${truncatedPrompt}"</text>
        <text x="512" y="480" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="12">Add HF_TOKEN to Vercel env vars for full image generation</text>
    </svg>`;
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
}
