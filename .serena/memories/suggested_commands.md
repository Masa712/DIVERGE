# Suggested Commands for Diverge Development

## Development Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Git Commands (macOS/Darwin)
```bash
# Stage all changes
git add -A

# Create commit
git commit -m "commit message"

# Push to remote
git push origin main

# Check status
git status

# View diff
git diff

# Create new branch
git checkout -b feature/branch-name
```

## Project Setup
```bash
# Copy environment variables template
cp .env.local.example .env.local

# Run database migrations (in Supabase SQL editor)
# Copy contents of supabase/migrations/001_initial_schema.sql
```

## System Utilities (macOS/Darwin)
```bash
# List files
ls -la

# Find files
find . -name "*.tsx"

# Search in files (using ripgrep)
rg "searchterm"

# Navigate directories
cd src/

# View file contents
cat filename

# Create directory
mkdir -p src/new-folder
```

## Development Server
- Local URL: http://localhost:3000
- Default port: 3000