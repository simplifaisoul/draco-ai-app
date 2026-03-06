import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, applyRateLimitHeaders } from '@/app/lib/rateLimit';

export async function POST(request: NextRequest) {
    // Rate limit webfetch requests
    const ip = getRateLimitKey(request);
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
        const response = NextResponse.json(
            { error: 'Rate limit exceeded. Please slow down.' },
            { status: 429 }
        );
        applyRateLimitHeaders(response, rateLimit);
        return response;
    }

    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'URL parameter is required' },
                { status: 400 }
            );
        }

        // Validate URL format and protocol
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // Security: Only allow http/https
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json(
                { error: 'Only http and https protocols are allowed' },
                { status: 400 }
            );
        }

        // Security: Block internal/private IPs
        const blockedPatterns = [
            /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
            /^192\.168\./, /^0\.0\.0\.0$/, /^::1$/, /^169\.254\./,
            /^metadata\.google\.internal$/i
        ];
        if (blockedPatterns.some(p => p.test(parsedUrl.hostname))) {
            return NextResponse.json(
                { error: 'Requests to internal networks are not allowed' },
                { status: 403 }
            );
        }

        // Call Jina Reader API
        const jinaUrl = `https://r.jina.ai/${url}`;

        const response = await fetch(jinaUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Return-Format': 'markdown'
            },
            signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (!response.ok) {
            throw new Error(`Jina Reader API returned ${response.status}`);
        }

        const content = await response.text();

        // Limit to ~50KB for LLM context
        const maxLength = 50000;
        const truncated = content.length > maxLength;
        const finalContent = truncated ? content.substring(0, maxLength) + '\n\n[Content truncated due to length...]' : content;

        const result = NextResponse.json({
            success: true,
            url,
            content: finalContent,
            truncated,
            originalLength: content.length,
            finalLength: finalContent.length
        });
        applyRateLimitHeaders(result, rateLimit);
        return result;

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
