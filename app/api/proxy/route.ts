import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, applyRateLimitHeaders } from '@/app/lib/rateLimit';

// Security: Block requests to internal/private networks (SSRF prevention)
const BLOCKED_HOSTS = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^169\.254\.\d+\.\d+$/, // link-local
    /^metadata\.google\.internal$/i,
    /^100\.100\.100\.200$/, // cloud metadata
];

// Security: Only allow specific HTTP methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// Security: Max response size (500KB) to prevent memory exhaustion
const MAX_RESPONSE_SIZE = 500 * 1024;

function isBlockedHost(hostname: string): boolean {
    return BLOCKED_HOSTS.some(pattern => pattern.test(hostname));
}

export async function POST(request: NextRequest) {
    // Rate limit proxy requests (shared with chat)
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
        const { method, url, headers, body: requestBody } = body;

        if (!url || !method) {
            return NextResponse.json(
                { error: 'URL and Method are required' },
                { status: 400 }
            );
        }

        // Validate HTTP method
        const upperMethod = method.toUpperCase();
        if (!ALLOWED_METHODS.includes(upperMethod)) {
            return NextResponse.json(
                { error: `Method "${method}" is not allowed` },
                { status: 400 }
            );
        }

        // Validate and parse URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // Security: Only allow http/https protocols
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json(
                { error: 'Only http and https protocols are allowed' },
                { status: 400 }
            );
        }

        // Security: Block internal/private network access (SSRF prevention)
        if (isBlockedHost(parsedUrl.hostname)) {
            return NextResponse.json(
                { error: 'Requests to internal networks are not allowed' },
                { status: 403 }
            );
        }

        console.log(`[API Proxy] ${upperMethod} ${parsedUrl.origin}${parsedUrl.pathname}`);

        // Prepare fetch options
        const options: RequestInit = {
            method: upperMethod,
            headers: {
                'User-Agent': 'DracoAI/0.4',
                ...(headers || {})
            },
            signal: AbortSignal.timeout(15000), // 15s timeout
        };

        // Add body for non-GET/HEAD requests
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod) && requestBody) {
            options.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);

            if (!(options.headers as any)['Content-Type']) {
                (options.headers as any)['Content-Type'] = 'application/json';
            }
        }

        const response = await fetch(url, options);

        // Try to parse JSON, falling back to text
        let responseData;
        const contentType = response.headers.get('content-type');

        // Read response with size limit
        const responseText = await response.text();
        if (responseText.length > MAX_RESPONSE_SIZE) {
            responseData = responseText.substring(0, MAX_RESPONSE_SIZE) + '\n[Truncated - response too large]';
        } else if (contentType && contentType.includes('application/json')) {
            try {
                responseData = JSON.parse(responseText);
            } catch {
                responseData = responseText;
            }
        } else {
            responseData = responseText;
        }

        const result = NextResponse.json({
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: responseData
        });
        applyRateLimitHeaders(result, rateLimit);
        return result;

    } catch (error) {
        console.error('API Request Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to perform API request',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
