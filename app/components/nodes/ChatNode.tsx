import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Define the data type specific to our node
export type ChatNodeData = {
    role: 'user' | 'assistant';
    content: string;
};

// Define the Node type with our data
export type ChatNode = Node<ChatNodeData>;

export function ChatNode({ data }: NodeProps<ChatNode>) {
    const isUser = data.role === 'user';

    return (
        <div className={`shadow-xl rounded-2xl border min-w-[300px] max-w-[400px] p-4 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] ${isUser
                ? 'bg-white/5 border-white/10 text-white'
                : 'bg-black/40 border-purple-500/30 text-gray-100 shadow-purple-500/10'
            }`}>
            <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />

            <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                <div className={`w-2 h-2 rounded-full ${isUser ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]' : 'bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.5)]'}`} />
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                    {isUser ? 'You' : 'Draco'}
                </span>
            </div>

            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.content}
                </ReactMarkdown>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
        </div>
    );
}
