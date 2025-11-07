// frontend/src/ChatRoom.jsx
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import {
  generateKeyPair, exportPublicKey, importPublicKey,
  deriveSharedAESKey, encryptText, decryptText, arrayBufferToBase64, base64ToArrayBuffer
} from './crypto-utils';

export default function ChatRoom({ name, room }) {
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('MANAR_SERVER') || 'https://manar-backend.onrender.com');
  const [status, setStatus] = useState('disconnected');
  const [msgs, setMsgs] = useState([]);
  const socketRef = useRef(null);
  const aesKeyRef = useRef(null);
  const privateKeyRef = useRef(null);

  useEffect(()=> {
    const existing = JSON.parse(localStorage.getItem('manar_msgs_'+room)||'[]');
    setMsgs(existing);
    return ()=> { if(socketRef.current) socketRef.current.disconnect(); };
  },[]);

  function addMessage(m){
    setMsgs(s=>{ const next = [...s, m]; localStorage.setItem('manar_msgs_'+room, JSON.stringify(next)); return next; });
  }

  async function connect(){
    if(!serverUrl) return alert('آدرس سرور را وارد کن');
    const socket = io(serverUrl, { transports: ['websocket'] });
    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', ()=> {
      setStatus('connected');
      socket.emit('join', { room, name });
    });

    socket.on('room-count', ({count}) => {
      setStatus(count >= 2 ? 'ready' : 'waiting');
    });

    socket.on('peer-joined', ()=> {
      // other peer joined
    });

    socket.on('pubkey', async ({ from, raw }) => {
      try{
        const remote = await importPublicKey(base64ToArrayBuffer(raw));
        const shared = await deriveSharedAESKey(privateKeyRef.current, remote);
        aesKeyRef.current = shared;
        console.log('AES derived');
      }catch(e){console.error(e)}
    });

    socket.on('msg', async ({ from, payload }) => {
      try{
        const obj = JSON.parse(payload);
        if(obj.type === 'text'){
          const plain = await decryptText(aesKeyRef.current, obj.iv, obj.cipher);
          addMessage({ from:'them', text: plain, ts: Date.now() });
        }
      }catch(e){ console.error('msg decrypt error', e); }
    });

    socket.on('file', ({ from, filename, url, metadata }) => {
      addMessage({ from:'them', filename, url, ts:Date.now(), metadata });
    });

    // create ECDH keys and send public key
    const kp = await generateKeyPair();
    privateKeyRef.current = kp.privateKey;
    const pub = await exportPublicKey(kp.publicKey);
    socket.emit('pubkey', { room, raw: arrayBufferToBase64(pub) });

    setStatus('joined');
  }

  async function sendText(text){
    if(!aesKeyRef.current) return alert('کلید AES آماده نیست (صبر کن یا طرف مقابل وصل شود)');
    const enc = await encryptText(aesKeyRef.current, text);
    const payload = JSON.stringify({ type:'text', iv: enc.iv, cipher: enc.cipher });
    socketRef.current.emit('msg', { room, payload });
    addMessage({ from:'me', text, ts: Date.now() });
  }

  async function onFileInput(e){
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result; // raw base64 data URL (plaintext)
      // encrypt the entire dataUrl string
      const enc = await encryptText(aesKeyRef.current, dataUrl);
      // send encrypted ciphertext (base64) as dataBase64 to server
      // NOTE: we send cipher as base64 and server will store raw bytes
      socketRef.current.emit('file', { room, filename: f.name, dataBase64: enc.cipher, metadata: { iv: enc.iv, mime: f.type } });
      addMessage({ from:'me', filename: f.name, local: true, ts: Date.now() });
    };
    reader.readAsDataURL(f);
  }

  async function recordAudio() {
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type:'audio/webm' });
        const r = new FileReader();
        r.onload = async (ev) => {
          const dataUrl = ev.target.result;
          const enc = await encryptText(aesKeyRef.current, dataUrl);
          socketRef.current.emit('file', { room, filename: 'voice-'+Date.now()+'.webm', dataBase64: enc.cipher, metadata: { iv: enc.iv, mime: 'audio/webm' }});
          addMessage({ from:'me', filename:'voice.webm', local:true, ts:Date.now() });
        };
        r.readAsDataURL(blob);
      };
      rec.start();
      // stop after 6s (demo) — you can implement UI start/stop
      setTimeout(()=> rec.stop(), 6000);
    }catch(e){ alert('دسترسی میکروفون داده نشده یا پشتیبانی نمی‌شود'); console.error(e); }
  }

  // when user wants to download a received file: server will serve encrypted blob.
  // we must fetch it, decrypt it (AES-GCM) using stored metadata (iv) and then download as blob.
  // But server currently stored ciphertext bytes; metadata.iv is available so:
  async function downloadAndSave(url, filename, metadata){
    try{
      const res = await fetch(url);
      const buf = await res.arrayBuffer(); // ciphertext bytes (raw)
      // convert bytes to base64:
      let binary = '';
      const bytes = new Uint8Array(buf);
      for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
      const cipherB64 = btoa(binary);
      const plain = await decryptText(aesKeyRef.current, metadata.iv, cipherB64);
      // plain is dataURL (e.g., data:image/png;base64,...)
      const arr = plain.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while(n--) u8[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8], { type: mime });
      // trigger save
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(objUrl), 5000);
    }catch(e){ console.error('download error', e); alert('خطا در دانلود/رمزگشایی فایل'); }
  }

  return (
    <div style={{display:'flex', flex:1}}>
      <div style={{width:320, padding:16}} className="left">
        <div><strong>اتصال</strong></div>
        <div style={{marginTop:8}}>Server URL</div>
        <input value={serverUrl} onChange={e=>setServerUrl(e.target.value)} style={{width:'100%',padding:8,borderRadius:8}} />
        <div style={{marginTop:8}}><button className="btn" onClick={connect}>وصل شو</button></div>
        <div style={{marginTop:12}}><strong>ارسال فایل</strong><input type="file" onChange={onFileInput} /></div>
        <div style={{marginTop:12}}><button className="btn" onClick={recordAudio}>ضبط ویس کوتاه</button></div>
      </div>

      <div style={{flex:1, padding:12}} className="right">
        <div style={{marginBottom:8}}><strong>وضعیت: {status}</strong></div>
        <div className="messages" style={{height: '60vh', overflow:'auto', padding:12}}>
          {msgs.map((m,i)=>(
            m.filename ? (
              <div key={i} className="bubble them" style={{marginBottom:8}}>
                <div style={{fontWeight:700}}>{m.filename}</div>
                {m.url && <div><button className="btn" onClick={()=>downloadAndSave(m.url, m.filename, m.metadata)}>دانلود و ذخیره</button></div>}
              </div>
            ) : m.text ? (
              <div key={i} className={'bubble '+ (m.from==='me'?'me':'them')} style={{marginBottom:8}}>{m.text}</div>
            ) : null
          ))}
        </div>

        <div className="inputBar">
          <textarea value={''} placeholder="جملات پیشنهادی در بالا" style={{flex:1, padding:10}} readOnly />
        </div>
      </div>
    </div>
  );
}
