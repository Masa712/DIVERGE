# Diverge - Multi-Model Branching Chat Application

A production-ready chat application that enables users to branch conversations at any node, select different LLMs per branch (GPT-4o, Claude-3, Gemini-Pro, etc.), and efficiently manage context with proper cost controls and monitoring.

## Features

- 🌳 **Tree-structured conversations** - Branch from any node to create parallel conversation threads
- 🤖 **Multi-model support** - Switch between GPT-4o, Claude-3, Gemini-Pro per branch
- ⚡ **Smart caching** - Context reconstruction with intelligent caching for performance
- 📊 **Tree-first interface** - All conversations displayed as interactive tree visualization with React Flow
- 💰 **Cost control** - Token usage tracking and budget management
- 🔒 **Secure** - Row-level security with Supabase Auth

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **AI Models**: OpenAI, Anthropic, Google AI
- **Visualization**: React Flow
- **State Management**: Zustand

## Prerequisites

- Node.js 20 LTS or higher
- npm or yarn
- Supabase account
- API keys for OpenAI, Anthropic, and Google AI

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key
- `STRIPE_SECRET_KEY` - Required for billing, subscription management, およびアカウント削除処理
- `OPENAI_API_KEY` - Your OpenAI API key
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `GOOGLE_AI_API_KEY` - Your Google AI API key

> 本番反映前に、`SUPABASE_SERVICE_KEY` と `STRIPE_SECRET_KEY` がデプロイ環境でも設定されているかを確認し、アカウント削除フローが動作することを必ず検証してください。

### 3. Set up Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration script in your Supabase SQL editor:
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and run in the Supabase SQL editor

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
src/
├── app/              # Next.js 14 app directory
├── components/       # React components
│   ├── chat/        # Chat-related components
│   ├── tree/        # Tree visualization components
│   └── ui/          # Shared UI components
├── lib/             # Core libraries
│   ├── supabase/    # Supabase client configuration
│   └── llm/         # LLM integrations
├── services/        # Business logic and API services
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Implementation Phases

### Phase 1: Foundation (Current)
- ✅ Database schema setup
- ✅ Project structure
- ⏳ Authentication implementation
- ⏳ Basic CRUD operations
- ⏳ Single model integration

### Phase 2: Core Features
- Multi-model routing
- Context reconstruction logic
- Caching layer
- Streaming responses

### Phase 3: Visualization
- React Flow integration
- Tree navigation
- Branch comparison

### Phase 4: Polish
- Performance optimization
- Comprehensive testing
- Monitoring setup

## Security Considerations

- API keys are stored in environment variables
- Row-level security enabled on all database tables
- Prompt injection protection implemented
- All data encrypted at rest
- CSRF protection enabled

## License

Private - All rights reserved
