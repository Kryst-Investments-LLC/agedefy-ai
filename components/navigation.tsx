"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import {
  Menu,
  X,
  Home,
  TestTube,
  Search,
  BarChart3,
  Users,
  BookOpen,
  Shield,
  Stethoscope,
  ShoppingCart,
  Microscope,
  Brain,
  Calendar,
  DollarSign,
  User,
} from "lucide-react"

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Compound Mixer", href: "/mixer", icon: TestTube, badge: "Popular" },
  { name: "Research", href: "/research", icon: Search },
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Community", href: "/community", icon: Users },
  { name: "Learn", href: "/learn", icon: BookOpen, badge: "New" },
  { name: "AI Personalization", href: "/personalization", icon: Brain, badge: "AI" },
  { name: "Telemedicine", href: "/telemedicine", icon: Stethoscope, badge: "Premium" },
  { name: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { name: "Lab Testing", href: "/lab-testing", icon: Microscope, badge: "New" },
  { name: "Clinical Trials", href: "/clinical-trials", icon: Calendar, badge: "Research" },
  { name: "Enterprise", href: "/enterprise", icon: Users, badge: "B2B" },
  { name: "Video Conference", href: "/video-conference", icon: Calendar, badge: "New" },
  { name: "Chat", href: "/chat", icon: Users, badge: "Live" },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-teal-400 to-blue-400 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AgeDefy AI</span>
            <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20 text-xs">BETA</Badge>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 overflow-x-auto">
            {navigation.slice(0, 8).map((item) => (
              <Link key={item.name} href={item.href}>
                <Button
                  variant="ghost"
                  className="text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                  {item.badge && (
                    <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20 text-xs ml-1">{item.badge}</Badge>
                  )}
                </Button>
              </Link>
            ))}

            {/* More dropdown for remaining items */}
            <div className="relative group">
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-700">
                More
              </Button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {navigation.slice(8).map((item) => (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700"
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {item.name}
                      {item.badge && (
                        <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20 text-xs ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* User Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <LanguageSwitcher />
            <Link href="/pricing">
              <Button variant="ghost" className="text-gray-300 hover:text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </Button>
            </Link>
            <Link href="/account">
              <Button variant="ghost" className="text-gray-300 hover:text-white flex items-center gap-2">
                <User className="h-4 w-4" />
                Account
              </Button>
            </Link>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">Get Started</Button>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            className="lg:hidden text-gray-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden py-4 border-t border-gray-700">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700"
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.name}
                    {item.badge && (
                      <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20 text-xs ml-2">
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-700 space-y-2">
                <div className="px-3 py-2">
                  <LanguageSwitcher />
                </div>
                <Link href="/pricing">
                  <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pricing
                  </Button>
                </Link>
                <Link href="/account">
                  <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white">
                    <User className="h-4 w-4 mr-2" />
                    Account
                  </Button>
                </Link>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">Get Started</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
