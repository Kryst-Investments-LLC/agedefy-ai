'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  GitBranch,
  Handshake,
  Home,
  Lock,
  Microscope,
  Search,
  Shield,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  TestTube,
  Users,
  User,
  DollarSign,
  Settings,
} from 'lucide-react'

import { GlobalSearch } from '@/components/global-search'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from '@/components/ui/sidebar'

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  premium?: boolean
  badge?: string
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Home', href: '/', icon: Home },
      { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    ],
  },
  {
    label: 'My Health',
    items: [
      { name: 'Bio-Age', href: '/bio-age', icon: Activity },
      { name: 'Compound Mixer', href: '/mixer', icon: TestTube },
      { name: 'Pathways', href: '/pathways', icon: GitBranch },
      { name: 'Lab Testing', href: '/lab-testing', icon: Microscope, premium: true },
      { name: 'AI Personalization', href: '/personalization', icon: Brain, premium: true },
    ],
  },
  {
    label: 'Research & Discovery',
    items: [
      { name: 'Research Hub', href: '/research', icon: Search },
      { name: 'Intelligence', href: '/intelligence', icon: Sparkles, badge: 'New' },
      { name: 'Clinical Trials', href: '/clinical-trials', icon: Calendar, premium: true },
      { name: 'Learn', href: '/learn', icon: BookOpen },
    ],
  },
  {
    label: 'Marketplace & Services',
    items: [
      { name: 'Marketplace', href: '/marketplace', icon: ShoppingCart },
      { name: 'Telemedicine', href: '/telemedicine', icon: Stethoscope },
      { name: 'Scientist-Sponsor', href: '/scientist-sponsor', icon: Handshake, badge: 'Beta' },
      { name: 'Community', href: '/community', icon: Users },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-teal-400 to-blue-400">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold group-data-[collapsible=icon]:hidden">
            Biozephyra
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Search */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <GlobalSearch />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation groups */}
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href)

                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.premium && (
                        <SidebarMenuBadge>
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        </SidebarMenuBadge>
                      )}
                      {item.badge && (
                        <SidebarMenuBadge>
                          <span className="text-[10px] font-semibold text-primary">
                            {item.badge}
                          </span>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Pricing">
              <Link href="/pricing">
                <DollarSign className="h-4 w-4" />
                <span>Pricing</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Account">
              <Link href="/account">
                <User className="h-4 w-4" />
                <span>Account</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
