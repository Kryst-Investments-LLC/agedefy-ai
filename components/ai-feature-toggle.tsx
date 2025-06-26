'use client';

import { useState, useEffect } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getAIConfig, isFeatureEnabled, isProviderEnabled } from '@/lib/config/ai-config';

export function AIFeatureToggle() {
  const [config, setConfig] = useState(getAIConfig());
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development mode
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development' || config.development.debugMode);
  }, [config.development.debugMode]);

  if (!isVisible) {
    return null;
  }

  const toggleFeature = (feature: keyof typeof config.features) => {
    const newConfig = { ...config };
    newConfig.features[feature] = !newConfig.features[feature];
    setConfig(newConfig);
    
    // Update environment variable (this would need to be persisted in a real app)
    const envVar = `NEXT_PUBLIC_ENABLE_${feature.toUpperCase()}`;
    console.log(`Toggle ${feature}: ${newConfig.features[feature]}`);
    console.log(`Set ${envVar}=${newConfig.features[feature]}`);
  };

  const toggleProvider = (provider: keyof typeof config.providers) => {
    const newConfig = { ...config };
    newConfig.providers[provider].enabled = !newConfig.providers[provider].enabled;
    setConfig(newConfig);
    
    const envVar = `NEXT_PUBLIC_ENABLE_${provider.toUpperCase()}`;
    console.log(`Toggle ${provider}: ${newConfig.providers[provider].enabled}`);
    console.log(`Set ${envVar}=${newConfig.providers[provider].enabled}`);
  };

  const getStatusColor = (enabled: boolean) => enabled ? 'bg-green-500' : 'bg-gray-400';

  return (
    <Card className="w-full max-w-2xl mx-auto mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🤖 AI Features Configuration
          <Badge variant="outline" className="text-xs">
            Development Mode
          </Badge>
        </CardTitle>
        <CardDescription>
          Toggle AI features and providers for testing. Changes require environment variable updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Feature Toggles */}
        <div>
          <h3 className="font-semibold mb-3">AI Features</h3>
          <div className="space-y-3">
            {Object.entries(config.features).map(([feature, enabled]) => (
              <div key={feature} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(enabled)}`} />
                  <span className="font-medium capitalize">
                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleFeature(feature as keyof typeof config.features)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Provider Toggles */}
        <div>
          <h3 className="font-semibold mb-3">AI Providers</h3>
          <div className="space-y-3">
            {Object.entries(config.providers).map(([provider, settings]) => (
              <div key={provider} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(settings.enabled)}`} />
                  <div>
                    <span className="font-medium capitalize">{provider}</span>
                    <div className="text-sm text-gray-500">
                      {settings.apiKey ? 'API Key: ✓' : 'API Key: ✗'}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={() => toggleProvider(provider as keyof typeof config.providers)}
                  disabled={!settings.apiKey}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Scientific Data Toggles */}
        <div>
          <h3 className="font-semibold mb-3">Scientific Data Sources</h3>
          <div className="space-y-3">
            {Object.entries(config.scientificData).map(([source, enabled]) => (
              <div key={source} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(enabled)}`} />
                  <span className="font-medium capitalize">
                    {source === 'pubmed' ? 'PubMed' : 
                     source === 'clinicalTrials' ? 'Clinical Trials' : 
                     source === 'biomarkers' ? 'Biomarker Data' : source}
                  </span>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => {
                    const newConfig = { ...config };
                    newConfig.scientificData[source as keyof typeof config.scientificData] = !enabled;
                    setConfig(newConfig);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Development Settings */}
        <div>
          <h3 className="font-semibold mb-3">Development Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(config.development.useMockData)}`} />
                <span className="font-medium">Use Mock Data</span>
              </div>
              <Switch
                checked={config.development.useMockData}
                onCheckedChange={() => {
                  const newConfig = { ...config };
                  newConfig.development.useMockData = !newConfig.development.useMockData;
                  setConfig(newConfig);
                }}
              />
            </div>
          </div>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Note:</strong> These toggles are for development only. In production, 
            configure these settings using environment variables in your deployment platform.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const newConfig = getAIConfig();
              setConfig(newConfig);
            }}
          >
            Reset to Environment
          </Button>
          <Button
            onClick={() => {
              console.log('Current AI Configuration:', config);
            }}
          >
            Log Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 