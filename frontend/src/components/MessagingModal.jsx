import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/useAuth';

export default function MessagingModal({ bookingId, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/messages/${bookingId}`);
      if (res.data.success) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching messages', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll every 3 seconds for new messages
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [bookingId]);

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    try {
      const res = await api.post(`/messages/${bookingId}`, { message_text: inputText });
      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setInputText('');
      }
    } catch (err) {
      console.error('Error sending message', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: 'white', padding: '20px', borderRadius: '12px', width: '400px', height: '500px', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Booking #{bookingId} Chat</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: '#f9fbf9', borderRadius: '8px', marginBottom: '15px' }}>
          {loading && messages.length === 0 ? (
            <p>Loading messages...</p>
          ) : messages.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888' }}>No messages yet. Say hi!</p>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_id === user.id;
              return (
                <div key={msg.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    background: isMine ? '#278b6a' : '#e0e0e0',
                    color: isMine ? 'white' : 'black',
                    padding: '8px 12px',
                    borderRadius: '16px',
                    maxWidth: '80%'
                  }}>
                    {msg.message_text}
                  </div>
                  <span style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                    {msg.sender_name} ({msg.sender_role})
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type a message..."
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '10px 15px', background: '#278b6a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
