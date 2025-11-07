import React, {useState} from 'react'
import Chat from './Chat'

export default function App(){
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);

  return (
    <div className="app" role="application">
      <div className="header">
        <div className="logoCircle">M</div>
        <div style={{flex:1}}>
          <div className="title">Manar — امن ترین چت عاشقانه فقط مخصوص علی و نرگس با ذخیره ی همه ی اطلاعات فقط در گوشی خودمون</div>
          <div style={{fontSize:13,color:'#444'}}>دو نفره، امن، رمزنگاری انتها‌به‌انتها</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn" onClick={()=>{ if(room && name) setStarted(true) }}>وارد شو</button>
        </div>
      </div>

      <div className="container" style={{height: '72vh'}}>
        {!started ? (
          <div style={{display:'flex',flex:1,alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14}}>
            <div style={{maxWidth:420}}>
              <label>نام شما</label>
              <input value={name} onChange={e=>setName(e.target.value)} style={{width:'100%',padding:12,borderRadius:10,marginTop:8}} placeholder= "فقط علی یا نرگس" />
            </div>
            <div style={{maxWidth:420}}>
              <label>کد روم (کد اختصاصی شما)</label>
              <input value={room} onChange={e=>setRoom(e.target.value)} style={{width:'100%',padding:12,borderRadius:10,marginTop:8}} placeholder="مثلا: MANAR2025" />
            </div>
            <div style={{color:'#555',maxWidth:520,textAlign:'center',fontSize:13}}>
              برنامه نویسی شده فقط برای گل نرگسم..(کاش ستاره ای باشم در کهکشان ذهن تو)
            </div>
          </div>
        ) : (
          <Chat room={room} name={name} />
        )}
      </div>
    </div>
  )
}
