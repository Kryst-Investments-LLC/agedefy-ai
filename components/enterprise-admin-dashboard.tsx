'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Building,
  TrendingUp,
  DollarSign,
  Settings,
  Shield,
  BarChart3,
  UserPlus,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Activity,
  Calendar,
  Download,
  Filter,
  Search,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  plan: string;
  users: number;
  maxUsers: number;
  status: 'active' | 'trial' | 'suspended';
  monthlyRevenue: number;
  healthScore: number;
  lastActivity: string;
}

interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  churnRate: number;
}

const mockOrganizations: Organization[] = [
  {
    id: '1',
    name: 'Longevity Clinic SF',
    plan: 'Professional',
    users: 45,
    maxUsers: 50,
    status: 'active',
    monthlyRevenue: 7450,
    healthScore: 8.7,
    lastActivity: '2 hours ago',
  },
  {
    id: '2',
    name: 'Stanford Research Lab',
    plan: 'Enterprise',
    users: 120,
    maxUsers: 200,
    status: 'active',
    monthlyRevenue: 24000,
    healthScore: 9.2,
    lastActivity: '15 minutes ago',
  },
  {
    id: '3',
    name: 'BioTech Innovations',
    plan: 'Professional',
    users: 28,
    maxUsers: 50,
    status: 'trial',
    monthlyRevenue: 0,
    healthScore: 7.8,
    lastActivity: '1 day ago',
  },
];

const mockMetrics: UserMetrics = {
  totalUsers: 1247,
  activeUsers: 892,
  newUsers: 156,
  churnRate: 3.2,
};

export function EnterpriseAdminDashboard() {
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-600/20 text-green-300 border-green-500/20';
      case 'trial':
        return 'bg-blue-600/20 text-blue-300 border-blue-500/20';
      case 'suspended':
        return 'bg-red-600/20 text-red-300 border-red-500/20';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/20';
    }
  };

  const filteredOrganizations = mockOrganizations.filter((org) => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || org.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalRevenue = mockOrganizations.reduce((sum, org) => sum + org.monthlyRevenue, 0);
  const averageHealthScore = mockOrganizations.reduce((sum, org) => sum + org.healthScore, 0) / mockOrganizations.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Enterprise Admin Dashboard</h1>
        <p className="text-gray-400">Manage organizations, users, and enterprise features</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Organizations</p>
                <p className="text-2xl font-bold text-white">{mockOrganizations.length}</p>
              </div>
              <Building className="h-8 w-8 text-teal-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{mockMetrics.totalUsers}</p>
                <p className="text-green-400 text-xs">+{mockMetrics.newUsers} this month</p>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Monthly Revenue</p>
                <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
                <p className="text-green-400 text-xs">+12% from last month</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Health Score</p>
                <p className="text-2xl font-bold text-white">{averageHealthScore.toFixed(1)}</p>
                <p className="text-teal-400 text-xs">Across all orgs</p>
              </div>
              <Activity className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-white">Organizations</CardTitle>
                  <CardDescription>Manage enterprise clients and their subscriptions</CardDescription>
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Organization
                </Button>
              </div>
              
              <div className="flex gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search organizations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredOrganizations.map((org) => (
                  <div
                    key={org.id}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedOrg === org.id
                        ? 'border-teal-500 bg-teal-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => setSelectedOrg(org.id)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg">{org.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(org.status)}>
                            {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="border-purple-500 text-purple-300">
                            {org.plan}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">${org.monthlyRevenue.toLocaleString()}/mo</p>
                        <p className="text-gray-400 text-sm">Health Score: {org.healthScore}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-gray-400 text-sm">Users</p>
                        <div className="flex items-center gap-2">
                          <Progress value={(org.users / org.maxUsers) * 100} className="flex-1" />
                          <span className="text-white text-sm">{org.users}/{org.maxUsers}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Last Activity</p>
                        <p className="text-white text-sm">{org.lastActivity}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                        <Settings className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Analytics
                      </Button>
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                        <CreditCard className="h-4 w-4 mr-1" />
                        Billing
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Platform Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Active Users</span>
                    <span className="text-white">{mockMetrics.activeUsers}</span>
                  </div>
                  <Progress value={(mockMetrics.activeUsers / mockMetrics.totalUsers) * 100} />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">User Growth</span>
                    <span className="text-green-400">+{mockMetrics.newUsers}</span>
                  </div>
                  <Progress value={75} className="bg-green-900/20" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Churn Rate</span>
                    <span className="text-red-400">{mockMetrics.churnRate}%</span>
                  </div>
                  <Progress value={mockMetrics.churnRate * 10} className="bg-red-900/20" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">API Status</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-400">Operational</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Database</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-400">Healthy</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">AI Services</span>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <span className="text-yellow-400">Degraded</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export Reports
                </Button>
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Review
                </Button>
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <Settings className="h-4 w-4 mr-2" />
                  Platform Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedOrg && (
        <Alert className="mt-8 border-teal-500/20 bg-teal-500/10">
          <AlertCircle className="h-4 w-4 text-teal-400" />
          <AlertDescription className="text-teal-200">
            Organization "{mockOrganizations.find(org => org.id === selectedOrg)?.name}" selected. 
            Use the management tools above to configure settings, view detailed analytics, or manage billing.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
