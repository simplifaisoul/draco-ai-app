/**
 * Agent Chat API — Agentic loop with PROGRESSIVE STREAMING
 * Events are pushed to the client in real-time as they happen.
 * Gemini plans → shell executes → output streamed → repeat
 */

import { NextRequest } from 'next/server';
import { execCommand } from '@/app/lib/ssh';

const MAX_ITERATIONS = 10;
const EXEC_TAG_REGEX = /<exec>([\s\S]*?)<\/exec>/g;
const GEMINI_MODEL = 'gemini-2.5-flash';

// Build API key pool from all available keys
function getApiKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEYS_BACKUP) {
    keys.push(...process.env.GEMINI_API_KEYS_BACKUP.split(',').map(k => k.trim()).filter(Boolean));
  }
  return keys;
}

let keyIndex = 0;
function getNextApiKey(): string {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error('No Gemini API keys configured');
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

const AGENT_SYSTEM_PROMPT = `You are Draco Agent — an autonomous, elite AI software engineer with your own LIVE Ubuntu Linux machine.

You have a REAL terminal. You run REAL commands. This is not a simulation.

THE PHILOSOPHY: DEEP THINKING & RELENTLESS EXECUTION
You are a Deep Thinker. You tackle deep problems by taking your time, researching meticulously, formulating a Gameplan, and executing with absolute precision. You NEVER give up. 

YOUR WORKFLOW:
1. READ & RESEARCH: Analyze the user's request comprehensively. What are the dependencies? What could go wrong?
2. THE GAMEPLAN: Always start your response by laying out a clear, step-by-step Gameplan. Explain your thought process to the user.
3. EXECUTE: Run commands using the <exec> tag. You operate in an iterative loop: you can issue a command, receive the output, and then issue the next command in an ongoing conversation.
4. VERIFY & COMMIT: After running commands, verify they succeeded. If a command fails, READ the error carefully, think deeply about why it failed, adjust your Gameplan, and try again.

EXECUTION FORMAT:
To run a command on your live machine, wrap it in <exec> tags:
<exec>ls -la /workspace</exec>

Multiple <exec> commands in one response are permitted. The system will run them and feed you the output so you can continue your Gameplan.

⚠️ CRITICAL ENVIRONMENT RULE:
Each command you run starts in /root with a FRESH context. The working directory does NOT persist between commands!
- WRONG: <exec>cd /workspace/myproject</exec> then <exec>ls</exec> (ls runs in /root, NOT /workspace/myproject!)
- RIGHT: <exec>cd /workspace/myproject && ls</exec> (chained with &&, runs in the correct directory)
- RIGHT: <exec>ls /workspace/myproject</exec> (absolute path)
Always chain cd with your actual command using && or use absolute paths.

STRICT RULES & BEST PRACTICES:
1. ALWAYS ACT: Don't just talk. If the user asks for something, DO IT. Every response addressing a task MUST include at least one <exec> tag if work remains.
2. PRECONDITIONS FIRST: The container comes with curl, git, wget, sudo, and nano pre-installed. You can use them immediately. If you need more tools, install them with apt-get.
3. STEP-BY-STEP ITERATION: Do not write massive, fragile 100-line bash scripts blindly. Run a few commands, check the output for success, then proceed to the next step of your Gameplan.
4. BE CONCISE & INTENSE: Speak like a senior AI engineer pair-programming with the user. Be direct, helpful, and highly motivated. Keep your gameplans SHORT (3-5 bullet points max). Don't over-explain.
5. WORKSPACE: Default to working inside \`/workspace\`.

KNOWN SOFTWARE:
- **OpenClaw**: OpenClaw is an open-source AI agent runtime from https://openclaw.ai. To install it, run: \`curl -fsSL https://openclaw.ai/install.sh | bash\`. It requires Node.js 22+ (install with: \`curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs\`). After install, run \`openclaw onboard\` to set it up.

When someone wants to build something, set it up end-to-end. LFG.`;


async function callGemini(messages: { role: string; content: string }[]): Promise<string> {
  const keys = getApiKeys();
  let lastError = '';

  // Try up to 3 keys
  for (let attempt = 0; attempt < Math.min(3, keys.length); attempt++) {
    const apiKey = getNextApiKey();
    const geminiMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemMsg = messages.find(m => m.role === 'system');
    const body: any = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    console.log(`[AGENT] Attempt ${attempt + 1}, key index ${(keyIndex - 1) % keys.length}/${keys.length}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        lastError = await res.text();
        console.warn(`[AGENT] Key failed (${res.status}): ${lastError.slice(0, 200)}`);
        if (res.status === 429 || res.status === 403) continue; // Try next key
        throw new Error(`Gemini API error ${res.status}: ${lastError}`);
      }

      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[AGENT] Response:', text.length, 'chars');
      return text;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = 'Gemini API request timed out (60s)';
        console.error('[AGENT]', lastError);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`All API keys failed. Last error: ${lastError.slice(0, 200)}`);
}

interface AgentEvent {
  type: 'response' | 'command' | 'output' | 'status';
  content: string;
  exitCode?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { vmid, messages } = await request.json();

    if (!vmid || !messages) {
      return new Response(JSON.stringify({ error: 'vmid and messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fullMessages = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const encoder = new TextEncoder();

    // Progressive streaming: push events as they happen
    const stream = new ReadableStream({
      async start(controller) {
        const push = (event: AgentEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {}
        };

        try {
          let iteration = 0;
          let currentMessages = [...fullMessages];

          while (iteration < MAX_ITERATIONS) {
            iteration++;
            console.log(`[AGENT] Iteration ${iteration}/${MAX_ITERATIONS}`);

            push({ type: 'status', content: `Thinking... (step ${iteration})` });

            // Call Gemini
            let responseText: string;
            try {
              responseText = await callGemini(currentMessages);
            } catch (err: any) {
              push({ type: 'response', content: `⚠️ AI error: ${err.message}` });
              break;
            }

            if (!responseText) {
              push({ type: 'response', content: 'No response from AI.' });
              break;
            }

            // Check for <exec> tags
            const execMatches = [...responseText.matchAll(EXEC_TAG_REGEX)];
            console.log(`[AGENT] Found ${execMatches.length} exec tags`);

            if (execMatches.length === 0) {
              // No commands — final response, stream it
              push({ type: 'response', content: responseText });
              break;
            }

            // Process text + commands progressively
            let lastIndex = 0;
            let hasError = false;

            for (const match of execMatches) {
              // Text before this command
              const textBefore = responseText.slice(lastIndex, match.index).trim();
              if (textBefore) {
                push({ type: 'response', content: textBefore });
              }

              const command = match[1].trim();
              push({ type: 'command', content: command });
              console.log(`[AGENT] Executing: ${command}`);

              // Execute command — streamed immediately
              try {
                const execResult = await execCommand(vmid, command);
                const output = [
                  execResult.stdout,
                  execResult.stderr ? `STDERR: ${execResult.stderr}` : '',
                ].filter(Boolean).join('\n') || '(no output)';

                push({ type: 'output', content: output, exitCode: execResult.exitCode });
                console.log(`[AGENT] Exit: ${execResult.exitCode}, output: ${output.length} chars`);

                currentMessages.push(
                  { role: 'assistant', content: responseText },
                  { role: 'user', content: `[Command Output for: ${command}]\n${output}\nExit Code: ${execResult.exitCode}` }
                );
              } catch (err: any) {
                const errorMsg = `Error: ${err.message}`;
                push({ type: 'output', content: errorMsg, exitCode: 1 });
                console.error(`[AGENT] Exec error:`, err.message);
                currentMessages.push(
                  { role: 'assistant', content: responseText },
                  { role: 'user', content: `[Command Error for: ${command}]\n${errorMsg}` }
                );
                hasError = true;
              }

              lastIndex = (match.index || 0) + match[0].length;
            }

            // Text after last command
            const textAfter = responseText.slice(lastIndex).trim();
            if (textAfter) {
              push({ type: 'response', content: textAfter });
            }

            // If no errors and all commands succeeded, we can stop if this seems like a final response
            // Otherwise the loop continues for the AI to react to outputs
          }
        } catch (err: any) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response', content: `⚠️ Agent error: ${err.message}` })}\n\n`));
          } catch {}
        } finally {
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Agent chat error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
