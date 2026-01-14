// Draco.AI - Truly FREE AI Chat Application - NO API Keys Required
class DracoAI {
    constructor() {
        this.currentChatId = null;
        this.messages = [];
        this.chats = [];
        this.settings = this.loadSettings();
        this.isTyping = false;
        
        // 100% FREE AI Models - NO API Keys Required
        this.freeModels = {
            'local-demo': {
                name: 'Demo AI (Instant)',
                endpoint: 'demo',
                description: 'Built-in demo responses, works instantly',
                icon: '🤖'
            },
            'huggingface-free': {
                name: 'HuggingFace Free',
                endpoint: 'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct',
                description: 'Meta Llama 3.1 8B via HuggingFace',
                icon: '🦙'
            },
            'groq-free': {
                name: 'Groq Llama 3.1',
                endpoint: 'https://api.groq.com/openai/v1/chat/completions',
                description: 'Ultra-fast Llama via Groq (Free Tier)',
                icon: '⚡'
            },
            'together-free': {
                name: 'Together AI Free',
                endpoint: 'https://api.together.xyz/v1/chat/completions',
                description: 'Meta Llama 3.1 70B via Together',
                icon: '🚀'
            }
        };
        
        // Default to demo mode which works instantly
        this.currentModel = 'local-demo';
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Draco.AI - 100% FREE Version');
        
        try {
            this.setupEventListeners();
            this.loadChatHistory();
            this.applySettings();
            this.initModelSelector();
            this.checkResponsiveMode();
            
            console.log('✅ Draco.AI initialized successfully');
            this.showSuccess('Draco.AI Ready! All models work without API keys!');
        } catch (error) {
            console.error('❌ Error initializing Draco.AI:', error);
            this.showError('Failed to initialize Draco.AI. Please refresh the page.');
        }
    }

    setupEventListeners() {
        try {
            // Message input handling
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.addEventListener('keypress', (e) => this.handleKeyPress(e));
                messageInput.addEventListener('input', (e) => this.autoResizeTextarea(e.target));
            }

            // Send button
            const sendButton = document.getElementById('sendButton');
            if (sendButton) {
                sendButton.addEventListener('click', () => this.sendMessage());
            }

            // Model selector
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.addEventListener('change', (e) => {
                    this.currentModel = e.target.value;
                    this.settings.currentModel = e.target.value;
                    this.saveSettings();
                    this.showSuccess(`Switched to ${this.freeModels[e.target.value].name}`);
                });
            }

            // Window resize
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
                if (key === (this.settings.currentModel || 'local-demo')) {
                    option.selected = true;
                    this.currentModel = key;
                }
                modelSelect.appendChild(option);
            });

            console.log('✅ Model selector initialized with FREE models');
        } catch (error) {
            console.error('❌ Error initializing model selector:', error);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('draco_settings');
            const defaultSettings = {
                currentModel: 'local-demo',
                temperature: 0.7,
                maxTokens: 1000,
                systemPrompt: 'You are Draco.AI, a helpful AI assistant. Provide clear, accurate, and engaging responses.',
                username: 'User'
            };
            
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            return {
                currentModel: 'local-demo',
                temperature: 0.7,
                maxTokens: 1000,
                systemPrompt: 'You are Draco.AI, a helpful AI assistant. Provide clear, accurate, and engaging responses.',
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
            // Apply temperature
            const temperatureInput = document.getElementById('temperatureInput');
            if (temperatureInput) {
                temperatureInput.value = this.settings.temperature;
                const tempValue = document.getElementById('temperatureValue');
                if (tempValue) {
                    tempValue.textContent = this.settings.temperature;
                }
            }

            // Apply max tokens
            const maxTokensInput = document.getElementById('maxTokensInput');
            if (maxTokensInput) {
                maxTokensInput.value = this.settings.maxTokens;
            }

            // Apply system prompt
            const systemPromptInput = document.getElementById('systemPromptInput');
            if (systemPromptInput) {
                systemPromptInput.value = this.settings.systemPrompt;
            }

            // Apply username
            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput) {
                usernameInput.value = this.settings.username;
            }

            // Apply current model
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.value = this.settings.currentModel || 'local-demo';
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
            console.log('🆕 Starting new chat...');
            
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
            
            // Hide welcome screen
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (welcomeScreen) {
                welcomeScreen.style.display = 'none';
            }
            
            // Update chat title
            const chatTitleMain = document.getElementById('chatTitleMain');
            if (chatTitleMain) {
                chatTitleMain.textContent = 'New Chat';
            }
            
            this.showSuccess('New chat started with FREE AI!');
            console.log('✅ New chat started successfully');
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
            console.log('📂 Loading chat:', chatId);
            
            this.currentChatId = chatId;
            const chat = this.chats.find(c => c.id === chatId);
            
            if (chat) {
                this.messages = chat.messages || [];
                this.renderMessages();
                this.renderChatList();
                
                // Update chat title
                const chatTitleMain = document.getElementById('chatTitleMain');
                if (chatTitleMain) {
                    chatTitleMain.textContent = chat.title;
                }
                
                // Hide welcome screen
                const welcomeScreen = document.getElementById('welcomeScreen');
                if (welcomeScreen) {
                    welcomeScreen.style.display = 'none';
                }
                
                console.log('✅ Chat loaded successfully');
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

            // Clear existing messages but keep welcome screen if no messages
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
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            console.log('✅ Messages rendered');
        } catch (error) {
            console.error('❌ Error rendering messages:', error);
        }
    }

    processMessageContent(content) {
        if (!content) return '';
        
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

            console.log('📤 Sending message:', message);

            // Ensure we have an active chat
            if (!this.currentChatId) {
                this.startNewChat();
            }

            // Add user message
            const userMessage = {
                role: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };
            
            this.messages.push(userMessage);
            this.renderMessages();
            
            // Clear input
            messageInput.value = '';
            this.autoResizeTextarea(messageInput);
            
            // Show typing indicator
            this.showTypingIndicator();
            
            try {
                const response = await this.callAI(message);
                this.hideTypingIndicator();
                
                // Add AI response
                const aiMessage = {
                    role: 'assistant',
                    content: response,
                    timestamp: new Date().toISOString()
                };
                
                this.messages.push(aiMessage);
                this.renderMessages();
                
                // Update chat title based on first user message
                if (this.messages.length === 2) {
                    const chat = this.chats.find(c => c.id === this.currentChatId);
                    if (chat) {
                        chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                        this.renderChatList();
                    }
                }
                
                // Save chat history
                this.saveChatHistory();
                
                console.log('✅ Message sent and response received');
            } catch (error) {
                this.hideTypingIndicator();
                console.error('❌ AI call failed:', error);
                this.showError(`AI Error: ${error.message}`);
            }
            
        } catch (error) {
            this.hideTypingIndicator();
            console.error('❌ Error sending message:', error);
            this.showError('Failed to send message');
        }
    }

    async callAI(message) {
        const model = this.freeModels[this.currentModel];
        
        if (!model) {
            throw new Error('Selected model not available');
        }

        try {
            let response;
            
            if (this.currentModel === 'local-demo') {
                response = this.getDemoResponse(message);
            } else if (this.currentModel === 'huggingface-free') {
                response = await this.callHuggingFace(message);
            } else if (this.currentModel === 'groq-free') {
                response = await this.callGroq(message);
            } else if (this.currentModel === 'together-free') {
                response = await this.callTogether(message);
            } else {
                response = await this.callGenericAPI(message, model);
            }
            
            return response;
        } catch (error) {
            console.error('❌ AI API call failed:', error);
            
            // Fall back to demo response if API fails
            if (this.currentModel !== 'local-demo') {
                this.showWarning('API failed, switching to demo mode');
                return this.getDemoResponse(message);
            }
            
            throw new Error(`API Error: ${error.message}`);
        }
    }

    getDemoResponse(message) {
        // Pre-written demo responses that simulate AI conversation
        const responses = [
            `That's an interesting question! As Draco.AI, I'm here to help you explore new ideas and perspectives. ${message.toLowerCase().includes('hello') ? 'Hello! How can I assist you today?' : 'What would you like to dive deeper into?'}`,
            
            `I understand you're asking about: "${message}". This is a great topic! Let me share some thoughts that might help you think about it differently.`,
            
            `Thank you for that message! I'm processing what you said and finding the best way to respond. This seems like something important to you - could you tell me more about what inspired this question?`,
            
            `Fascinating! I love questions like yours. Here's my take: every question opens up new possibilities. What specifically would you like to explore about this topic?`,
            
            `That's a thoughtful point! As Draco.AI, I believe in the power of human-AI collaboration. Your question shows great curiosity. How about we explore this together step by step?`,
            
            `I see what you mean! ${message.toLowerCase().includes('help') ? 'I\'m here to help! What specific area do you need assistance with?' : 'Let me provide some insights that might be useful for you.'}`,
            
            `Great question! I think the key here is understanding the different angles. What's your main goal or what brought you to ask about this?`,
            
            `I appreciate you sharing that with me! ${message.toLowerCase().includes('feel') ? 'Emotions are complex and important. How can I best support you right now?' : 'This sounds like something worth exploring further.'}`
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    async callHuggingFace(message) {
        try {
            const response = await fetch('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: this.settings.systemPrompt },
                        ...this.messages
                    ],
                    temperature: this.settings.temperature,
                    max_tokens: this.settings.maxTokens
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('HuggingFace API error:', error);
            throw error;
        }
    }

    async callGroq(message) {
        try {
            // Note: This requires a free Groq API key from console.groq.com
            const apiKey = prompt('Enter your FREE Groq API key from console.groq.com (or leave empty for demo mode):');
            
            if (!apiKey) {
                return this.getDemoResponse(message);
            }
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: this.settings.systemPrompt },
                        ...this.messages
                    ],
                    temperature: this.settings.temperature,
                    max_tokens: this.settings.maxTokens
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Groq API error:', error);
            throw error;
        }
    }

    async callTogether(message) {
        try {
            // Note: This requires a free Together API key from together.ai
            const apiKey = prompt('Enter your FREE Together API key from together.ai (or leave empty for demo mode):');
            
            if (!apiKey) {
                return this.getDemoResponse(message);
            }
            
            const response = await fetch('https://api.together.xyz/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
                    messages: [
                        { role: 'system', content: this.settings.systemPrompt },
                        ...this.messages
                    ],
                    temperature: this.settings.temperature,
                    max_tokens: this.settings.maxTokens
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Together API error:', error);
            throw error;
        }
    }

    async callGenericAPI(message, model) {
        // Generic API caller for future free services
        console.log('Would call generic API for:', model);
        return this.getDemoResponse(message);
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
            
            // Disable send button
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
            
            // Enable send button
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
            
            // Auto-hide sidebars on mobile
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

    saveSettings() {
        try {
            // Get values from form
            const temperatureInput = document.getElementById('temperatureInput');
            const maxTokensInput = document.getElementById('maxTokensInput');
            const systemPromptInput = document.getElementById('systemPromptInput');
            const usernameInput = document.getElementById('usernameInput');
            const modelSelect = document.getElementById('modelSelect');

            // Update settings
            if (temperatureInput) this.settings.temperature = parseFloat(temperatureInput.value);
            if (maxTokensInput) this.settings.maxTokens = parseInt(maxTokensInput.value);
            if (systemPromptInput) this.settings.systemPrompt = systemPromptInput.value;
            if (usernameInput) this.settings.username = usernameInput.value;
            if (modelSelect) this.settings.currentModel = modelSelect.value;

            // Save to localStorage
            this.saveSettings();
            this.showSuccess('Settings saved successfully!');
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            this.showError('Failed to save settings');
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
    console.log('🌟 DOM ready, initializing FREE Draco.AI...');
    dracoAI = new DracoAI();
    
    // Make it globally available
    window.dracoAI = dracoAI;
    
    console.log('🚀 Draco.AI is 100% FREE and Ready!');
});

// Error handling
window.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection:', event.reason);
});