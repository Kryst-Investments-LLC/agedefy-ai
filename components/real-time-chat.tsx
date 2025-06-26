'use client';

import {
  MessageSquare,
  Send,
  Users,
  Settings,
  Search,
  Hash,
  Lock,
  Globe,
  User,
  MoreVertical,
  Smile,
  Paperclip,
  Phone,
  Video,
  Shield,
  Bell,
  BellOff,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  userRole: 'member' | 'expert' | 'moderator' | 'admin';
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'file';
  reactions?: { emoji: string; count: number; users: string[] }[];
  replyTo?: string;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'expert';
  category: string;
  memberCount: number;
  isActive: boolean;
  lastMessage?: ChatMessage;
  unreadCount: number;
}

interface OnlineUser {
  id: string;
  username: string;
  role: 'member' | 'expert' | 'moderator' | 'admin';
  status: 'online' | 'away' | 'busy';
  avatar?: string;
}

const mockChatRooms: ChatRoom[] = [
  {
    id: '1',
    name: 'General Discussion',
    description: 'General longevity and health optimization chat',
    type: 'public',
    category: 'General',
    memberCount: 1247,
    isActive: true,
    unreadCount: 3,
    lastMessage: {
      id: '1',
      userId: '2',
      username: 'Dr. Sarah Chen',
      userRole: 'expert',
      content: 'The latest NAD+ research is quite promising...',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      type: 'text',
    },
  },
  {
    id: '2',
    name: 'NAD+ & Cellular Health',
    description: 'Discuss NAD+ boosters and cellular health optimization',
    type: 'public',
    category: 'Supplements',
    memberCount: 456,
    isActive: true,
    unreadCount: 0,
    lastMessage: {
      id: '2',
      userId: '3',
      username: 'Michael R.',
      userRole: 'member',
      content: 'Has anyone tried the new NMN protocol?',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      type: 'text',
    },
  },
  {
    id: '3',
    name: 'Expert Q&A',
    description: 'Ask questions directly to longevity experts',
    type: 'expert',
    category: 'Expert',
    memberCount: 89,
    isActive: true,
    unreadCount: 1,
  },
];

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    userId: '1',
    username: 'Alex Thompson',
    userRole: 'member',
    content: 'Has anyone had success with the rapamycin protocol discussed last week?',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    type: 'text',
    reactions: [{ emoji: '👍', count: 3, users: ['user1', 'user2', 'user3'] }],
  },
  {
    id: '2',
    userId: '2',
    username: 'Dr. Sarah Chen',
    userRole: 'expert',
    content: 'Great question! Rapamycin shows promising results in animal studies. For humans, the dosing is still being optimized. I recommend starting with the lowest effective dose and monitoring biomarkers closely.',
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    type: 'text',
    replyTo: '1',
    reactions: [
      { emoji: '👍', count: 8, users: [] },
      { emoji: '🧠', count: 2, users: [] },
    ],
  },
  {
    id: '3',
    userId: '3',
    username: 'Michael Rodriguez',
    userRole: 'member',
    content: 'Thanks Dr. Chen! What biomarkers should we focus on?',
    timestamp: new Date(Date.now() - 20 * 60 * 1000),
    type: 'text',
    replyTo: '2',
  },
  {
    id: '4',
    userId: '2',
    username: 'Dr. Sarah Chen',
    userRole: 'expert',
    content: 'Key markers include: mTOR activity, inflammatory markers (CRP, IL-6), metabolic markers (glucose, insulin), and cellular senescence markers. Regular monitoring helps ensure safety and efficacy.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    type: 'text',
    replyTo: '3',
  },
];

const mockOnlineUsers: OnlineUser[] = [
  { id: '1', username: 'Dr. Sarah Chen', role: 'expert', status: 'online' },
  { id: '2', username: 'Michael Rodriguez', role: 'member', status: 'online' },
  { id: '3', username: 'Emma Thompson', role: 'member', status: 'away' },
  { id: '4', username: 'Dr. Marcus Williams', role: 'expert', status: 'busy' },
  { id: '5', username: 'Admin', role: 'admin', status: 'online' },
];

export function RealTimeChat() {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom>(mockChatRooms[0] || mockChatRooms.find(() => true)!);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>(mockOnlineUsers);
  const [showUserList, setShowUserList] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: 'current-user',
      username: 'You',
      userRole: 'member',
      content: newMessage,
      timestamp: new Date(),
      type: 'text',
    };

    setMessages([...messages, message]);
    setNewMessage('');
    messageInputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'expert':
        return 'text-purple-300';
      case 'moderator':
        return 'text-teal-300';
      case 'admin':
        return 'text-red-300';
      default:
        return 'text-blue-300';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'expert':
        return 'bg-purple-600/20 text-purple-300 border-purple-500/20';
      case 'moderator':
        return 'bg-teal-600/20 text-teal-300 border-teal-500/20';
      case 'admin':
        return 'bg-red-600/20 text-red-300 border-red-500/20';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-400';
      case 'away':
        return 'bg-yellow-400';
      case 'busy':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getRoomTypeIcon = (type: string) => {
    switch (type) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'expert':
        return <Shield className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white mb-4">Community Chat</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">{onlineUsers.length} online</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        <div className="lg:col-span-1">
          <Card className="bg-gray-800 border-gray-700 h-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Rooms</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setNotifications(!notifications)}
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  {notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockChatRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedRoom.id === room.id
                        ? 'bg-teal-900/30 border border-teal-500/30'
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getRoomTypeIcon(room.type)}
                        <span className="text-white font-medium text-sm">{room.name}</span>
                      </div>
                      {room.unreadCount > 0 && (
                        <Badge className="bg-teal-600 text-white text-xs">
                          {room.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs truncate">{room.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-gray-500 text-xs">{room.memberCount} members</span>
                      {room.lastMessage && (
                        <span className="text-gray-500 text-xs">
                          {formatTimestamp(room.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700 h-full flex flex-col">
            <CardHeader className="border-b border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    {getRoomTypeIcon(selectedRoom.type)}
                    {selectedRoom.name}
                  </CardTitle>
                  <p className="text-gray-400 text-sm">{selectedRoom.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="group">
                    {message.replyTo && (
                      <div className="ml-4 mb-1 text-xs text-gray-500 border-l-2 border-gray-600 pl-2">
                        Replying to {messages.find(m => m.id === message.replyTo)?.username}
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-300" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${getRoleColor(message.userRole)}`}>
                            {message.username}
                          </span>
                          {message.userRole !== 'member' && (
                            <Badge className={getRoleBadge(message.userRole)} variant="outline">
                              {message.userRole}
                            </Badge>
                          )}
                          <span className="text-gray-500 text-xs">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">{message.content}</p>
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {message.reactions.map((reaction, idx) => (
                              <button
                                key={idx}
                                className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-full text-xs hover:bg-gray-600 transition-colors"
                              >
                                <span>{reaction.emoji}</span>
                                <span className="text-gray-300">{reaction.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-700 p-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 relative">
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={`Message #${selectedRoom.name.toLowerCase()}`}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={!newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {showUserList && (
          <div className="lg:col-span-1">
            <Card className="bg-gray-800 border-gray-700 h-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Online ({onlineUsers.length})</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowUserList(false)}
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {onlineUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                            <User className="h-3 w-3 text-gray-300" />
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(user.status)} rounded-full border-2 border-gray-800`} />
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${getRoleColor(user.role)}`}>
                            {user.username}
                          </p>
                          {user.role !== 'member' && (
                            <Badge className={getRoleBadge(user.role)} variant="outline">
                              {user.role}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {!isConnected && (
        <Alert className="mt-4 border-red-500/20 bg-red-500/10">
          <AlertDescription className="text-red-200">
            Connection lost. Attempting to reconnect...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
