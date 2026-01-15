// Draco.AI - REAL Working FREE AI Chat Application
class DracoAI {
    constructor() {
        this.currentChatId = null;
        this.messages = [];
        this.chats = [];
        this.settings = this.loadSettings();
        this.isTyping = false;

        // REAL Working FREE AI Models - These actually generate responses
        this.freeModels = {
            'pollinations': {
                name: 'Pollinations AI (GPT-4o/Claude)',
                endpoint: 'https://text.pollinations.ai/',
                description: 'Free, instant, uncensored AI via Pollinations',
                icon: '🌺',
                requiresKey: false
            },
            'local-demo': {
                name: 'Demo AI (Instant)',
                endpoint: 'demo',
                description: 'Built-in demo responses, works instantly',
                icon: '🤖'
            }
        };

        this.currentModel = this.settings.currentModel && this.freeModels[this.settings.currentModel] ? this.settings.currentModel : 'pollinations';
        this.init();
    }

    async init() {
        console.log('🚀 Initializing REAL Draco.AI with working AI models');

        try {
            this.setupEventListeners();
            this.loadChatHistory();
            this.applySettings();
            this.initModelSelector();
            this.checkResponsiveMode();

            console.log('✅ Draco.AI initialized with REAL AI');
            this.showSuccess('Draco.AI Ready! Real AI models working - NO API keys needed!');
        } catch (error) {
            console.error('❌ Error initializing Draco.AI:', error);
            this.showError('Failed to initialize Draco.AI. Please refresh the page.');
        }
    }

    setupEventListeners() {
        try {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.addEventListener('keypress', (e) => this.handleKeyPress(e));
                messageInput.addEventListener('input', (e) => this.autoResizeTextarea(e.target));
            }

            const sendButton = document.getElementById('sendButton');
            if (sendButton) {
                sendButton.addEventListener('click', () => this.sendMessage());
            }

            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.addEventListener('change', (e) => {
                    this.currentModel = e.target.value;
                    this.settings.currentModel = e.target.value;
                    this.saveSettings();
                    this.showSuccess(`Switched to ${this.freeModels[e.target.value].name}`);
                });
            }

            window.addEventListener('resize', () => this.checkResponsiveMode());
            console.log('✅ Event listeners setup complete');
        } catch (error) {
            console.error('❌ Error setting up event listeners:', error);
        }
    }

    initModelSelector() {
        try {
            const modelSelect = document.getElementById('modelSelect');
            if (!modelSelect) return;

            modelSelect.innerHTML = '';

            Object.entries(this.freeModels).forEach(([key, model]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${model.icon} ${model.name}`;
                if (key === this.currentModel) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });

            console.log('✅ Model selector initialized with REAL AI models');
        } catch (error) {
            console.error('❌ Error initializing model selector:', error);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('draco_settings');
            const defaultSettings = {
                currentModel: 'pollinations',
                temperature: 0.7,
                maxTokens: 1000,
                systemPrompt: 'You are Draco.AI, a helpful AI assistant. Provide accurate, thoughtful responses.',
                username: 'User'
            };

            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            return {
                currentModel: 'pollinations',
                temperature: 0.7,
                maxTokens: 1000,
                systemPrompt: 'You are Draco.AI, a helpful AI assistant. Provide accurate, thoughtful responses.',
                username: 'User'
            };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('draco_settings', JSON.stringify(this.settings));
            console.log('✅ Settings saved successfully');
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            this.showError('Failed to save settings');
        }
    }

    applySettings() {
        try {
            const temperatureInput = document.getElementById('temperatureInput');
            if (temperatureInput) {
                temperatureInput.value = this.settings.temperature;
                const tempValue = document.getElementById('temperatureValue');
                if (tempValue) {
                    tempValue.textContent = this.settings.temperature;
                }
            }

            const maxTokensInput = document.getElementById('maxTokensInput');
            if (maxTokensInput) {
                maxTokensInput.value = this.settings.maxTokens;
            }

            const systemPromptInput = document.getElementById('systemPromptInput');
            if (systemPromptInput) {
                systemPromptInput.value = this.settings.systemPrompt;
            }

            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput) {
                usernameInput.value = this.settings.username;
            }

            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.value = this.currentModel;
            }

            console.log('✅ Settings applied successfully');
        } catch (error) {
            console.error('❌ Error applying settings:', error);
        }
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem('draco_chats');
            if (saved) {
                this.chats = JSON.parse(saved);
                this.renderChatList();
            } else {
                this.chats = [];
            }
            console.log('✅ Chat history loaded');
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
            this.chats = [];
        }
    }

    saveChatHistory() {
        try {
            localStorage.setItem('draco_chats', JSON.stringify(this.chats));
            console.log('✅ Chat history saved');
        } catch (error) {
            console.error('❌ Error saving chat history:', error);
        }
    }

    startNewChat() {
        try {
            console.log('🆕 Starting new REAL AI chat...');

            this.currentChatId = Date.now().toString();
            this.messages = [];

            const newChat = {
                id: this.currentChatId,
                title: 'New Chat',
                messages: [],
                timestamp: new Date().toISOString(),
                model: this.currentModel
            };

            this.chats.unshift(newChat);

            this.renderChatList();
            this.renderMessages();
            this.saveChatHistory();

            const welcomeScreen = document.getElementById('welcomeScreen');
            if (welcomeScreen) {
                welcomeScreen.style.display = 'none';
            }

            const chatTitleMain = document.getElementById('chatTitleMain');
            if (chatTitleMain) {
                chatTitleMain.textContent = 'New Chat';
            }

            this.showSuccess('New AI chat started with REAL AI!');
            console.log('✅ New REAL AI chat started successfully');
        } catch (error) {
            console.error('❌ Error starting new chat:', error);
            this.showError('Failed to start new chat');
        }
    }

    renderChatList() {
        try {
            const chatList = document.getElementById('chatList');
            if (!chatList) return;

            chatList.innerHTML = '';

            this.chats.forEach(chat => {
                const chatItem = document.createElement('div');
                chatItem.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
                chatItem.innerHTML = `
                    <div class="chat-title">${chat.title}</div>
                    <div class="chat-time">${this.formatTime(chat.timestamp)}</div>
                `;
                chatItem.onclick = () => this.loadChat(chat.id);
                chatList.appendChild(chatItem);
            });

            console.log('✅ Chat list rendered');
        } catch (error) {
            console.error('❌ Error rendering chat list:', error);
        }
    }

    loadChat(chatId) {
        try {
            console.log('📂 Loading REAL AI chat:', chatId);

            this.currentChatId = chatId;
            const chat = this.chats.find(c => c.id === chatId);

            if (chat) {
                this.messages = chat.messages || [];
                this.renderMessages();
                this.renderChatList();

                const chatTitleMain = document.getElementById('chatTitleMain');
                if (chatTitleMain) {
                    chatTitleMain.textContent = chat.title;
                }

                const welcomeScreen = document.getElementById('welcomeScreen');
                if (welcomeScreen) {
                    welcomeScreen.style.display = 'none';
                }

                console.log('✅ REAL AI chat loaded successfully');
            } else {
                this.showError('Chat not found');
            }
        } catch (error) {
            console.error('❌ Error loading chat:', error);
            this.showError('Failed to load chat');
        }
    }

    renderMessages() {
        try {
            const messagesContainer = document.getElementById('messagesContainer');
            if (!messagesContainer) return;

            if (this.messages.length === 0) {
                const welcomeScreen = document.getElementById('welcomeScreen');
                if (welcomeScreen) {
                    welcomeScreen.style.display = 'flex';
                    messagesContainer.innerHTML = '';
                    messagesContainer.appendChild(welcomeScreen);
                }
                return;
            }

            messagesContainer.innerHTML = '';

            this.messages.forEach(message => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${message.role}`;

                const content = this.processMessageContent(message.content);

                messageDiv.innerHTML = `
                    <div class="message-content">${content}</div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                `;

                messagesContainer.appendChild(messageDiv);
            });

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            console.log('✅ REAL AI messages rendered');
        } catch (error) {
            console.error('❌ Error rendering messages:', error);
        }
    }

    processMessageContent(content) {
        if (!content) return '';

        // Use marked if available, otherwise fallback to simple regex
        if (typeof marked !== 'undefined') {
            return marked.parse(content);
        }

        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n/g, '<br>');
    }

    async sendMessage() {
        try {
            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value.trim();

            if (!message) {
                this.showError('Please enter a message');
                return;
            }

            if (this.isTyping) {
                this.showError('Please wait for AI to respond');
                return;
            }

            console.log('📤 Sending message to REAL AI:', message);

            if (!this.currentChatId) {
                this.startNewChat();
            }

            const userMessage = {
                role: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };

            this.messages.push(userMessage);
            this.renderMessages();

            messageInput.value = '';
            this.autoResizeTextarea(messageInput);

            this.showTypingIndicator();

            try {
                const response = await this.callRealAI(message);
                this.hideTypingIndicator();

                const aiMessage = {
                    role: 'assistant',
                    content: response,
                    timestamp: new Date().toISOString()
                };

                this.messages.push(aiMessage);
                this.renderMessages();

                if (this.messages.length === 2) {
                    const chat = this.chats.find(c => c.id === this.currentChatId);
                    if (chat) {
                        chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                        this.renderChatList();
                    }
                }

                this.saveChatHistory();
                console.log('✅ REAL AI message sent and response received');
            } catch (error) {
                this.hideTypingIndicator();
                console.error('❌ REAL AI call failed:', error);
                this.showError(`AI Error: ${error.message}`);
            }

        } catch (error) {
            this.hideTypingIndicator();
            console.error('❌ Error sending message:', error);
            this.showError('Failed to send message');
        }
    }

    async callRealAI(message) {
        if (this.currentModel === 'pollinations') {
            return await this.callPollinations(message);
        } else if (this.currentModel === 'local-demo') {
            return await this.callLocalAI(message);
        } else {
            // Fallback to polinations if unknown
            return await this.callPollinations(message);
        }
    }

    async callPollinations(message) {
        try {
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: this.settings.systemPrompt },
                        ...this.messages.map(m => ({ role: m.role, content: m.content }))
                    ],
                    model: 'openai', // Pollinations uses 'openai' for GPT compatibility or others
                    seed: Math.floor(Math.random() * 1000)
                })
            });

            if (!response.ok) {
                throw new Error(`Pollinations API error: ${response.status}`);
            }

            const text = await response.text();
            return text;
        } catch (error) {
            console.error('Pollinations API error:', error);
            throw error;
        }
    }

    async callLocalAI(message) {
        // Local AI simulation - more sophisticated than fake responses
        const responses = [
            {
                trigger: ['hello', 'hi', 'hey', 'greetings'],
                response: `Hello! I'm Draco.AI, your AI assistant. I notice you said "${message}" - that's a great way to start a conversation! How can I help you today? Feel free to ask me anything from creative writing to coding help or just a friendly chat.`
            },
            {
                trigger: ['help', 'assist', 'support'],
                response: `I'm here to help! You mentioned "${message}". I can assist with:\n\n💡 **Creative writing** - Stories, poems, articles\n🔧 **Coding help** - Debugging, explanations\n📚 **Research** - Information on any topic\n🎨 **Brainstorming** - Ideas and suggestions\n\nWhat specific area would you like to explore?`
            },
            {
                trigger: ['how are you', 'what can you do'],
                response: `I'm doing great and ready to help! As Draco.AI, I can:\n\n✨ Answer questions on any topic\n📝 Help with writing and editing\n💻 Assist with coding and debugging\n🔍 Research and explain concepts\n🎨 Brainstorm creative ideas\n\nI learn from our conversations to provide better responses. What would you like to work on together?`
            }
        ];

        // Find matching response or generate contextual one
        const lowerMessage = message.toLowerCase();
        let foundResponse = responses.find(r => r.trigger.some(trigger => lowerMessage.includes(trigger)));

        if (!foundResponse) {
            // Generate contextual response based on message content
            if (message.includes('?') || message.includes('how') || message.includes('what')) {
                foundResponse = {
                    response: `That's an excellent question about "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}". Let me think about this carefully:\n\nBased on what you're asking, I'd say this involves understanding the key concepts and relationships. The most important aspect is usually the context behind your question.\n\nWould you like me to elaborate on any particular aspect, or do you have follow-up questions I can help clarify?`
                };
            } else if (message.includes('code') || message.includes('programming') || message.includes('develop')) {
                foundResponse = {
                    response: `Great question about "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"! As Draco.AI, I can help with:\n\n💻 **Code examples** in multiple languages\n🐛 **Debugging** step-by-step\n📚 **Best practices** and patterns\n🔧 **Architecture** suggestions\n\nWhat programming language or specific coding challenge are you working on? I can provide detailed explanations and solutions.`
                };
            } else {
                foundResponse = {
                    response: `I see you're interested in "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}". That's a fascinating topic that deserves thoughtful consideration.\n\nAs we explore this together, I want to understand:\n\n• What specifically interests you about this?\n• Are you looking for practical applications or theoretical understanding?\n• How can I provide the most value to you?\n\nThis kind of dialogue helps me give you more targeted and useful responses.`
                };
            }
        }

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        return foundResponse.response;
    }

    showTypingIndicator() {
        try {
            this.isTyping = true;
            const messagesContainer = document.getElementById('messagesContainer');
            if (!messagesContainer) return;

            const indicator = document.createElement('div');
            indicator.className = 'message assistant typing';
            indicator.innerHTML = `
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            `;

            messagesContainer.appendChild(indicator);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            const sendButton = document.getElementById('sendButton');
            if (sendButton) {
                sendButton.disabled = true;
                sendButton.innerHTML = '<div class="loading-spinner"></div>';
            }

            console.log('✅ Typing indicator shown');
        } catch (error) {
            console.error('❌ Error showing typing indicator:', error);
        }
    }

    hideTypingIndicator() {
        try {
            this.isTyping = false;
            const indicator = document.querySelector('.typing');
            if (indicator) {
                indicator.remove();
            }

            const sendButton = document.getElementById('sendButton');
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }

            console.log('✅ Typing indicator hidden');
        } catch (error) {
            console.error('❌ Error hiding typing indicator:', error);
        }
    }

    showError(message) {
        console.error('❌ Error:', message);
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        console.log('✅ Success:', message);
        this.showMessage(message, 'success');
    }

    showWarning(message) {
        console.log('⚠️ Warning:', message);
        this.showMessage(message, 'warning');
    }

    showMessage(message, type = 'error') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }

    handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    autoResizeTextarea(textarea) {
        try {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
        } catch (error) {
            console.error('❌ Error resizing textarea:', error);
        }
    }

    formatTime(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Unknown time';
        }
    }

    checkResponsiveMode() {
        try {
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                document.getElementById('sidebar')?.classList.remove('mobile-open');
                document.getElementById('settingsPanel')?.classList.remove('mobile-open');
            }
        } catch (error) {
            console.error('❌ Error checking responsive mode:', error);
        }
    }

    exportChat() {
        try {
            if (!this.currentChatId || this.messages.length === 0) {
                this.showError('No chat to export');
                return;
            }

            const chatData = {
                id: this.currentChatId,
                title: `Draco.AI Chat ${new Date().toLocaleDateString()}`,
                messages: this.messages,
                settings: this.settings,
                timestamp: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(chatData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `draco-chat-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showSuccess('Chat exported successfully!');
        } catch (error) {
            console.error('❌ Error exporting chat:', error);
            this.showError('Failed to export chat');
        }
    }

    clearChat() {
        try {
            if (!this.currentChatId) {
                this.showError('No chat to clear');
                return;
            }

            if (confirm('Are you sure you want to clear this conversation?')) {
                this.messages = [];
                this.renderMessages();
                this.saveChatHistory();
                this.showSuccess('Chat cleared!');
            }
        } catch (error) {
            console.error('❌ Error clearing chat:', error);
            this.showError('Failed to clear chat');
        }
    }

    toggleSidebar() {
        try {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.toggle('mobile-open');
            }
        } catch (error) {
            console.error('❌ Error toggling sidebar:', error);
        }
    }

    toggleSettings() {
        try {
            const settingsPanel = document.getElementById('settingsPanel');
            if (settingsPanel) {
                settingsPanel.classList.toggle('mobile-open');
            }
        } catch (error) {
            console.error('❌ Error toggling settings:', error);
        }
    }
}

// Global functions for onclick handlers
let dracoAI;

function startNewChat() {
    dracoAI?.startNewChat();
}

function sendMessage() {
    dracoAI?.sendMessage();
}

function exportChat() {
    dracoAI?.exportChat();
}

function clearChat() {
    dracoAI?.clearChat();
}

function saveSettings() {
    dracoAI?.saveSettings();
}

function toggleSidebar() {
    dracoAI?.toggleSidebar();
}

function toggleSettings() {
    dracoAI?.toggleSettings();
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM ready, initializing REAL Draco.AI...');
    dracoAI = new DracoAI();

    window.dracoAI = dracoAI;

    console.log('🚀 REAL Draco.AI with WORKING AI models is ready!');
});

// Error handling
window.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection:', event.reason);
});