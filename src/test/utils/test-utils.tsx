import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

export const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  age: 30,
  healthGoals: ['longevity', 'fitness']
}

export const mockBiomarkers = [
  {
    id: '1',
    name: 'Vitamin D',
    value: 45,
    unit: 'ng/mL',
    range: { min: 30, max: 100 },
    status: 'normal' as const,
    trend: 'up' as const,
    lastUpdated: new Date().toISOString()
  },
  {
    id: '2',
    name: 'HbA1c',
    value: 5.2,
    unit: '%',
    range: { min: 4.0, max: 5.6 },
    status: 'normal' as const,
    trend: 'stable' as const,
    lastUpdated: new Date().toISOString()
  }
]

export const mockAIResponse = {
  content: 'This is a test AI response',
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  },
  cost: 0.001
}

export const waitForLoadingToFinish = () => 
  new Promise(resolve => setTimeout(resolve, 100))

export const mockApiResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  })
}
