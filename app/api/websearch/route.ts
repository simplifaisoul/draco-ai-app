
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query } = body;

        if (!query) {
            return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
        }

        console.log(`[WebSearch] Scraping DuckDuckGo for: ${query}`);

        // Scrape DuckDuckGo HTML (Keyless)
        // Note: This is a fallback method since standard APIs require keys.
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`DuckDuckGo returned ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const results: any[] = [];

        $('.result').each((i, element) => {
            if (i >= 5) return false;
            const title = $(element).find('.result__title').text().trim();
            const url = $(element).find('.result__a').attr('href');
            const description = $(element).find('.result__snippet').text().trim();

            if (title && url) {
                results.push({ title, url, description });
            }
        });

        console.log(`[WebSearch] Found ${results.length} results`);

        return NextResponse.json({
            success: true,
            query,
            results: {
                results,
                infobox: null // Scraping doesn't easily get infoboxes reliably
            },
            source: 'duckduckgo-scrape'
        });

    } catch (error) {
        console.error('Web Search Error:', error);
        return NextResponse.json({
            error: 'Failed to perform web search',
            details: error instanceof Error ? error.message : 'Unknown'
        }, { status: 500 });
    }
}
