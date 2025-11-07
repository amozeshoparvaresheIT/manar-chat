import React, {useState} from 'react'
import Chat from './components/Chat'
export default function App(){
  const [userId, setUserId] = useState('');
  const [peerId, setPeerId] = useState('');
  if(!userId){
    return <div className="center-box">
      <h1>مانار — Chat</h1>
      <input placeholder="your id (e.g., ali)" onChange={e=>setUserId(e.target.value)} />
      <input placeholder="peer id (e.g., zahra)" onChange={e=>setPeerId(e.target.value)} />
      <p>Open this page on two phones and enter complementary ids (alice -> bob)</p>
    </div>
  }
  return <Chat userId={userId} peerId={peerId} apiBase={import.meta.env.VITE_API_BASE || ''} />
}
