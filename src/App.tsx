import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getOrCreateIdentity, Identity } from './cryptoIdentity';
import { getPulseSocket, SocketState } from './socketService';
import { LivingStateLedger } from './components/LivingStateLedger';
import { TopicFeed } from './components/TopicFeed';
import { IntentWaveBar } from './components/IntentWaveBar';

export function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [socketState, setSocketState] = useState<SocketState>('disconnected');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    getOrCreateIdentity().then((id) => {
      setIdentity(id);
      const socket = getPulseSocket(id.userId);
      unsubscribe = socket.onStateChange((state) => setSocketState(state));
      socket.connect();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const isOnline = socketState === 'connected';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-amber-500 animate-pulse'
              }`}
            />
            {isOnline && (
              <span className="absolute h-3.5 w-3.5 rounded-full bg-emerald-400/40 animate-ping" />
            )}
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white font-mono">PULSE</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Decision OS</p>
          </div>
        </div>

        {/* Identity Badge */}
        {identity && (
          <div
            title={`Full Public Key Fingerprint:\n${identity.userId}\n\nJWK:\n${JSON.stringify(
              identity.publicKeyJWK,
              null,
              2
            )}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-cyan-400 font-mono shadow-inner cursor-help transition-colors hover:border-cyan-500/50"
          >
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            <span>{identity.shortId}</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-6 pb-28">
        <LivingStateLedger />
        <TopicFeed />
      </main>

      {/* Fixed Bottom Input */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <IntentWaveBar />
        </div>
      </div>
    </div>
  );
}

export default App;