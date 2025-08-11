# Task Completion Checklist

When completing a development task in the Diverge project, ensure the following:

## Before Committing Code

### 1. Type Checking
```bash
npm run typecheck
```
- Ensure no TypeScript errors
- All types properly defined
- No use of `any` without justification

### 2. Linting
```bash
npm run lint
```
- Fix all linting errors
- Follow ESLint rules
- Ensure consistent code style

### 3. Manual Testing
```bash
npm run dev
```
- Test the feature locally
- Verify UI renders correctly
- Check console for errors
- Test responsive design

### 4. Build Verification
```bash
npm run build
```
- Ensure production build succeeds
- No build-time errors
- Check bundle size if adding new dependencies

## Code Review Checklist

- [ ] TypeScript types are properly defined
- [ ] No hardcoded values (use constants/env vars)
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Accessibility considered (ARIA labels, keyboard navigation)
- [ ] Security: No exposed secrets/keys
- [ ] Performance: No unnecessary re-renders
- [ ] Database queries optimized with proper indexes
- [ ] RLS policies maintained for new tables

## Documentation Updates

- [ ] Update README.md if adding new features
- [ ] Document new environment variables in .env.local.example
- [ ] Add JSDoc comments for complex functions
- [ ] Update CLAUDE.md if project structure changes

## Git Commit

- [ ] Meaningful commit message
- [ ] Reference issue/ticket if applicable
- [ ] Squash commits if needed for clarity
- [ ] Ensure .gitignore excludes sensitive files