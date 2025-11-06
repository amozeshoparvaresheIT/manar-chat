import React, {useEffect, useRef, useState} from 'react'
import io from 'socket.io-client'
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedAESKey, encryptText, decryptText, arrayBufferToBase64, base64ToArrayBuffer } from './crypto-utils'

const SIGNALING_URL_KEY = 'MANAR_SIGNALING_URL'

export default function Chat({room, name}) {
  const [socketUrl, setSocketUrl] = useState(localStorage.getItem(SIGNALING_URL_KEY) || '');
  const [status, setStatus] = useState('disconnected');
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const aesKeyRef = useRef(null);
  const privateKeyRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [text, setText] = useState('');
  const messagesBoxRef = useRef(null);

  useEffect(()=>{ messagesRef.current = messages }, [messages]);

  useEffect(()=> {
    return ()=> {
      if(socketRef.current) socketRef.current.disconnect();
      if(pcRef.current) pcRef.current.close();
    }
  }, []);

  async function connectSignaling() {
    if(!socketUrl) { alert('ابتدا آدرس signaling server را وارد کن'); return; }
    setStatus('connecting');
    const socket = io(socketUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', ()=> {
      setStatus('connected');
      socket.emit('join', room);
    });

    socket.on('peer-joined', async ()=> {
      console.log('peer joined');
      await startWebRTC(true);
    });

    socket.on('signal', async (data) => {
      if(data.type === 'offer') {
        await startWebRTC(false);
        await pcRef.current.setRemoteDescription(data.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('signal', { room, data: { type: 'answer', sdp: pcRef.current.localDescription }});
      } else if(data.type === 'answer') {
        await pcRef.current.setRemoteDescription(data.sdp);
      } else if(data.type === 'ice') {
        try { await pcRef.current.addIceCandidate(data.candidate); } catch(e) { console.warn(e); }
      } else if(data.type === 'pubkey') {
        const raw = base64ToArrayBuffer(data.raw);
        const remotePub = await importPublicKey(raw);
        const shared = await deriveSharedAESKey(privateKeyRef.current, remotePub);
        aesKeyRef.current = shared;
        console.log('AES derived');
      }
    });
  }

  async function startWebRTC(initiator) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    pc.onicecandidate = (e)=> {
      if(e.candidate) socketRef.current.emit('signal', { room, data: { type: 'ice', candidate: e.candidate }});
    };

    pc.ondatachannel = (e) => {
      const ch = e.channel;
      setupDataChannel(ch);
    };

    if(initiator) {
      const ch = pc.createDataChannel('chat');
      setupDataChannel(ch);
    }

    // generate ECDH key pair and send public key via signaling
    const kp = await generateKeyPair();
    privateKeyRef.current = kp.privateKey;
    const pubRaw = await exportPublicKey(kp.publicKey);
    const pubB64 = arrayBufferToBase64(pubRaw);
    socketRef.current.emit('signal', { room, data: { type: 'pubkey', raw: pubB64 } });

    if(initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('signal', { room, data: { type: 'offer', sdp: pc.localDescription }});
    }

    pc.onconnectionstatechange = ()=> {
      if(pc.connectionState === 'connected') setStatus('peer-connected');
      if(pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setStatus('disconnected');
    };
  }

  function setupDataChannel(ch) {
    dcRef.current = ch;
    ch.onopen = ()=> {
      addSystemMessage('کانال P2P باز شد — حالا می‌توانید پیام و فایل ارسال کنید');
    };
    ch.onmessage = async (e) => {
      try {
        const payload = JSON.parse(e.data);
        if(payload.type === 'text') {
          const plain = await decryptText(aesKeyRef.current, payload.iv, payload.cipher);
          addMessage({ from: 'them', text: plain });
        } else if(payload.type === 'file') {
          const plain = await decryptText(aesKeyRef.current, payload.iv, payload.cipher);
          const obj = JSON.parse(plain);
          addMessage({ from: 'them', file: obj, filename: obj.name });
        }
      } catch(err) {
        console.error('message decrypt error', err);
      }
    }
  }

  function addSystemMessage(text) {
    const m = { id: Date.now(), system:true, text };
    setMessages(prev=>[...prev, m]);
  }

  function addMessage(msg) {
    const m = { id: Date.now()+Math.random(), ...msg };
    setMessages(prev=>[...prev, m]);
    try {
      const all = JSON.parse(localStorage.getItem('manar_msgs_'+room) || '[]');
      all.push(m);
      localStorage.setItem('manar_msgs_'+room, JSON.stringify(all));
    } catch(e){}
    setTimeout(()=> messagesBoxRef.current?.scrollTo({top: messagesBoxRef.current.scrollHeight, behavior:'smooth'}),100);
  }

  async function sendText() {
    if(!dcRef.current || dcRef.current.readyState !== 'open') { alert('کانال دیتا باز نیست'); return; }
    if(!aesKeyRef.current) { alert('کلید AES آماده نیست'); return; }
    const plain = text;
    const enc = await encryptText(aesKeyRef.current, plain);
    const payload = { type:'text', iv: enc.iv, cipher: enc.cipher };
    dcRef.current.send(JSON.stringify(payload));
    addMessage({ from:'me', text: plain });
    setText('');
  }

  async function sendFile(file) {
    if(!dcRef.current || dcRef.current.readyState !== 'open') { alert('کانال دیتا باز نیست'); return; }
    if(!aesKeyRef.current) { alert('کلید AES آماده نیست'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      const meta = { name: file.name, type: file.type, data: base64 };
      const plain = JSON.stringify(meta);
      const enc = await encryptText(aesKeyRef.current, plain);
      const payload = { type:'file', iv: enc.iv, cipher: enc.cipher };
      dcRef.current.send(JSON.stringify(payload));
      addMessage({ from:'me', file: meta, filename: file.name });
    };
    reader.readAsDataURL(file);
  }

  function loadLocalMessages() {
    try {
      const all = JSON.parse(localStorage.getItem('manar_msgs_'+room) || '[]');
      setMessages(all);
    } catch(e){ setMessages([]) }
  }

  useEffect(()=> { loadLocalMessages(); }, []);

  return (
    <div style={{display:'flex',flex:1}}>
      <div className="sidebar">
        <div><strong>اتصال</strong></div>
        <div style={{marginTop:8}}><label>Signaling server URL</label>
          <input value={socketUrl} onChange={e=>setSocketUrl(e.target.value)} placeholder="https://your-render-url.com" style={{width:'100%',padding:8,borderRadius:8,marginTop:6}} />
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn" onClick={()=>{ localStorage.setItem(SIGNALING_URL_KEY, socketUrl); connectSignaling(); }}>اتصال</button>
          <button className="btn" onClick={()=>{ localStorage.setItem(SIGNALING_URL_KEY, socketUrl); alert('ذخیره شد'); }}>ذخیره</button>
        </div>

        <div className="settings">
          <div><strong>اطلاعات</strong></div>
          <div className="small">نام شما: {name}</div>
          <div className="small">کد روم: {room}</div>
          <div className="small">وضعیت: {status}</div>
        </div>
      </div>

      <div className="chat">
        <div className="messages" ref={messagesBoxRef}>
          {messages.map(m => (
            m.system ? (<div key={m.id} style={{textAlign:'center',color:'#666'}} className="fadeIn small">{m.text}</div>) :
            m.file ? (
              <div key={m.id} className={`bubble ${m.from==='me'?'me':'them'} fadeIn`} style={{display:'inline-block'}}>
                <div style={{fontSize:13,fontWeight:700}}>{m.filename}</div>
                {m.file?.type?.startsWith('image') && <img src={m.file.data} className="fileThumb" alt={m.filename} />}
                <div className="small">{new Date().toLocaleString()}</div>
              </div>
            ) : (
              <div key={m.id} className={`bubble ${m.from==='me'?'me':'them'} fadeIn`}><div>{m.text}</div><div className="small">{new Date(m.id).toLocaleString()}</div></div>
            )
          ))}
        </div>

        <div className="inputBar">
          <input id="fileinput" type="file" style={{display:'none'}} onChange={e=>sendFile(e.target.files[0])} />
          <button className="btn" onClick={()=>document.getElementById('fileinput').click()}>ارسال فایل</button>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="پیام..." />
          <button className="btn" onClick={sendText}>ارسال</button>
        </div>
      </div>
    </div>
  )
}
