# Draco AI 2.0 🐉

> Next-Generation AI Assistant. Free, Instant, Powerful.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed)](https://www.docker.com/)

Draco AI is a premium, open-source AI chat interface powered by **Next.js**, **FastAPI**, and free AI models (Pollinations.ai).

## 🏗️ Architecture

The project is structured as a modern monorepo:

-   **`frontend/`**: Next.js 14 application (React, TypeScript, Tailwind CSS).
-   **`backend/`**: Python FastAPI service for orchestration.
-   **`infra/`**: Dockerfiles and Kubernetes manifests.
-   **`legacy_vanilla/`**: The original HTML/JS prototype.

## 🚀 Getting Started

### Frontend (Development)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Backend (Development)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Docker Deployment

```bash
docker build -f infra/frontend.dockerfile -t draco-frontend .
docker build -f infra/backend.dockerfile -t draco-backend .
```

## 🌟 Features

-   **Multi-Model Support**: GPT-4o, Claude 3.5, Mistral, Llama 3.1.
-   **"Neon Dragon" Theme**: Premium dark mode UI.
-   **Instant Responses**: No API keys required.
-   **Privacy Focused**: Direct client-side calls (optional backend proxy).

## License

MIT