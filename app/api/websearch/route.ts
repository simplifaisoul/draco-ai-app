import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query } = body;

        if (!query || typeof query !== 'string') {
            return NextResponse.json(
                { error: 'Query parameter is required' },
                { status: 400 }
            );
        }

        // Use Serper.dev API (2,500 free queries/month, no credit card required)
        const SERPER_API_KEY = process.env.SERPER_API_KEY;

        console.log('Serper API Key exists:', !!SERPER_API_KEY);
        console.log('Searching for:', query);

        if (!SERPER_API_KEY) {
            console.error('SERPER_API_KEY not found in environment variables');
            return NextResponse.json({
                success: true,
                query,
                results: {
                    query,
                    results: [{
                        title: "API Key Missing",
                        url: "https://serper.dev",
                        description: "Please add SERPER_API_KEY to your .env.local file. Get a free API key at serper.dev (2,500 free searches/month)"
                    }],
                    infobox: null
                },
                source: 'error'
            });
        }

        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                num: 5
            })
        });

        console.log('Serper response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Serper API error:', errorText);
            throw new Error(`Serper API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Serper response:', JSON.stringify(data).substring(0, 200));

        // Extract organic results
        const results = (data.organic || []).slice(0, 5).map((item: any) => ({
            title: item.title,
            url: item.link,
            description: item.snippet || ''
        }));

        // Extract knowledge graph if available
        const infobox = data.knowledgeGraph ? {
            title: data.knowledgeGraph.title || '',
            content: data.knowledgeGraph.description || '',
            url: data.knowledgeGraph.website || data.knowledgeGraph.descriptionLink || ''
        } : null;

        console.log('Returning', results.length, 'results');

        return NextResponse.json({
            success: true,
            query,
            results: {
                query,
                results,
                infobox
            },
            source: 'serper'
        });

    } catch (error) {
        console.error('Web Search Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to perform web search',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
