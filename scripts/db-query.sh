#!/bin/bash
# Supabase database query helper script
# Usage: ./scripts/db-query.sh "SELECT * FROM usage_quotas LIMIT 5;"

set -e

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Get Supabase project reference from URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/https:\/\/\(.*\)\.supabase\.co/\1/')

echo "🔍 Connecting to Supabase project: $PROJECT_REF"
echo "📊 Executing query..."
echo ""

# Check if query is provided
if [ -z "$1" ]; then
  echo "❌ Error: No query provided"
  echo "Usage: ./scripts/db-query.sh \"YOUR SQL QUERY\""
  exit 1
fi

# Execute query using Supabase CLI
supabase db query "$1" --project-ref "$PROJECT_REF" --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"

echo ""
echo "✅ Query completed"
