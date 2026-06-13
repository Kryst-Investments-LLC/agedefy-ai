export interface AIConfig {
  features: {
    aiHealthCoach: boolean;
    researchAssistant: boolean;
    virtualAdvisor: boolean;
    predictiveAnalytics: boolean;
    dynamicRecommendations: boolean;
  };
  providers: {
    openai: {
      enabled: boolean;
      apiKey?: string;
      model: string;
    };
    grok: {
      enabled: boolean;
      apiKey?: string;
      model: string;
    };
    anthropic: {
      enabled: boolean;
      apiKey?: string;
      model: string;
    };
  };
  scientificData: {
    pubmed: boolean;
    clinicalTrials: boolean;
    biomarkers: boolean;
  };
  development: {
    useMockData: boolean;
    debugMode: boolean;
  };
}

export const getAIConfig = (): AIConfig => {
  return {
    features: {
      aiHealthCoach: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES === 'true',
      researchAssistant: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES === 'true',
      virtualAdvisor: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES === 'true',
      predictiveAnalytics: process.env.NEXT_PUBLIC_ENABLE_LIVE_ANALYTICS !== 'false',
      dynamicRecommendations: process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_RECOMMENDATIONS !== 'false',
    },
    providers: {
      openai: {
        enabled: process.env.NEXT_PUBLIC_ENABLE_CHATGPT === 'true',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
      },
      grok: {
        enabled: process.env.NEXT_PUBLIC_ENABLE_GROK === 'true',
        apiKey: process.env.GROK_API_KEY,
        model: 'grok-3',
      },
      anthropic: {
        enabled: process.env.NEXT_PUBLIC_ENABLE_ANTHROPIC === 'true',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-sonnet-4-6',
      },
    },
    scientificData: {
      pubmed: process.env.NEXT_PUBLIC_ENABLE_PUBMED_API === 'true',
      clinicalTrials: process.env.NEXT_PUBLIC_ENABLE_CLINICAL_TRIALS_API === 'true',
      biomarkers: process.env.NEXT_PUBLIC_ENABLE_BIOMARKER_API === 'true',
    },
    development: {
      useMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false',
      debugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
    },
  };
};

export const isFeatureEnabled = (feature: keyof AIConfig['features']): boolean => {
  const config = getAIConfig();
  return config.features[feature];
};

export const isProviderEnabled = (provider: keyof AIConfig['providers']): boolean => {
  const config = getAIConfig();
  return config.providers[provider].enabled;
}; 