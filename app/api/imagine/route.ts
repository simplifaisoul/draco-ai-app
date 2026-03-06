import { NextRequest, NextResponse } from 'next/server';

// HuggingFace Image Generation API — uses free Inference API
// Supports Stable Diffusion and FLUX models
export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
        }

        const hfToken = process.env.HF_TOKEN || '';
        // Use FLUX.1-schnell for fast, quality image generation (free tier)
        const model = 'black-forest-labs/FLUX.1-schnell';
        const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (hfToken) {
            headers['Authorization'] = `Bearer ${hfToken}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ inputs: prompt }),
            signal: AbortSignal.timeout(60000), // 60s timeout for image gen
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HuggingFace Image API error: ${response.status} - ${errorText}`);
            return NextResponse.json(
                { error: `Image generation failed: ${response.status}`, fallbackUrl: getFallbackUrl(prompt) },
                { status: 502 }
            );
        }

        // HuggingFace returns the image as binary data
        const imageBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;

        return NextResponse.json({ imageUrl: dataUrl, model });
    } catch (error: any) {
        console.error('Image generation error:', error);
        const prompt = '';
        return NextResponse.json(
            { error: error.message, fallbackUrl: getFallbackUrl(prompt) },
            { status: 500 }
        );
    }
}

// Fallback: use a simple image API if HuggingFace is down
function getFallbackUrl(prompt: string): string {
    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 10000);
    return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=1024&height=768&nologo=true`;
}
