"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building, 
  Users, 
  Shield, 
  Zap,
  BarChart3,
  Settings,
  Database,
  Cloud,
  Lock,
  Globe,
  Target,
  TrendingUp,
  Activity,
  CheckCircle,
  Star
} from 'lucide-react'

interface EnterpriseFeature {
  id: string
  name: string
  description: string
  category: 'analytics' | 'security' | 'integration' | 'compliance'
  icon: React.ReactNode
  included: boolean
}

interface PricingTier {
  id: string
  name: string
  price: number
  users: number
  features: string[]
  popular: boolean
}

export function EnterpriseSaaSPlatform() {
  const [selectedTier, setSelectedTier] = useState<string>('professional')
  const [viewMode, setViewMode] = useState<'overview' | 'features' | 'pricing' | 'demo'>('overview')

  const features = [
    {
      id: '1',
      name: 'Advanced Analytics Dashboard',
      description: 'Comprehensive analytics and reporting for enterprise clients',
      category: 'analytics',
      icon: <BarChart3 className="w-6 h-6" />,
      included: true
    },
    {
      id: '2',
      name: 'Multi-tenant Architecture',
      description: 'Secure, scalable multi-tenant platform for organizations',
      category: 'security',
      icon: <Building className="w-6 h-6" />,
      included: true
    },
    {
      id: '3',
      name: 'API Integration',
      description: 'RESTful APIs for seamless third-party integrations',
      category: 'integration',
      icon: <Zap className="w-6 h-6" />,
      included: true
    },
    {
      id: '4',
      name: 'HIPAA Compliance',
      description: 'Full HIPAA compliance for healthcare organizations',
      category: 'compliance',
      icon: <Shield className="w-6 h-6" />,
      included: true
    },
    {
      id: '5',
      name: 'Custom Branding',
      description: 'White-label solution with custom branding options',
      category: 'integration',
      icon: <Globe className="w-6 h-6" />,
      included: true
    },
    {
      id: '6',
      name: 'Advanced Security',
      description: 'Enterprise-grade security with encryption and access controls',
      category: 'security',
      icon: <Lock className="w-6 h-6" />,
      included: true
    }
  ]

  const pricingTiers = [
    {
      id: 'starter',
      name: 'Starter',
      price: 999,
      users: 50,
      features: [
        'Basic Analytics',
        'Standard Security',
        'Email Support',
        'API Access'
      ],
      popular: false
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 2499,
      users: 200,
      features: [
        'Advanced Analytics',
        'Multi-tenant Architecture',
        'Priority Support',
        'Custom Integrations',
        'White-label Options'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 4999,
      users: 1000,
      features: [
        'All Professional Features',
        'HIPAA Compliance',
        'Dedicated Support',
        'Custom Development',
        'On-premise Options',
        'SLA Guarantee'
      ],
      popular: false
    }
  ]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analytics': return 'bg-blue-100 text-blue-800'
      case 'security': return 'bg-green-100 text-green-800'
      case 'integration': return 'bg-purple-100 text-purple-800'
      case 'compliance': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = [
    { label: 'Enterprise Clients', value: '150+', icon: <Building className="w-6 h-6" /> },
    { label: 'Active Users', value: '50K+', icon: <Users className="w-6 h-6" /> },
    { label: 'Uptime', value: '99.9%', icon: <Activity className="w-6 h-6" /> },
    { label: 'Security Score', value: 'A+', icon: <Shield className="w-6 h-6" /> }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enterprise SaaS Platform</h1>
          <p className="text-gray-600 mt-1">Scalable longevity solutions for organizations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'overview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('overview')}
          >
            Overview
          </Button>
          <Button
            variant={viewMode === 'features' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('features')}
          >
            Features
          </Button>
          <Button
            variant={viewMode === 'pricing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('pricing')}
          >
            Pricing
          </Button>
          <Button
            variant={viewMode === 'demo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('demo')}
          >
            Demo
          </Button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-blue-600">
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Platform Benefits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Scalable Architecture</h4>
                      <p className="text-sm text-gray-600">Built to handle thousands of users with enterprise-grade performance</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Compliance Ready</h4>
                      <p className="text-sm text-gray-600">HIPAA, GDPR, and SOC 2 compliance for healthcare organizations</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Custom Integrations</h4>
                      <p className="text-sm text-gray-600">Seamless integration with existing enterprise systems</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  ROI Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Reduced Healthcare Costs</span>
                    <span className="font-semibold text-green-600">-25%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Employee Productivity</span>
                    <span className="font-semibold text-green-600">+30%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Implementation Time</span>
                    <span className="font-semibold text-blue-600">2-4 weeks</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Support Response</span>
                    <span className="font-semibold text-blue-600">&lt;2 hours</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {viewMode === 'features' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-blue-600">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.name}</h3>
                    <Badge className={getCategoryColor(feature.category)}>
                      {feature.category}
                    </Badge>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">{feature.description}</p>
                
                <div className="flex items-center gap-2">
                  {feature.included ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-gray-300 rounded" />
                  )}
                  <span className="text-sm">
                    {feature.included ? 'Included' : 'Available as add-on'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === 'pricing' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingTiers.map((tier) => (
            <Card 
              key={tier.id} 
              className={`relative hover:shadow-lg transition-shadow ${
                tier.popular ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
                  <div className="text-3xl font-bold mb-1">${tier.price}</div>
                  <div className="text-sm text-gray-600">per month</div>
                  <div className="text-sm text-gray-600 mt-2">Up to {tier.users} users</div>
                </div>
                
                <div className="space-y-3 mb-6">
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <Button 
                  className={`w-full ${tier.popular ? '' : 'variant-outline'}`}
                  onClick={() => setSelectedTier(tier.id)}
                >
                  {selectedTier === tier.id ? 'Selected' : 'Choose Plan'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === 'demo' && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Demo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Request Demo</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Schedule a personalized demo of our enterprise platform tailored to your organization's needs.
                  </p>
                  <Button className="w-full">
                    Schedule Demo
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Free Trial</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Start with a 30-day free trial to experience the full platform capabilities.
                  </p>
                  <Button variant="outline" className="w-full">
                    Start Free Trial
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Request Demo
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              View Documentation
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security Overview
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contact Sales
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 