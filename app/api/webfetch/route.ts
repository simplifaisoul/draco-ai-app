import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'URL parameter is required' },
                { status: 400 }
            );
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // Call Jina Reader API
        const jinaUrl = `https://r.jina.ai/${url}`;

        const response = await fetch(jinaUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Return-Format': 'markdown'
            }
        });

        if (!response.ok) {
            throw new Error(`Jina Reader API returned ${response.status}`);
        }

        const content = await response.text();

        // Check if content is too large (limit to ~50KB for LLM context)
        const maxLength = 50000;
        const truncated = content.length > maxLength;
        const finalContent = truncated ? content.substring(0, maxLength) + '\n\n[Content truncated due to length...]' : content;

        return NextResponse.json({
            success: true,
            url,
            content: finalContent,
            truncated,
            originalLength: content.length,
            finalLength: finalContent.length
        });

    } catch (error) {
        console.error('Web Fetch Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch webpage content',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
