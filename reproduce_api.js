// Native fetch is available in Node.js 18+

async function testPollinations() {
    const messages = [
        { role: 'user', content: 'Hello, who are you?' }
    ];

    const modelId = 'openai';
    // Testing root endpoint instead of /modelId, passing model in body if needed (though Pollinations often infers or uses path)
    // Actually, Pollinations documentation says GET /:prompt or POST body. 
    // Let's try the root endpoint.
    const endpoint = `https://text.pollinations.ai/Test`;

    console.log(`Testing endpoint: ${endpoint}`);

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`API Error: ${response.status}`);
            console.error(`Response Body: ${text}`);
        } else {
            const text = await response.text();
            console.log("Success!");
            console.log(text.substring(0, 100) + "...");
        }
    } catch (error) {
        console.error("Network Error:", error);
    }
}

testPollinations();
