# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled
- **Target**: ES5
- **Module**: ESNext
- **Path Alias**: `@/*` maps to `./src/*`
- **JSX**: Preserve (handled by Next.js)

## Naming Conventions
- **Files**: 
  - Components: PascalCase (e.g., `ChatInterface.tsx`)
  - Utilities: camelCase (e.g., `formatDate.ts`)
  - Types: camelCase or PascalCase (e.g., `index.ts`, `types.ts`)
- **Variables/Functions**: camelCase
- **Components**: PascalCase
- **Types/Interfaces**: PascalCase
- **Enums**: PascalCase
- **Constants**: UPPER_SNAKE_CASE

## File Structure
```
src/
├── app/              # Next.js 14 app directory (pages and layouts)
├── components/       # React components
│   ├── chat/        # Feature-specific components
│   ├── tree/        # Tree visualization components
│   └── ui/          # Shared UI components
├── lib/             # Core libraries and configurations
├── services/        # Business logic and API services
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## React/Next.js Patterns
- Use Server Components by default in Next.js 14
- Client Components marked with `'use client'` directive
- Functional components with hooks (no class components)
- Custom hooks for reusable logic

## Type Definitions
- All data models defined in `src/types/index.ts`
- Use TypeScript interfaces for object shapes
- Use type aliases for unions and primitives
- Strict null checking enabled

## CSS/Styling
- Tailwind CSS utility classes
- CSS variables for theming (defined in globals.css)
- Support for light/dark mode via CSS variables

## Import Order
1. React/Next.js imports
2. Third-party libraries
3. Local imports (using @/ alias)
4. Type imports

## Database/Supabase
- Row-level security (RLS) enabled on all tables
- UUID primary keys
- Timestamps with timezone (timestamptz)
- JSONB for flexible metadata fields