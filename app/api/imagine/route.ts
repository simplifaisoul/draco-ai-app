import { NextRequest, NextResponse } from 'next/server';

// Image Generation API — tries multiple sources
export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
        }

        // Strategy 1: HuggingFace Inference API (direct endpoint, no router)
        const hfToken = process.env.HF_TOKEN || '';
        if (hfToken) {
            try {
                const model = 'black-forest-labs/FLUX.1-schnell';
                const endpoint = `https://api-inference.huggingface.co/models/${model}`;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${hfToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ inputs: prompt }),
                    signal: AbortSignal.timeout(45000),
                });

                if (response.ok) {
                    const imageBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(imageBuffer).toString('base64');
                    return NextResponse.json({
                        imageUrl: `data:image/png;base64,${base64}`,
                        model: 'FLUX.1-schnell'
                    });
                }
                console.warn(`HF direct failed: ${response.status}`);
            } catch (e) {
                console.warn('HuggingFace image gen failed:', e);
            }
        }

        // Strategy 2: Pollinations URL (free, no API key, returns image directly via URL)
        // This is a URL-based service — the image is generated when the URL is accessed
        const seed = Math.floor(Math.random() * 10000);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=1024&height=768&nologo=true`;

        return NextResponse.json({
            imageUrl: pollinationsUrl,
            model: 'pollinations'
        });

    } catch (error: any) {
        console.error('Image generation error:', error);
        // Last resort fallback URL
        const seed = Math.floor(Math.random() * 10000);
        return NextResponse.json({
            imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent('a beautiful image')}?seed=${seed}&width=1024&height=768&nologo=true`,
            model: 'fallback'
        }, { status: 200 }); // Return 200 so client gets a URL even on error
    }
}
