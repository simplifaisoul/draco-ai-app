// Draco.AI - Revolutionary AI Chat Application
class DracoAI {
    constructor() {
        this.currentChatId = null;
        this.messages = [];
        this.chats = [];
        this.settings = this.loadSettings();
        this.isTyping = false;
        
        // Available AI models
        this.availableModels = {
            'gpt-3.5-turbo': {
                name: 'GPT-3.5 Turbo',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                requiresKey: true
            },
            'gpt-4': {
                name: 'GPT-4',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                requiresKey: true
            },
            'gpt-4-turbo': {
                name: 'GPT-4 Turbo',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                requiresKey: true
            },
            'claude-3-opus': {
                name: 'Claude 3 Opus',
                endpoint: 'https://api.anthropic.com/v1/messages',
                requiresKey: true
            },
            'claude-3-sonnet': {
                name: 'Claude 3 Sonnet',
                endpoint: 'https://api.anthropic.com/v1/messages',
                requiresKey: true
            },
            'gemini-pro': {
                name: 'Gemini Pro',
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
                requiresKey: true
            },
            'llama-3.1-70b': {
                name: 'Llama 3.1 70B',
                endpoint: 'https://router.huggingface.co/v1/chat/completions',
                requiresKey: false,
                demoMode: true
            },
            'mistral-large': {
                name: 'Mistral Large',
                endpoint: 'https://api.mistral.ai/v1/chat/completions',
                requiresKey: true
            }
        };
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Draco.AI...');
        
        try {
            this.setupEventListeners();
            this.loadChatHistory();
            this.applySettings();
            this.initModelSelector();
            this.checkResponsiveMode();
            
            console.log('✅ Draco.AI initialized successfully');
            this.showSuccess('Draco.AI ready! Start a new conversation.');
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
                    this.settings.currentModel = e.target.value;
                    this.saveSettings();
                    this.showSuccess('Model updated successfully');
                });
            }

            // Temperature slider
            const temperatureInput = document.getElementById('temperatureInput');
            if (temperatureInput) {
                temperatureInput.addEventListener('input', (e) => {
                    const value = e.target.value;
                    document.getElementById('temperatureValue').textContent = value;
                    this.settings.temperature = parseFloat(value);
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
            
            Object.entries(this.availableModels).forEach(([key, model]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = model.name;
                if (key === this.settings.currentModel) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });

            console.log('✅ Model selector initialized');
        } catch (error) {
            console.error('❌ Error initializing model selector:', error);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('draco_settings');
            const defaultSettings = {
                apiKey: '',
                temperature: 0.7,
                maxTokens: 1000,
                systemPrompt: 'You are Draco.AI, an advanced AI assistant. You are helpful, knowledgeable, and engaging. Provide accurate, thoughtful responses with a touch of creativity when appropriate.',
                currentModel: 'gpt-3.5-turbo'
            };
            
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            return {
                apiKey: '',
                temperature: 0.7,
                maxTokens: 1000,
                systemPrompt: 'You are Draco.AI, an advanced AI assistant. You are helpful, knowledgeable, and engaging. Provide accurate, thoughtful responses with a touch of creativity when appropriate.',
                currentModel: 'gpt-3.5-turbo'
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
            // Apply API key
            const apiKeyInput = document.getElementById('apiKeyInput');
            if (apiKeyInput && this.settings.apiKey) {
                apiKeyInput.value = this.settings.apiKey;
            }

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

            // Apply current model
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.value = this.settings.currentModel;
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
                model: this.settings.currentModel
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
            
            this.showSuccess('New chat started');
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
                this.showError('Please wait for the AI to respond');
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
        const model = this.availableModels[this.settings.currentModel];
        
        if (!model) {
            throw new Error('Selected model not available');
        }

        // Demo mode for models without API keys
        if (model.demoMode && !this.settings.apiKey) {
            return this.getDemoResponse(message);
        }

        if (model.requiresKey && !this.settings.apiKey) {
            throw new Error('API key required for this model. Please add your API key in settings.');
        }

        try {
            let response;
            
            if (this.settings.currentModel.includes('gpt')) {
                response = await this.callOpenAI(message, model);
            } else if (this.settings.currentModel.includes('claude')) {
                response = await this.callClaude(message, model);
            } else if (this.settings.currentModel.includes('gemini')) {
                response = await this.callGemini(message, model);
            } else if (this.settings.currentModel.includes('mistral')) {
                response = await this.callMistral(message, model);
            } else {
                response = await this.callOpenAICompatible(message, model);
            }
            
            return response;
        } catch (error) {
            console.error('❌ AI API call failed:', error);
            
            if (error.message.includes('API key')) {
                throw new Error('Invalid API key. Please check your settings.');
            } else if (error.message.includes('quota')) {
                throw new Error('API quota exceeded. Please check your plan.');
            } else {
                throw new Error(`API Error: ${error.message}`);
            }
        }
    }

    async callOpenAI(message, model) {
        const response = await fetch(model.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify({
                model: this.settings.currentModel,
                messages: [
                    { role: 'system', content: this.settings.systemPrompt },
                    ...this.messages
                ],
                temperature: this.settings.temperature,
                max_tokens: this.settings.maxTokens
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callClaude(message, model) {
        const response = await fetch(model.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.settings.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.settings.currentModel.replace('claude-', 'claude-3-'),
                max_tokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
                system: this.settings.systemPrompt,
                messages: this.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.content[0].text;
    }

    async callGemini(message, model) {
        const response = await fetch(`${model.endpoint}?key=${this.settings.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${this.settings.systemPrompt}\n\n${this.messages.map(m => `${m.role}: ${m.content}`).join('\n')}`
                    }]
                }],
                generationConfig: {
                    temperature: this.settings.temperature,
                    maxOutputTokens: this.settings.maxTokens
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async callMistral(message, model) {
        const response = await fetch(model.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify({
                model: this.settings.currentModel,
                messages: [
                    { role: 'system', content: this.settings.systemPrompt },
                    ...this.messages
                ],
                temperature: this.settings.temperature,
                max_tokens: this.settings.maxTokens
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callOpenAICompatible(message, model) {
        const response = await fetch(model.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.settings.apiKey ? `Bearer ${this.settings.apiKey}` : undefined
            },
            body: JSON.stringify({
                model: this.settings.currentModel,
                messages: [
                    { role: 'system', content: this.settings.systemPrompt },
                    ...this.messages
                ],
                temperature: this.settings.temperature,
                max_tokens: this.settings.maxTokens
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    getDemoResponse(message) {
        const responses = [
            "As Draco.AI, I'm here to help you with your questions and tasks. While I'm in demo mode, I can still provide useful insights and assistance!",
            "That's an interesting question! I'd be happy to help you explore that topic further when you connect an API key.",
            "I understand you're looking for assistance. To get full AI responses, please add your API key in the settings panel.",
            "Great question! With a proper API key configured, I can provide detailed, intelligent responses to your queries.",
            "I'm Draco.AI, your advanced AI assistant. To unlock my full capabilities, please configure your API settings."
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
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
                title: `Chat ${new Date().toLocaleDateString()}`,
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
            
            this.showSuccess('Chat exported successfully');
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
                this.showSuccess('Chat cleared');
            }
        } catch (error) {
            console.error('❌ Error clearing chat:', error);
            this.showError('Failed to clear chat');
        }
    }

    saveSettings() {
        try {
            // Get values from form
            const apiKeyInput = document.getElementById('apiKeyInput');
            const temperatureInput = document.getElementById('temperatureInput');
            const maxTokensInput = document.getElementById('maxTokensInput');
            const systemPromptInput = document.getElementById('systemPromptInput');
            const modelSelect = document.getElementById('modelSelect');

            // Update settings
            if (apiKeyInput) this.settings.apiKey = apiKeyInput.value;
            if (temperatureInput) this.settings.temperature = parseFloat(temperatureInput.value);
            if (maxTokensInput) this.settings.maxTokens = parseInt(maxTokensInput.value);
            if (systemPromptInput) this.settings.systemPrompt = systemPromptInput.value;
            if (modelSelect) this.settings.currentModel = modelSelect.value;

            // Save to localStorage
            this.saveSettings();
            this.showSuccess('Settings saved successfully');
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
    console.log('🌟 DOM ready, initializing Draco.AI...');
    dracoAI = new DracoAI();
    
    // Make it globally available
    window.dracoAI = dracoAI;
    
    console.log('🚀 Draco.AI is ready!');
});

// Error handling
window.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection:', event.reason);
});