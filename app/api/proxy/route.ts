import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { method, url, headers, body: requestBody } = body;

        console.log(`[API Proxy] ${method} ${url}`);

        if (!url || !method) {
            return NextResponse.json(
                { error: 'URL and Method are required' },
                { status: 400 }
            );
        }

        // Prepare fetch options
        const options: RequestInit = {
            method: method.toUpperCase(),
            headers: headers || {},
        };

        // Add body for non-GET/HEAD requests
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method!) && requestBody) {
            options.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);

            // Ensure Content-Type is set if body is present
            if (!(options.headers as any)['Content-Type']) {
                (options.headers as any)['Content-Type'] = 'application/json';
            }
        }

        const response = await fetch(url, options);

        // Try to parse JSON, falling back to text
        let responseData;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        return NextResponse.json({
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: responseData
        });

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
