import React, {useEffect, useRef, useState} from 'react'
import { io } from 'socket.io-client'

// Simple AES-GCM helpers (client-side E2EE demo)
async function genKey(){ return await window.crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']); }
async function encrypt(key, text){
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(text);
  const buf = await window.crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc);
  return {iv:Array.from(iv), data:Array.from(new Uint8Array(buf))};
}
async function decrypt(key, ivArr, dataArr){
  const iv = new Uint8Array(ivArr);
  const data = new Uint8Array(dataArr);
  const plain = await window.crypto.subtle.decrypt({name:'AES-GCM', iv}, key, data);
  return new TextDecoder().decode(plain);
}

export default function Chat({userId, peerId, apiBase}) {
  const [messages,setMessages] = useState([]);
  const [text,setText] = useState('');
  const socketRef = useRef(null);
  const cryptoKeyRef = useRef(null);
  const rocketRef = useRef(null);

  useEffect(()=>{
    (async()=>{ cryptoKeyRef.current = await genKey(); })();
    const socket = io(apiBase || '/', { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join', { id: userId });
    socket.on('message', async (data) => {
      if(data.type === 'encrypted') {
        const txt = await decrypt(cryptoKeyRef.current, data.iv, data.data);
        setMessages(m=>[...m, {from:data.from, text:txt}]);
      } else {
        setMessages(m=>[...m, {from:data.from, text: JSON.stringify(data)}]);
      }
    });
    return ()=> socket.disconnect();
  },[]);

  async function sendMessage(){
    if(!text) return;
    playRocket();
    const enc = await encrypt(cryptoKeyRef.current, text);
    const payload = { type:'encrypted', iv:enc.iv, data:enc.data, from:userId, to:peerId };
    // send via socket.io
    socketRef.current.emit('private_message', payload);
    setMessages(m=>[...m, {from:'me', text}]);
    setText('');
  }

  function playRocket(){
    const r = rocketRef.current;
    if(!r) return;
    r.classList.remove('launch');
    void r.offsetWidth;
    r.classList.add('launch');
    const p = document.createElement('div'); p.className='smoke';
    r.parentElement.appendChild(p);
    setTimeout(()=>p.remove(), 1200);
  }

  return (
    <div className="chat-root">
      <div className="header">
        <div className="logo">مانار</div>
        <div className="user">you: {userId} • peer: {peerId}</div>
      </div>
      <div className="messages">
        {messages.map((m,i)=>(<div key={i} className={'msg ' + (m.from==='me'?'me':'them')}><div className='bubble'><div className='sender'>{m.from}</div><div className='text'>{m.text}</div></div></div>))}
      </div>
      <div className="composer">
        <div className="rocket-wrapper"><div className="moon"><div ref={rocketRef} className="rocket">🚀</div></div></div>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="پیام..." />
        <button className="send-btn" onClick={sendMessage}>send</button>
      </div>
    </div>
  )
}
