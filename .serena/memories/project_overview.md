# Diverge Project Overview

## Purpose
Multi-Model Branching Chat Application that enables users to:
- Branch conversations at any node to create parallel conversation threads
- Select different LLMs per branch (GPT-4o, Claude-3, Gemini-Pro, etc.)
- Efficiently manage context with caching and cost controls
- Visualize conversation trees with React Flow

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5
- **Styling**: Tailwind CSS 3
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth
- **AI Models**: OpenAI, Anthropic, Google AI SDKs
- **State Management**: Zustand 4
- **Visualization**: React Flow 11
- **Forms**: React Hook Form 7
- **Validation**: Zod 3

## Current Phase
Phase 1: Foundation (Partially Complete)
- ✅ Database schema setup
- ✅ Project structure
- ⏳ Authentication implementation
- ⏳ Basic CRUD operations
- ⏳ Single model integration

## Key Features Planned
1. Tree-structured conversations with branching
2. Multi-model routing with fallback
3. Context reconstruction with caching
4. Visual tree view and branch comparison
5. Cost tracking and budget management
6. Row-level security

## Performance Targets
- P95 LLM latency: < 8000ms
- P95 context rebuild: < 500ms
- Max tree depth: 20 levels
- Cache TTL: 300 seconds