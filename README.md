# 🐉 Draco AI V0.4

**Advanced Agentic AI with Multi-Model Support**  
Created by SimplifAI-1 | Powered by Pollinations

---

## 🌟 What's New in V0.4

### 🎨 UI/UX Enhancements
- **Glassmorphism 2.0**: Enhanced transparency and blur effects throughout the interface
- **Premium Typography**: Refined font hierarchy for better readability
- **Animated Gradients**: Dynamic color transitions in hero section
- **Status Indicators**: Visual cues for AI thinking vs. acting states

### 🤖 Multi-Model System
Draco now features **7 specialized AI personas**:
- 🐲 **Draco Prime** - Balanced & versatile assistant
- 👩‍💻 **Expert Coder** - Technical architecture specialist
- 📞 **Draco Caller** - Bland.ai phone automation
- 🕷️ **Draco Scraper** - Apify data extraction
- 🔥 **Roast Master** - Savage & funny responses
- 🎓 **ELI5 Tutor** - Explain like I'm 5
- 📜 **The Bard** - Poetic & dramatic storytelling

### 🔧 System Improvements
- **Identity Unification**: Fixed conflicting system prompts
- **Draco Caller Restoration**: Restored Bland.ai API integration
- **Context Window Optimization**: Sliding window (20 messages) prevents overflow
- **Waitlist Integration**: Beta access system with EmailJS

### 📧 Growth Features
- **Agent Mode Waitlist**: Locked feature to drive user engagement
- **Email Template System**: Automated waitlist confirmation emails
- **Scarcity Mechanics**: "Limited Availability" messaging

---

## 🏗️ Architecture

**Tech Stack**: Next.js 14, React 19, TypeScript, Tailwind CSS 4  
**Mobile Optimized** | **Glassmorphic UI** | **Real-time Streaming**

### Project Structure
```
draco-ai-app/
├── app/
│   ├── api/chat/          # Chat API routes
│   ├── components/        # React components
│   ├── lib/              # Utilities & providers
│   └── page.tsx          # Main application
├── public/               # Static assets
└── legacy_vanilla/       # Original prototype (archived)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎯 Features

### Core Capabilities
- ✅ **Image Generation**: DALL-E 3 grade art via `/image` command
- ✅ **Web Fetching**: Real-time content retrieval via `/webfetch`
- ✅ **API Protocol**: Universal HTTP client for external APIs
- ✅ **News Lookup**: Live RSS feed integration
- ✅ **Voice Interface**: Speech-to-text and text-to-speech
- ✅ **Code Execution**: Syntax highlighting with copy-to-clipboard

### Advanced Features
- 🔄 **Streaming Responses**: Real-time token streaming
- 💾 **Session Persistence**: Local conversation history
- 🎨 **Theme System**: Dynamic color schemes
- 📱 **Mobile Responsive**: Touch-optimized interface
- 🔒 **Safety Protocols**: API key validation for specialized models

---

## 📝 Changelog

### V0.4 (January 2026)
- Added 7 specialized AI models with unique capabilities
- Implemented glassmorphism UI overhaul
- Restored Draco Caller (Bland.ai integration)
- Fixed identity prompt conflicts (SimplifAI-1)
- Added waitlist system with EmailJS
- Optimized context window (sliding window)
- Updated branding to V0.4 across all surfaces

### V0.3 (Previous)
- Glassmorphic UI foundation
- Multi-provider support (Groq, Pollinations)
- Voice interface implementation
- Dashboard analytics

### V0.2
- Next.js 14 migration
- TypeScript conversion
- Mobile optimization

---

## 🔑 API Configuration

### Required for Specialized Models

**Draco Caller** (Bland.ai):
- Requires Bland.ai API key
- Format: `authorization: sk_...`

**Draco Scraper** (Apify):
- Requires Apify API token
- Format: `token=apify_api_...`

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## 📄 License

MIT License - Created by SimplifAI-1

---

## 🔗 Links

- **Live Demo**: [dracoai.app](https://dracoai.app)
- **Documentation**: Coming soon
- **Support**: soulsimplifai@gmail.com

---

## 🙏 Acknowledgments

- **Pollinations AI** - Image generation & LLM inference
- **Groq** - High-speed LLM inference
- **Bland.ai** - Phone automation API
- **Apify** - Web scraping infrastructure
- **EmailJS** - Waitlist email automation

---

**Built with ❤️ by SimplifAI-1**
