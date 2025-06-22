# Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Git

### Initial Setup
1. Clone the repository
2. Copy environment template: `cp .env.local.template .env.local`
3. Install dependencies: `pnpm install`
4. Start development server: `pnpm dev`

## Development Workflow

### Code Quality Standards
- **TypeScript**: Strict mode enabled with additional safety checks
- **ESLint**: Configured with Next.js and TypeScript rules
- **Formatting**: Use your preferred formatter (Prettier recommended)

### Before Committing
```bash
# Check for linting errors
pnpm lint

# Check TypeScript compilation
npx tsc --noEmit

# Run tests (if available)
pnpm test

# Build to verify production compatibility
pnpm build
```

### Environment Variables
- Use `.env.local` for local development (never commit this file)
- All AI features use mock data by default (`NEXT_PUBLIC_USE_MOCK_DATA=true`)
- Enable debug mode for detailed logging: `NEXT_PUBLIC_DEBUG_MODE=true`

## AI Features Development

### Mock Data vs Real APIs
- **Development**: Use mock data to avoid API costs
- **Testing**: Enable specific AI providers as needed
- **Production**: Disable mock data and configure real API keys

### Adding New AI Providers
1. Update `lib/config/ai-config.ts` with provider configuration
2. Create API route in `app/api/ai/[provider]/route.ts`
3. Add provider methods to `lib/services/ai-service.ts`
4. Update environment variables template
5. Add provider to documentation

### Cost Management During Development
- Keep `NEXT_PUBLIC_USE_MOCK_DATA=true` for most development
- Use real APIs only when testing specific integrations
- Monitor API usage in provider dashboards
- Set up billing alerts early

## Architecture Overview

### Key Directories
- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
- `lib/` - Utility functions, services, and configurations
- `hooks/` - Custom React hooks
- `styles/` - Global styles and Tailwind CSS
- `public/` - Static assets

### Configuration Files
- `next.config.mjs` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.json` - ESLint rules
- `tailwind.config.ts` - Tailwind CSS configuration
- `components.json` - shadcn/ui configuration

## Common Development Tasks

### Adding New Components
1. Create component in appropriate directory under `components/`
2. Use TypeScript for all props and state
3. Follow existing naming conventions
4. Add to component exports if reusable

### Working with AI Services
```typescript
import { aiService } from '@/lib/services/ai-service';

// Check if AI features are enabled
if (isFeatureEnabled('aiHealthCoach')) {
  const response = await aiService.getHealthRecommendation(data);
} else {
  // Use mock data
  const response = getMockHealthRecommendation(data);
}
```

### Environment-Specific Code
```typescript
// Client-side feature flags
if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES === 'true') {
  // AI features enabled
}

// Server-side API keys
const apiKey = process.env.OPENAI_API_KEY;
```

## Debugging

### Debug Mode
Enable debug mode to see detailed logs:
```bash
NEXT_PUBLIC_DEBUG_MODE=true
```

### Common Issues
1. **TypeScript Errors**: Check `tsconfig.json` and ensure strict mode compliance
2. **Build Failures**: Verify all environment variables are properly typed
3. **AI API Errors**: Check API keys and rate limits
4. **Styling Issues**: Verify Tailwind classes and component structure

### Development Tools
- **Next.js DevTools**: Built-in development features
- **React DevTools**: Browser extension for React debugging
- **TypeScript**: Language server for IDE integration

## Testing Strategy

### Unit Testing
- Test utility functions and services
- Mock AI API calls for consistent testing
- Focus on business logic and data transformations

### Integration Testing
- Test AI service integrations with mock responses
- Verify environment variable handling
- Test error handling and fallback mechanisms

### E2E Testing
- Test critical user flows
- Verify AI features work end-to-end
- Test with both mock and real data

## Performance Considerations

### Bundle Optimization
- Use dynamic imports for large components
- Optimize package imports (configured in `next.config.mjs`)
- Monitor bundle size with `pnpm build`

### AI API Optimization
- Implement response caching where appropriate
- Use appropriate model sizes for different use cases
- Implement request batching for bulk operations

## Security Best Practices

### API Key Management
- Never commit API keys to version control
- Use environment variables for all secrets
- Rotate keys regularly
- Monitor usage for unusual patterns

### Input Validation
- Validate all user inputs before processing
- Sanitize data before sending to AI APIs
- Implement rate limiting for user requests

### Error Handling
- Don't expose sensitive information in error messages
- Implement graceful fallbacks for AI service failures
- Log errors appropriately without exposing secrets

## Deployment

### Staging Environment
- Use separate API keys for staging
- Test with real AI APIs before production
- Verify all environment variables are configured

### Production Deployment
- Follow the Production Checklist
- Monitor costs and usage after deployment
- Set up alerts for errors and performance issues

## Contributing

### Code Style
- Follow existing patterns and conventions
- Use TypeScript for all new code
- Write meaningful commit messages
- Keep changes focused and atomic

### Pull Request Process
1. Create feature branch from main
2. Make changes with proper testing
3. Run all quality checks locally
4. Submit PR with clear description
5. Address review feedback promptly

---

For more detailed information, see:
- [AI Integration Guide](README-AI-INTEGRATION.md)
- [Security Policy](SECURITY.md)
- [Production Checklist](PRODUCTION-CHECKLIST.md)
