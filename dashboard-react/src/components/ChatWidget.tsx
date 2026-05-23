import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Salut! Sunt Nemo Lab AI. Cum te pot ajuta cu lead-urile sau SMS-urile astăzi?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });
      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch (error) {
      // Error handling
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Modal - Full Screen pe mobil, Fixat pe desktop */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f172a] md:fixed md:bottom-24 md:right-4 md:top-auto md:w-96 md:h-[500px] md:rounded-2xl md:border md:border-cyan-500/30 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Nemo Lab AI</h3>
                <p className="text-xs text-cyan-400">Online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0f172a]">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-gray-100 border border-slate-700'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && <div className="flex justify-start"><div className="bg-slate-800 p-3 rounded-2xl text-xs text-gray-400 animate-pulse">AI scrie...</div></div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-700 bg-slate-900">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrie un mesaj..."
                className="flex-1 bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <button type="submit" disabled={isLoading} className="bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold">➤</button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${isOpen ? 'bg-slate-700 rotate-90' : 'bg-gradient-to-r from-cyan-500 to-blue-500 animate-bounce'}`}
      >
        {isOpen ? <span className="text-2xl text-white">✕</span> : <span className="text-2xl">💬</span>}
      </button>
    </>
  );
}
