// frontend/src/ChatRoom.jsx
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedAESKey,
  encryptText,
  decryptText,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "./crypto-utils";

// Default server (تغییر بده اگر آدرس دیگه‌ای داری)
const DEFAULT_SERVER = "https://manar-backend.onrender.com";

export default function ChatRoom({ name, room }) {
  const [serverUrl, setServerUrl] = useState(localStorage.getItem("MANAR_SERVER") || DEFAULT_SERVER);
  const [status, setStatus] = useState("disconnected");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const socketRef = useRef(null);
  const aesKeyRef = useRef(null);
  const privateKeyRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // load local messages
    try {
      const old = JSON.parse(localStorage.getItem("manar_msgs_" + room) || "[]");
      setMessages(old);
    } catch (e) {}
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
    // eslint-disable-next-line
  }, []);

  function addMessage(m) {
    setMessages((s) => {
      const next = [...s, m];
      try {
        localStorage.setItem("manar_msgs_" + room, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }

  async function connect() {
    if (!serverUrl) return alert("لطفاً آدرس سرور را وارد کنید.");
    setStatus("connecting");
    const socket = io(serverUrl, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("join", { room, name });
    });

    socket.on("room-count", ({ count }) => {
      setStatus(count >= 2 ? "ready" : "waiting for partner");
    });

    socket.on("peer-joined", () => {
      // nothing immediate — کلید و پیام‌ها مدیریت می‌شوند
    });

    socket.on("pubkey", async ({ raw }) => {
      try {
        const remote = await importPublicKey(base64ToArrayBuffer(raw));
        const shared = await deriveSharedAESKey(privateKeyRef.current, remote);
        aesKeyRef.current = shared;
        addMessage({ system: true, text: "کلید مشترک تولید شد — رمزنگاری فعال شد" });
      } catch (e) {
        console.error("pubkey error", e);
      }
    });

    socket.on("msg", async ({ payload }) => {
      try {
        const obj = JSON.parse(payload);
        if (obj.type === "text") {
          if (!aesKeyRef.current) { addMessage({ system: true, text: "پیام دریافت شد اما کلید نیست — صبر کنید" }); return; }
          const plain = await decryptText(aesKeyRef.current, obj.iv, obj.cipher);
          addMessage({ from: "them", text: plain, ts: Date.now() });
        }
      } catch (e) {
        console.error("msg decrypt error", e);
      }
    });

    socket.on("file", ({ filename, url, metadata }) => {
      addMessage({ from: "them", filename, url, metadata, ts: Date.now() });
    });

    socket.on("file-saved", ({ url, filename }) => {
      addMessage({ system: true, text: `فایل ${filename} در سرور ذخیره شد` });
    });

    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("connect_error"));

    // generate ECDH keys and publish public key
    const kp = await generateKeyPair();
    privateKeyRef.current = kp.privateKey;
    const pub = await exportPublicKey(kp.publicKey);
    socket.emit("pubkey", { room, raw: arrayBufferToBase64(pub) });

    setStatus("joined");
  }

  async function sendText() {
    if (!socketRef.current || socketRef.current.connected === false) return alert("ابتدا وصل شو.");
    if (!aesKeyRef.current) return alert("کلید AES هنوز آماده نیست. چند ثانیه صبر کن یا شریک‌ات وصل شود.");
    if (!text.trim()) return;
    const enc = await encryptText(aesKeyRef.current, text.trim());
    const payload = JSON.stringify({ type: "text", iv: enc.iv, cipher: enc.cipher });
    socketRef.current.emit("msg", { room, payload });
    addMessage({ from: "me", text: text.trim(), ts: Date.now() });
    setText("");
  }

  function onFileSelected(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!aesKeyRef.current) return alert("کلید AES آماده نیست.");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result; // plaintext data URL
      const enc = await encryptText(aesKeyRef.current, dataUrl);
      // send ciphertext (base64) to server, server will write raw bytes
      socketRef.current.emit("file", { room, filename: f.name, dataBase64: enc.cipher, metadata: { iv: enc.iv, mime: f.type } });
      addMessage({ from: "me", filename: f.name, local: true, ts: Date.now() });
    };
    reader.readAsDataURL(f);
    // clear input
    e.target.value = "";
  }

  // record short voice (uses MediaRecorder)
  async function recordVoice() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert("دستگاه شما از ضبط پشتیبانی نمی‌کند.");
    try {
      setIsRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (ev) => chunks.push(ev.data);
      mr.onstop = async () => {
        setIsRecording(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        const r = new FileReader();
        r.onload = async (ev) => {
          const dataUrl = ev.target.result;
          const enc = await encryptText(aesKeyRef.current, dataUrl);
          socketRef.current.emit("file", { room, filename: "voice-" + Date.now() + ".webm", dataBase64: enc.cipher, metadata: { iv: enc.iv, mime: "audio/webm" } });
          addMessage({ from: "me", filename: "voice.webm", local: true, ts: Date.now() });
        };
        r.readAsDataURL(blob);
      };
      mr.start();
      // demo: stop after 6 seconds — می‌تونی دکمه start/stop جدا بسازی
      setTimeout(() => {
        try { mr.stop(); stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      }, 6000);
    } catch (e) {
      setIsRecording(false);
      alert("خطا در دسترسی میکروفون یا ضبط");
      console.error(e);
    }
  }

  // download and decrypt file from server, then trigger save
  async function downloadAndSave(url, filename, metadata) {
    if (!aesKeyRef.current) return alert("کلید AES آماده نیست.");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("فایل پیدا نشد");
      const buf = await res.arrayBuffer();
      // convert bytes to base64
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const cipherB64 = btoa(binary);
      const plain = await decryptText(aesKeyRef.current, metadata.iv, cipherB64);
      // plain is dataURL like data:image/png;base64,...
      const arr = plain.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8], { type: mime });
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      addMessage({ system: true, text: `فایل ${filename} دانلود شد` });
    } catch (e) {
      console.error("download error", e);
      alert("خطا در دانلود یا رمزگشایی فایل");
    }
  }

  return (
    <div style={{ display: "flex", flex: 1, gap: 12 }}>
      {/* sidebar */}
      <div style={{ width: 320 }} className="left">
        <div style={{ marginBottom: 8 }}><strong>اتصال</strong></div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Server URL</div>
          <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={connect}>وصل شو</button>
          <button className="btn" onClick={() => { localStorage.setItem("MANAR_SERVER", serverUrl); alert("ذخیره شد"); }}>ذخیره</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>ابزارها</strong>
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 6 }}>ارسال فایل</div>
            <input ref={fileInputRef} type="file" onChange={onFileSelected} />
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={recordVoice} disabled={isRecording}>{isRecording ? "در حال ضبط..." : "ضبط ویس کوتاه"}</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>وضعیت</strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>{status}</div>
        </div>
      </div>

      {/* chat area */}
      <div style={{ flex: 1 }}>
        <div style={{ height: "62vh", overflow: "auto", padding: 12 }} className="messages">
          {messages.map((m, i) => {
            if (m.system) return <div key={i} style={{ textAlign: "center", color: "#666", margin: 8 }}>{m.text}</div>;
            if (m.filename) {
              return (
                <div key={i} className={"bubble " + (m.from === "me" ? "me" : "them")} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{m.filename}</div>
                  {m.url ? <div style={{ marginTop: 8 }}><button className="btn" onClick={() => downloadAndSave(m.url, m.filename, m.metadata)}>دانلود و ذخیره</button></div> : <div style={{ color: "#777" }}>در انتظار ذخیره سرور...</div>}
                </div>
              );
            }
            return (
              <div key={i} className={"bubble " + (m.from === "me" ? "me" : "them")} style={{ marginBottom: 8 }}>
                {m.text}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 8 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="پیام بنویس..." style={{ flex: 1, minHeight: 64, padding: 10, borderRadius: 10 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn" onClick={sendText}>ارسال 💌</button>
            <button className="btn" onClick={() => { setText(""); }}>پاک کن</button>
          </div>
        </div>
      </div>
    </div>
  );
}
