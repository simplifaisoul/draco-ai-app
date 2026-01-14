// Draco.AI - Advanced AI Chat Application
class DracoAI {
    constructor() {
        this.currentChatId = null;
        this.messages = [];
        this.settings = this.loadSettings();
        this.isTyping = false;
        
        // AI API configuration
        this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
        this.defaultModels = [
            'gpt-4',
            'gpt-4-turbo',
            'gpt-3.5-turbo',
            'claude-3-opus',
            'claude-3-sonnet',
            'gemini-pro',
            'llama-3.1-70b',
            'mistral-large'
        ];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadChatHistory();
        this.initMobileMenu();
        
        // Apply saved settings
        if (this.settings.apiKey) {
            document.getElementById('apiKeyInput').value = this.settings.apiKey;
        }
        if (this.settings.temperature) {
            document.getElementById('temperatureInput').value = this.settings.temperature;
        }
        if (this.settings.maxTokens) {
            document.getElementById('maxTokensInput').value = this.settings.maxTokens;
        }
        if (this.settings.systemPrompt) {
            document.getElementById('systemPromptInput').value = this.settings.systemPrompt;
        }
    }

    setupEventListeners() {
        // Message input handling
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('keypress', (e) => this.handleKeyPress(e));
        messageInput.addEventListener('input', (e) => this.autoResizeTextarea(e.target));

        // Send button
        document.getElementById('sendButton').addEventListener('click', () => this.sendMessage());

        // Model selector
        document.getElementById('modelSelect').addEventListener('change', (e) => {
            this.settings.currentModel = e.target.value;
            this.saveSettings();
        });
    }

    initMobileMenu() {
        // Add mobile menu toggle
        if (window.innerWidth <= 768) {
            const header = document.querySelector('.header-content');
            const menuBtn = document.createElement('button');
            menuBtn.className = 'input-btn';
            menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            menuBtn.onclick = () => this.toggleSidebar();
            header.insertBefore(menuBtn, header.firstChild);
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('draco_settings');
        return saved ? JSON.parse(saved) : {
            apiKey: '',
            temperature: 0.7,
            maxTokens: 1000,
            systemPrompt: 'You are Draco.AI, an advanced AI assistant. You are helpful, knowledgeable, and engaging. Provide accurate, thoughtful responses with a touch of creativity when appropriate.',
            currentModel: 'gpt-3.5-turbo'
        };
    }

    saveSettings() {
        localStorage.setItem('draco_settings', JSON.stringify(this.settings));
    }

    loadChatHistory() {
        const saved = localStorage.getItem('draco_chats');
        if (saved) {
            this.chats = JSON.parse(saved);
            this.renderChatList();
        }
    }

    saveChatHistory() {
        localStorage.setItem('draco_chats', JSON.stringify(this.chats));
    }

    startNewChat() {
        this.currentChatId = Date.now().toString();
        this.messages = [];
        this.chats.unshift({
            id: this.currentChatId,
            title: 'New Chat',
            messages: [],
            timestamp: new Date().toISOString()
        });
        this.renderChatList();
        this.renderMessages();
        this.saveChatHistory();
    }

    renderChatList() {
        const chatList = document.getElementById('chatList');
        chatList.innerHTML = '';
        
        this.chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.innerHTML = `
                <div class="chat-title">${chat.title}</div>
                <div class="chat-time">${new Date(chat.timestamp).toLocaleString()}</div>
            `;
            chatItem.onclick = () => this.loadChat(chat.id);
            chatList.appendChild(chatItem);
        });
    }

    loadChat(chatId) {
        this.currentChatId = chatId;
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            this.messages = chat.messages;
            this.renderMessages();
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '';
        
        this.messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.role}`;
            messageDiv.innerHTML = `
                <div class="message-content">${this.markdownToHtml(message.content)}</div>
                <div class="message-time">${new Date(message.timestamp).toLocaleString()}</div>
            `;
            messagesContainer.appendChild(messageDiv);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        messageInput.value = '';
        this.renderMessages();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await this.callAI(message);
            this.hideTypingIndicator();
            
            // Add AI response
            this.messages.push({
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            });
            
            this.renderMessages();
            this.saveChatHistory();
            
        } catch (error) {
            this.hideTypingIndicator();
            this.showError(error.message);
        }
    }

    async callAI(message) {
        const response = await fetch(this.apiEndpoint, {
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
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message assistant typing';
        indicator.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        document.getElementById('chatMessages').appendChild(indicator);
        indicator.scrollIntoView();
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing');
        if (indicator) {
            indicator.remove();
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    markdownToHtml(text) {
        // Simple markdown to HTML conversion
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    exportChat() {
        const chatData = {
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
    }

    clearChat() {
        if (confirm('Are you sure you want to clear this chat?')) {
            this.messages = [];
            this.renderMessages();
            this.saveChatHistory();
        }
    }

    initModelSelector() {
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = '';
        
        this.defaultModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            if (model === this.settings.currentModel) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });
    }

    updateSettings() {
        this.settings.apiKey = document.getElementById('apiKeyInput').value;
        this.settings.temperature = parseFloat(document.getElementById('temperatureInput').value);
        this.settings.maxTokens = parseInt(document.getElementById('maxTokensInput').value);
        this.settings.systemPrompt = document.getElementById('systemPromptInput').value;
        this.saveSettings();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const dracoAI = new DracoAI();
    
    // Global functions for button onclick handlers
    window.dracoAI = dracoAI;
    window.startNewChat = () => dracoAI.startNewChat();
    window.exportChat = () => dracoAI.exportChat();
    window.clearChat = () => dracoAI.clearChat();
    window.updateSettings = () => dracoAI.updateSettings();
});