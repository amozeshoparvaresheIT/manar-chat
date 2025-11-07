
const subtle = window.crypto.subtle;
export async function generateKeyPair(){ return subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveKey']); }
export async function exportPublicKey(key){ return subtle.exportKey('raw', key); }
export async function importPublicKey(raw){ return subtle.importKey('raw', raw, {name:'ECDH', namedCurve:'P-256'}, true, []); }
export async function deriveSharedAESKey(privateKey, remotePublicKey){ return subtle.deriveKey({name:'ECDH', public: remotePublicKey}, privateKey, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']); }
export async function encryptText(aesKey, plaintext){ const enc = new TextEncoder(); const data = enc.encode(plaintext); const iv = window.crypto.getRandomValues(new Uint8Array(12)); const cipher = await subtle.encrypt({name:'AES-GCM', iv}, aesKey, data); return { iv: arrayBufferToBase64(iv), cipher: arrayBufferToBase64(cipher) }; }
export async function decryptText(aesKey, ivBase64, cipherBase64){ const iv = base64ToArrayBuffer(ivBase64); const cipher = base64ToArrayBuffer(cipherBase64); const plain = await subtle.decrypt({name:'AES-GCM', iv}, aesKey, cipher); return new TextDecoder().decode(plain); }
export function arrayBufferToBase64(buf){ const bytes = new Uint8Array(buf); let binary = ''; for(let b of bytes) binary += String.fromCharCode(b); return btoa(binary); }
export function base64ToArrayBuffer(base64){ const binary = atob(base64); const len = binary.length; const bytes = new Uint8Array(len); for(let i=0;i<len;i++) bytes[i] = binary.charCodeAt(i); return bytes.buffer; }
