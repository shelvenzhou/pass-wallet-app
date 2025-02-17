import { useEffect, useState } from 'react';
import { walletKitService } from '../services/walletkit';
import { SessionTypes } from '@walletconnect/types';

const ActiveSessions = () => {
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const activeSessions = walletKitService.getActiveSessions();
      setSessions(activeSessions);
    };

    fetchSessions();
  }, []);

  if (sessions.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Active Sessions</h3>
      <div className="space-y-2">
        {sessions.map((session) => (
          <div 
            key={session.topic} 
            className="p-4 border rounded-lg bg-white shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{session.peer.metadata.name}</p>
                <p className="text-sm text-gray-500">{session.peer.metadata.url}</p>
              </div>
              <button
                onClick={() => walletKitService.disconnectSession(session.topic)}
                className="text-red-500 hover:text-red-600"
              >
                Disconnect
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActiveSessions; 