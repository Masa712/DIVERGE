# Project Structure Details

## Root Directory
```
/
├── .claudecode/          # Claude Code configuration and prompts
├── .serena/             # Serena project configuration
├── docs/                # Project documentation
│   ├── API.md          # API documentation
│   ├── ARCHITECTURE.md # Architecture decisions
│   └── ROADMAP.md      # Development roadmap
├── src/                 # Source code
├── supabase/           # Database migrations and configs
│   └── migrations/     # SQL migration files
├── .env.local.example  # Environment variables template
├── .gitignore          # Git ignore rules
├── CLAUDE.md           # Claude Code instructions
├── README.md           # Project overview
├── next.config.js      # Next.js configuration
├── package.json        # Dependencies and scripts
├── postcss.config.js   # PostCSS configuration
├── tailwind.config.ts  # Tailwind CSS configuration
└── tsconfig.json       # TypeScript configuration
```

## Source Code Structure (src/)
```
src/
├── app/                 # Next.js 14 App Router
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── components/         # React components (to be created)
│   ├── chat/          # Chat-related components
│   ├── tree/          # Tree visualization
│   └── ui/            # Shared UI components
├── lib/                # Core libraries
│   ├── supabase/      # Supabase clients
│   │   ├── client.ts  # Client-side Supabase
│   │   └── server.ts  # Server-side Supabase
│   └── llm/           # LLM integrations (to be created)
├── services/          # Business logic (to be created)
├── hooks/             # Custom React hooks (to be created)
├── types/             # TypeScript definitions
│   └── index.ts       # Main type definitions
└── utils/             # Utility functions (to be created)
```

## Key Files

### Configuration Files
- `next.config.js`: Next.js settings, experimental features
- `tsconfig.json`: TypeScript strict mode, path aliases
- `tailwind.config.ts`: Custom theme, colors, spacing
- `package.json`: Scripts and dependencies

### Type Definitions (`src/types/index.ts`)
- `ChatNode`: Main conversation node type
- `Session`: User session management
- `ModelId`: Supported LLM models
- `NodeStatus`: Node states (pending, streaming, completed, etc.)
- `UsageLog`: Token and cost tracking
- `ContextCache`: Cache management

### Database Schema (`supabase/migrations/001_initial_schema.sql`)
- Tables: sessions, chat_nodes, usage_logs, context_cache, user_quotas
- Row-level security policies
- Indexes for performance
- Triggers for updated_at timestamps

## Environment Variables Required
- Supabase: URL, anon key, service key
- LLM APIs: OpenAI, Anthropic, Google AI keys
- Monitoring: Sentry DSN (optional)
- Rate limiting: Redis URL (optional)