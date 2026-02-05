// Native fetch is available in Node.js 18+

async function testPollinations() {
    const messages = [
        { role: 'user', content: 'Hello, who are you?' }
    ];

    const modelId = 'openai';
    const endpoint = `https://text.pollinations.ai/${modelId}`;

    console.log(`Testing endpoint: ${endpoint}`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: messages,
                stream: false // Testing non-streaming first
            }),
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
