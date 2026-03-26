/**
 * Agent Chat API — Persistent Shell Agentic Loop with Real-Time Streaming
 * 
 * ARCHITECTURE:
 * - Uses AgentShell (persistent `pct enter` PTY) instead of stateless `pct exec`
 * - Shell state persists across commands: cd, env vars, running processes all survive
 * - Commands + output stream to the frontend in real-time via SSE
 * - Sentinel-based command completion detection
 * 
 * EVENT TYPES streamed to client:
 *   { type: "status",   content: "Thinking..." }
 *   { type: "command",  content: "ls -la /workspace" }
 *   { type: "output",   content: "...", exitCode: 0 }
 *   { type: "response", content: "Here's what I found..." }
 *   { type: "artifact", content: "{filename}:{filepath}" }
 */

import { NextRequest } from 'next/server';
import { getOrCreateShell } from '@/app/lib/agentShell';

const MAX_ITERATIONS = 12;
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
Your shell is PERSISTENT — cd, environment variables, and running processes survive between commands.

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

Multiple <exec> commands in one response are permitted. The system will run them sequentially and feed you the output so you can continue your Gameplan.

PERSISTENT SHELL — YOUR SUPERPOWER:
Your terminal is a persistent interactive shell. This means:
- ✅ \`cd /workspace/myproject\` in one <exec> → the next <exec> is STILL in /workspace/myproject
- ✅ \`export MY_VAR=hello\` → the next <exec> can use $MY_VAR
- ✅ You can start background processes, use screen/tmux, etc.
- Use \`cd\` freely. Chain with \`&&\` for multi-step commands when needed for atomicity.

STRICT RULES & BEST PRACTICES:
1. ALWAYS ACT: Don't just talk. If the user asks for something, DO IT. Every response addressing a task MUST include at least one <exec> tag if work remains.
2. PRECONDITIONS FIRST: The container comes with curl, git, wget, sudo, and nano pre-installed. You can use them immediately. If you need more tools, install them with apt-get.
3. STEP-BY-STEP ITERATION: Do not write massive, fragile 100-line bash scripts blindly. Run a few commands, check the output for success, then proceed to the next step of your Gameplan.
4. BE CONCISE & INTENSE: Speak like a senior AI engineer pair-programming with the user. Be direct, helpful, and highly motivated. Keep your gameplans SHORT (3-5 bullet points max). Don't over-explain.
5. WORKSPACE: Default to working inside \`/workspace\`.

📄 DOCUMENT & FILE GENERATION:
When the user asks you to create a PDF, Word document, spreadsheet, or any downloadable file:
1. Install the needed Python library (pip3 install reportlab python-docx openpyxl etc.)
2. Write a Python script that generates the file and saves it to /workspace/
3. Run the script with <exec>
4. After confirming the file was created, output a download link in this EXACT format:

[DOWNLOAD:filename.pdf:/workspace/filename.pdf]

Examples:
- [DOWNLOAD:report.pdf:/workspace/report.pdf]
- [DOWNLOAD:proposal.docx:/workspace/proposal.docx]
- [DOWNLOAD:data.xlsx:/workspace/data.xlsx]

The system will automatically render these as beautiful download cards in the chat UI. ALWAYS use this format for downloadable files.

For PDF generation, prefer \`reportlab\`. For Word docs, use \`python-docx\`. For Excel, use \`openpyxl\`.

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
      const timeout = setTimeout(() => controller.abort(), 60000);

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
        if (res.status === 429 || res.status === 403) continue;
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
  type: 'response' | 'command' | 'output' | 'status' | 'artifact';
  content: string;
  exitCode?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { vmid, messages, sessionId } = await request.json();

    if (!vmid || !messages) {
      return new Response(JSON.stringify({ error: 'vmid and messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const activeSessionId = sessionId || `agent-${vmid}`;

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

        // Get or create a PERSISTENT shell for this session
        let shell;
        try {
          push({ type: 'status', content: 'Connecting to your machine...' });
          shell = await getOrCreateShell(vmid, activeSessionId);
          push({ type: 'status', content: 'Connected. Thinking...' });
        } catch (err: any) {
          push({ type: 'response', content: `⚠️ Failed to connect to container: ${err.message}` });
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch {}
          return;
        }

        try {
          let iteration = 0;
          let currentMessages = [...fullMessages];

          while (iteration < MAX_ITERATIONS) {
            iteration++;
            console.log(`[AGENT] Iteration ${iteration}/${MAX_ITERATIONS}`);

            push({ type: 'status', content: iteration === 1 ? 'Thinking...' : `Analyzing results... (step ${iteration})` });

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

            for (const match of execMatches) {
              // Text before this command
              const textBefore = responseText.slice(lastIndex, match.index).trim();
              if (textBefore) {
                push({ type: 'response', content: textBefore });
              }

              const command = match[1].trim();
              push({ type: 'command', content: command });
              console.log(`[AGENT] Executing in persistent shell: ${command}`);

              // Execute command in the PERSISTENT shell — streams output in real-time
              try {
                const execResult = await shell.runCommand(command, (chunk) => {
                  // Stream raw terminal output to client in real-time
                  // Filter out sentinel markers from the live stream
                  if (!chunk.includes('___DRACO_DONE_')) {
                    push({ type: 'output', content: chunk });
                  }
                });

                const output = execResult.stdout || '(no output)';
                // Send final clean output with exit code
                push({ type: 'output', content: output, exitCode: execResult.exitCode });
                console.log(`[AGENT] Exit: ${execResult.exitCode}, output: ${output.length} chars`);

                // Check for artifact files in the output
                const artifactRegex = /\[DOWNLOAD:([^:]+):([^\]]+)\]/g;
                let artifactMatch;
                while ((artifactMatch = artifactRegex.exec(output)) !== null) {
                  push({ type: 'artifact', content: `${artifactMatch[1]}:${artifactMatch[2]}` });
                }

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
              }

              lastIndex = (match.index || 0) + match[0].length;
            }

            // Text after last command
            const textAfter = responseText.slice(lastIndex).trim();
            if (textAfter) {
              push({ type: 'response', content: textAfter });

              // Check for download links in the response text too
              const dlRegex = /\[DOWNLOAD:([^:]+):([^\]]+)\]/g;
              let dlMatch;
              while ((dlMatch = dlRegex.exec(textAfter)) !== null) {
                push({ type: 'artifact', content: `${dlMatch[1]}:${dlMatch[2]}` });
              }
            }
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
