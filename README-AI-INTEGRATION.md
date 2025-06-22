# AI Integration Guide for AgeDefy AI

This guide explains how to set up and use the AI features in your AgeDefy AI platform.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env.local` file in your project root with the following variables:

```bash
# AI Features Configuration
NEXT_PUBLIC_ENABLE_AI_FEATURES=false
NEXT_PUBLIC_ENABLE_CHATGPT=false
NEXT_PUBLIC_ENABLE_GROK=false
NEXT_PUBLIC_ENABLE_ANTHROPIC=false

# API Keys (get these from respective providers)
OPENAI_API_KEY=your_openai_api_key_here
GROK_API_KEY=your_grok_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Scientific Data APIs
NEXT_PUBLIC_ENABLE_PUBMED_API=false
NEXT_PUBLIC_ENABLE_CLINICAL_TRIALS_API=false
NEXT_PUBLIC_ENABLE_BIOMARKER_API=false

# Feature Flags
NEXT_PUBLIC_ENABLE_REAL_TIME_DATA=false
NEXT_PUBLIC_ENABLE_LIVE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DYNAMIC_RECOMMENDATIONS=false

# Development Settings
NEXT_PUBLIC_USE_MOCK_DATA=true
NEXT_PUBLIC_DEBUG_MODE=false
```

### 2. Enable AI Features

To enable AI features, set the environment variables to `true`:

```bash
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_CHATGPT=true
```

### 3. Get API Keys

#### OpenAI (ChatGPT)
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account and add billing information
3. Generate an API key
4. Add to your `.env.local`: `OPENAI_API_KEY=sk-...`

#### Grok (X.AI)
1. Go to [X.AI Platform](https://x.ai/)
2. Sign up for Grok access
3. Generate an API key
4. Add to your `.env.local`: `GROK_API_KEY=...`

#### Anthropic (Claude)
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an account and add billing
3. Generate an API key
4. Add to your `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`

## 🔧 Configuration

### AI Configuration System

The platform uses a centralized configuration system in `lib/config/ai-config.ts`:

```typescript
import { getAIConfig, isFeatureEnabled } from '@/lib/config/ai-config';

// Check if a feature is enabled
if (isFeatureEnabled('aiHealthCoach')) {
  // Use real AI
} else {
  // Use mock data
}
```

### Feature Flags

- **`aiHealthCoach`**: AI-powered health recommendations
- **`researchAssistant`**: Research paper analysis and summaries
- **`virtualAdvisor`**: Personalized longevity advice
- **`predictiveAnalytics`**: Real-time health predictions
- **`realTimeData`**: Live scientific data integration
- **`dynamicRecommendations`**: Adaptive recommendations

## 💰 Cost Management

### Estimated Monthly Costs

| Provider | Model | Cost per 1K tokens | Monthly Estimate* |
|----------|-------|-------------------|-------------------|
| OpenAI | GPT-4 Turbo | $0.01-0.03 | $50-200 |
| Grok | Grok Beta | $0.01-0.02 | $30-150 |
| Anthropic | Claude 3 | $0.003-0.015 | $20-100 |

*Based on 1000 requests/day with average 500 tokens per request

### Cost Optimization Tips

1. **Start with Mock Data**: Use `NEXT_PUBLIC_USE_MOCK_DATA=true` during development
2. **Implement Caching**: Cache AI responses to reduce API calls
3. **Rate Limiting**: Limit user requests to prevent abuse
4. **Token Optimization**: Use shorter prompts and limit response length

## 🛠️ Development

### Testing AI Features

1. **Development Mode**: The AI feature toggle component is only visible in development
2. **Mock Data**: When AI is disabled, the platform uses sophisticated mock data
3. **Error Handling**: All AI calls have fallback to mock data

### Adding New AI Providers

1. Add provider configuration to `ai-config.ts`
2. Create API route in `app/api/ai/[provider]/route.ts`
3. Add provider methods to `ai-service.ts`
4. Update environment variables

### Example: Adding a New Provider

```typescript
// In ai-config.ts
providers: {
  newProvider: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_NEW_PROVIDER === 'true',
    apiKey: process.env.NEW_PROVIDER_API_KEY,
    model: 'new-model',
  },
}

// In ai-service.ts
private async callNewProvider(query: ResearchQuery): Promise<AIResponse> {
  const response = await fetch('/api/ai/new-provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  // ... implementation
}
```

## 🚀 Production Deployment

### Environment Variables

Set these in your deployment platform (Vercel, Netlify, etc.):

```bash
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_CHATGPT=true
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_DEBUG_MODE=false
```

### Security Considerations

1. **API Key Security**: Never expose API keys in client-side code
2. **Rate Limiting**: Implement rate limiting on API routes
3. **Input Validation**: Validate all user inputs before sending to AI APIs
4. **Error Handling**: Graceful fallback to mock data on API failures

### Monitoring

1. **API Usage**: Monitor token usage and costs
2. **Error Rates**: Track API failure rates
3. **Response Times**: Monitor AI response latency
4. **User Feedback**: Collect feedback on AI response quality

## 📊 Usage Examples

### Health Recommendations

```typescript
import { aiService } from '@/lib/services/ai-service';

const recommendation = await aiService.getHealthRecommendation({
  age: 35,
  biomarkers: { glucose: 95, hba1c: 5.2 },
  lifestyle: { exercise: 'moderate', sleep: 7 },
});
```

### Research Queries

```typescript
const research = await aiService.researchQuery({
  query: "What are the latest findings on NAD+ precursors for longevity?",
  maxResults: 3,
});
```

### Virtual Advisor

```typescript
const advice = await aiService.getVirtualAdvisorResponse(
  "Should I start taking metformin for longevity?",
  { age: 40, healthHistory: ['prediabetes'] }
);
```

## 🔍 Troubleshooting

### Common Issues

1. **API Key Errors**: Check that API keys are correctly set in environment variables
2. **Rate Limits**: Implement exponential backoff for rate limit errors
3. **Cost Overruns**: Set up billing alerts and usage limits
4. **Response Quality**: Adjust prompts and temperature settings

### Debug Mode

Enable debug mode to see detailed logs:

```bash
NEXT_PUBLIC_DEBUG_MODE=true
```

This will show the AI configuration toggle in the UI and log detailed information about AI calls.

## 📈 Scaling Considerations

### High Traffic

1. **Caching**: Implement Redis or similar for response caching
2. **Queue System**: Use message queues for high-volume AI requests
3. **Load Balancing**: Distribute requests across multiple API keys
4. **CDN**: Cache static AI responses

### Cost Control

1. **Usage Limits**: Set daily/monthly usage limits per user
2. **Premium Tiers**: Offer different AI access levels
3. **Token Budgeting**: Allocate token budgets per user/request
4. **Fallback Strategy**: Graceful degradation to simpler models

## 🎯 Best Practices

1. **Start Small**: Begin with one AI provider and expand gradually
2. **Monitor Costs**: Set up alerts for unexpected cost spikes
3. **User Experience**: Ensure fast response times and good UX
4. **Content Quality**: Regularly review and improve AI prompts
5. **Compliance**: Ensure AI responses comply with health regulations

## 📞 Support

For issues with AI integration:

1. Check the browser console for error messages
2. Verify environment variables are set correctly
3. Test API keys directly with the provider
4. Review the AI service logs in development mode

---

**Remember**: The platform works perfectly with mock data, so you can launch without AI features and add them later when you're ready! 