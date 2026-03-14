import { Metadata } from 'next';
import SharedChatClient from './SharedChatClient';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dracoai-b0758';

interface Props {
    params: Promise<{ id: string }>;
}

async function getSharedChat(id: string) {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shared_chats/${id}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            messages: JSON.parse(data.fields?.messages?.stringValue || '[]'),
            title: data.fields?.title?.stringValue || 'Draco AI Chat',
            createdAt: data.fields?.createdAt?.stringValue || '',
        };
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const chat = await getSharedChat(id);
    const title = chat?.title || 'Shared Chat';
    return {
        title: `${title} — Draco AI`,
        description: 'A shared conversation from Draco AI — your agentic AI assistant with web search, image generation, and API access.',
        openGraph: {
            title: `${title} — Draco AI`,
            description: 'See this AI conversation on Draco AI',
            url: `https://dracoai.app/share/${id}`,
        },
    };
}

export default async function SharedChatPage({ params }: Props) {
    const { id } = await params;
    const chat = await getSharedChat(id);

    if (!chat) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">Chat not found</h1>
                    <p className="text-white/40 mb-6">This shared chat may have been deleted or never existed.</p>
                    <a href="https://dracoai.app" className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-500 hover:to-pink-500 transition-all">
                        Try Draco AI
                    </a>
                </div>
            </div>
        );
    }

    return <SharedChatClient messages={chat.messages} title={chat.title} createdAt={chat.createdAt} shareId={id} />;
}
