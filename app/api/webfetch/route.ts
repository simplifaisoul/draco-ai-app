import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, applyRateLimitHeaders } from '@/app/lib/rateLimit';

export async function POST(request: NextRequest) {
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
            return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json({ error: 'Only http and https protocols are allowed' }, { status: 400 });
        }

        // Security: Block internal/private IPs
        const blockedPatterns = [
            /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
            /^192\.168\./, /^0\.0\.0\.0$/, /^::1$/, /^169\.254\./,
            /^metadata\.google\.internal$/i
        ];
        if (blockedPatterns.some(p => p.test(parsedUrl.hostname))) {
            return NextResponse.json({ error: 'Requests to internal networks are not allowed' }, { status: 403 });
        }

        let content = '';
        let source = '';

        // Strategy 1: Try Jina Reader API (best for clean content)
        try {
            const jinaUrl = `https://r.jina.ai/${url}`;
            const jinaResponse = await fetch(jinaUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Return-Format': 'markdown'
                },
                signal: AbortSignal.timeout(20000),
            });

            if (jinaResponse.ok) {
                content = await jinaResponse.text();
                source = 'jina';
            }
        } catch (e) {
            console.warn('Jina Reader failed, trying direct fetch:', e);
        }

        // Strategy 2: Direct fetch with browser-like headers
        if (!content) {
            try {
                const directResponse = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                    },
                    signal: AbortSignal.timeout(15000),
                });

                if (directResponse.ok) {
                    const html = await directResponse.text();
                    // Basic HTML to text: strip tags, decode entities, clean up
                    content = html
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, '\n')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
                    source = 'direct';
                }
            } catch (e) {
                console.warn('Direct fetch also failed:', e);
            }
        }

        // Strategy 3: Try Google Cache as last resort
        if (!content) {
            try {
                const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
                const cacheResponse = await fetch(cacheUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    signal: AbortSignal.timeout(10000),
                });

                if (cacheResponse.ok) {
                    const html = await cacheResponse.text();
                    content = html
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, '\n')
                        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
                    source = 'cache';
                }
            } catch (e) {
                console.warn('Google Cache also failed:', e);
            }
        }

        if (!content) {
            return NextResponse.json(
                { error: `Unable to fetch content from ${parsedUrl.hostname}. This site may block automated requests.` },
                { status: 502 }
            );
        }

        // Limit to ~50KB for LLM context
        const maxLength = 50000;
        const truncated = content.length > maxLength;
        const finalContent = truncated ? content.substring(0, maxLength) + '\n\n[Content truncated...]' : content;

        const result = NextResponse.json({
            success: true,
            url,
            content: finalContent,
            truncated,
            source,
            originalLength: content.length,
        });
        applyRateLimitHeaders(result, rateLimit);
        return result;

    } catch (error) {
        console.error('Web Fetch Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch webpage content', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
