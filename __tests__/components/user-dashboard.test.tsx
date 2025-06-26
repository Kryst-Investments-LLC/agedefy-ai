import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/src/test/utils/test-utils'
import { UserDashboard } from '@/components/user-dashboard'

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'line' }),
  XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
  ResponsiveContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  BarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
  PieChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: () => React.createElement('div', { 'data-testid': 'pie' }),
  Cell: () => React.createElement('div', { 'data-testid': 'cell' }),
  AreaChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: () => React.createElement('div', { 'data-testid': 'area' }),
  RadialBarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'radial-bar-chart' }, children),
  RadialBar: () => React.createElement('div', { 'data-testid': 'radial-bar' }),
  Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
  ReferenceLine: () => React.createElement('div', { 'data-testid': 'reference-line' })
}))

describe('UserDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard header correctly', async () => {
    render(<UserDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/Welcome back.*Alex Johnson/)).toBeInTheDocument()
    })
  })

  it('displays user tracking information', async () => {
    render(<UserDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Track your longevity journey and optimize your health')).toBeInTheDocument()
    })
  })

  it('shows premium badge and streak', async () => {
    render(<UserDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
      expect(screen.getByText(/45.*day streak/)).toBeInTheDocument()
    })
  })

  it('displays health metrics cards', async () => {
    render(<UserDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Mixtures Created')).toBeInTheDocument()
      expect(screen.getByText('Papers Read')).toBeInTheDocument()
    })
  })

  it('renders health metrics cards', async () => {
    render(<UserDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Mixtures Created')).toBeInTheDocument()
      expect(screen.getByText('Papers Read')).toBeInTheDocument()
    })
  })
})
