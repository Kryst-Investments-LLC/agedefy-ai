'use client';

import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Users,
  Settings,
  Share,
  MessageSquare,
  Calendar,
  Clock,
  User,
  Shield,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'expert' | 'member';
  isVideoOn: boolean;
  isAudioOn: boolean;
  isConnected: boolean;
}

interface ConferenceSession {
  id: string;
  title: string;
  type: 'consultation' | 'group_session' | 'expert_talk';
  startTime: string;
  duration: number;
  maxParticipants: number;
  currentParticipants: number;
  host: string;
  description: string;
  category: string;
}

const mockParticipants: Participant[] = [
  {
    id: '1',
    name: 'Dr. Sarah Chen',
    role: 'expert',
    isVideoOn: true,
    isAudioOn: true,
    isConnected: true,
  },
  {
    id: '2',
    name: 'Michael Rodriguez',
    role: 'member',
    isVideoOn: true,
    isAudioOn: false,
    isConnected: true,
  },
  {
    id: '3',
    name: 'Emma Thompson',
    role: 'member',
    isVideoOn: false,
    isAudioOn: true,
    isConnected: true,
  },
];

const upcomingSessions: ConferenceSession[] = [
  {
    id: '1',
    title: 'NAD+ Optimization Strategies',
    type: 'expert_talk',
    startTime: '2025-01-22T15:00:00Z',
    duration: 60,
    maxParticipants: 50,
    currentParticipants: 23,
    host: 'Dr. Sarah Chen',
    description: 'Deep dive into NAD+ boosting protocols and latest research findings',
    category: 'Cellular Health',
  },
  {
    id: '2',
    title: 'Personalized Longevity Consultation',
    type: 'consultation',
    startTime: '2025-01-22T16:30:00Z',
    duration: 30,
    maxParticipants: 1,
    currentParticipants: 0,
    host: 'Dr. Marcus Williams',
    description: 'One-on-one consultation for personalized health optimization',
    category: 'Consultation',
  },
];

export function VideoConference() {
  const [isInCall, setIsInCall] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>(mockParticipants);
  const [selectedSession, setSelectedSession] = useState<ConferenceSession | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    if (isInCall && localVideoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: isVideoOn, audio: isAudioOn })
        .then(stream => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setConnectionStatus('connected');
        })
        .catch(error => {
          console.error('Error accessing media devices:', error);
          setConnectionStatus('disconnected');
        });
    }
  }, [isInCall, isVideoOn, isAudioOn]);

  const handleJoinCall = (session?: ConferenceSession) => {
    setSelectedSession(session || null);
    setIsInCall(true);
    setConnectionStatus('connecting');
  };

  const handleLeaveCall = () => {
    setIsInCall(false);
    setConnectionStatus('disconnected');
    setSelectedSession(null);
    
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
      }
    }
  };

  const toggleAudio = () => {
    setIsAudioOn(!isAudioOn);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn;
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'expert':
        return 'bg-purple-600/20 text-purple-300 border-purple-500/20';
      case 'host':
        return 'bg-teal-600/20 text-teal-300 border-teal-500/20';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/20';
    }
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'expert_talk':
        return 'bg-purple-600/20 text-purple-300 border-purple-500/20';
      case 'consultation':
        return 'bg-blue-600/20 text-blue-300 border-blue-500/20';
      case 'group_session':
        return 'bg-green-600/20 text-green-300 border-green-500/20';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/20';
    }
  };

  if (isInCall) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {selectedSession ? selectedSession.title : 'Video Conference'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={connectionStatus === 'connected' ? 'bg-green-600/20 text-green-300' : 'bg-yellow-600/20 text-yellow-300'}>
                  {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
                </Badge>
                <span className="text-gray-400">
                  {participants.filter(p => p.isConnected).length} participants
                </span>
              </div>
            </div>
            <Button
              onClick={handleLeaveCall}
              className="bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              Leave Call
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-200px)]">
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <Card className="bg-gray-800 border-gray-700 relative">
                  <CardContent className="p-0 h-full">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute bottom-4 left-4">
                      <Badge className="bg-teal-600/20 text-teal-300 border-teal-500/20">
                        You
                      </Badge>
                    </div>
                    {!isVideoOn && (
                      <div className="absolute inset-0 bg-gray-700 rounded-lg flex items-center justify-center">
                        <User className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {participants.slice(0, 3).map((participant) => (
                  <Card key={participant.id} className="bg-gray-800 border-gray-700 relative">
                    <CardContent className="p-0 h-full">
                      {participant.isVideoOn ? (
                        <video
                          ref={(el) => {
                            if (el) {
                              remoteVideoRefs.current[participant.id] = el;
                            }
                          }}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center">
                          <User className="h-16 w-16 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4">
                        <Badge className={getRoleColor(participant.role)}>
                          {participant.name}
                        </Badge>
                      </div>
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        {!participant.isAudioOn && (
                          <div className="bg-red-600 rounded-full p-1">
                            <MicOff className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {!participant.isVideoOn && (
                          <div className="bg-red-600 rounded-full p-1">
                            <VideoOff className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participants ({participants.filter(p => p.isConnected).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${participant.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                          <span className="text-white text-sm">{participant.name}</span>
                          <Badge className={getRoleColor(participant.role)} variant="outline">
                            {participant.role}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          {participant.isAudioOn ? (
                            <Mic className="h-4 w-4 text-green-400" />
                          ) : (
                            <MicOff className="h-4 w-4 text-red-400" />
                          )}
                          {participant.isVideoOn ? (
                            <Video className="h-4 w-4 text-green-400" />
                          ) : (
                            <VideoOff className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {showChat && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Chat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 bg-gray-700 rounded p-3 mb-3 overflow-y-auto">
                      <div className="space-y-2 text-sm">
                        <div className="text-gray-300">
                          <span className="text-purple-300 font-medium">Dr. Sarah Chen:</span> Welcome everyone!
                        </div>
                        <div className="text-gray-300">
                          <span className="text-blue-300 font-medium">Michael:</span> Thanks for hosting this session
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                        Send
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center gap-4 bg-gray-800 border border-gray-700 rounded-full px-6 py-3">
              <Button
                onClick={toggleAudio}
                size="sm"
                className={`rounded-full ${isAudioOn ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              
              <Button
                onClick={toggleVideo}
                size="sm"
                className={`rounded-full ${isVideoOn ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>

              <Button
                onClick={() => setShowChat(!showChat)}
                size="sm"
                className="rounded-full bg-gray-600 hover:bg-gray-700"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                className="rounded-full bg-gray-600 hover:bg-gray-700"
              >
                <Share className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                className="rounded-full bg-gray-600 hover:bg-gray-700"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Video Conferences</h1>
        <p className="text-gray-400">Join expert consultations and community sessions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Quick Join</CardTitle>
              <CardDescription>Start an instant video session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  onClick={() => handleJoinCall()}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Start Instant Session
                </Button>
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Session
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Upcoming Sessions</CardTitle>
              <CardDescription>Join scheduled expert talks and consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="p-4 border border-gray-600 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg">{session.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getSessionTypeColor(session.type)}>
                            {session.type.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className="border-gray-500 text-gray-300">
                            {session.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(session.startTime).toLocaleTimeString()}
                        </p>
                        <p className="text-gray-400 text-sm">{session.duration} min</p>
                      </div>
                    </div>

                    <p className="text-gray-300 text-sm mb-3">{session.description}</p>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>Host: {session.host}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{session.currentParticipants}/{session.maxParticipants}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleJoinCall(session)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Video className="h-4 w-4 mr-1" />
                        Join
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
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span>End-to-end encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span>HIPAA compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span>No data retention</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert className="border-blue-500/20 bg-blue-500/10">
            <Video className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200">
              <strong>Expert Consultations Available</strong>
              <br />
              Book one-on-one sessions with longevity experts and get personalized advice for your health optimization journey.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
