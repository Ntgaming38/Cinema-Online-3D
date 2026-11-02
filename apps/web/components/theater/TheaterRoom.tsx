"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Users, Play, Pause, Send, Volume2, Maximize2, Heart, ThumbsUp } from "lucide-react";
import Link from "next/link";

function SeatBlock({ x, z, color }: {x:number;z:number;color:string}) {
  return <group position={[x,0,z]}>
    <mesh position={[0,.38,0]}><boxGeometry args={[.72,.55,.7]}/><meshStandardMaterial color={color} roughness={.75}/></mesh>
    <mesh position={[0,.72,-.28]}><boxGeometry args={[.72,.75,.16]}/><meshStandardMaterial color={color} roughness={.75}/></mesh>
    <mesh position={[-.42,.38,0]}><boxGeometry args={[.12,.55,.7]}/><meshStandardMaterial color={color}/></mesh>
    <mesh position={[.42,.38,0]}><boxGeometry args={[.12,.55,.7]}/><meshStandardMaterial color={color}/></mesh>
  </group>;
}
function TheaterScene() {
  const seats = [];
  for(let row=0;row<5;row++) for(let col=0;col<9;col++) {
    const x=(col-4)*1.05 + (row%2)*.18;
    const z=2.5+row*1.25;
    seats.push(<SeatBlock key={`${row}-${col}`} x={x} z={z} color={["#293849","#334052","#453448"][((row+col)%3)]}/>);
  }
  return <Canvas camera={{position:[0,7,14],fov:48}} dpr={[1,1.5]}>
    <color attach="background" args={["#080711"]}/><ambientLight intensity={1.1}/><pointLight position={[0,6,-5]} intensity={45} color="#9d4dff"/><spotLight position={[0,10,4]} intensity={30} angle={.55} penumbra={.7}/>
    <mesh position={[0,3,-7]}><boxGeometry args={[13,5,.35]}/><meshStandardMaterial color="#17142a" emissive="#3c176b" emissiveIntensity={.7}/></mesh>
    <mesh position={[0,3,-6.78]}><planeGeometry args={[11.8,3.65]}/><meshBasicMaterial color="#182e54"/></mesh>
    <Text position={[0,3.6,-6.7]} fontSize={.8} color="#fff" anchorX="center">TCG CINEMA</Text>
    <Text position={[0,2.65,-6.7]} fontSize={.32} color="#d9b7ff" anchorX="center">YOUR MOVIE NIGHT</Text>
    <mesh position={[0,.15,-5.9]}><boxGeometry args={[13,.3,2]}/><meshStandardMaterial color="#24133c" emissive="#7728d5" emissiveIntensity={.8}/></mesh>
    {seats}
    <mesh position={[0,-.12,1]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[16,22]}/><meshStandardMaterial color="#11101a" roughness={1}/></mesh>
    <OrbitControls enablePan={false} minDistance={9} maxDistance={20} maxPolarAngle={1.45}/>
  </Canvas>;
}

type ChatLine = { user:string; message:string };
export default function TheaterRoom({ roomCode }: { roomCode:string }) {
  const socketRef = useRef<Socket|null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [online,setOnline] = useState(1);
  const [playing,setPlaying] = useState(false);
  const [chat,setChat] = useState<ChatLine[]>([{user:"Hệ thống",message:"Chào mừng bạn đến rạp chiếu!"}]);
  const [message,setMessage] = useState("");
  const [videoUrl,setVideoUrl] = useState("");
  const [title,setTitle] = useState("Chưa chọn video");
  const [connected,setConnected] = useState(false);

  useEffect(()=>{
    const endpoint = process.env.NEXT_PUBLIC_REALTIME_URL;
    if(!endpoint) return;
    const socket = io(endpoint,{transports:["websocket","polling"]});
    socketRef.current = socket;
    socket.on("connect",()=>{setConnected(true);socket.emit("room:join",{roomCode,user:{id:"guest-"+socket.id,name:"Khách"} });});
    socket.on("disconnect",()=>setConnected(false));
    socket.on("room:presence",({count}:{count:number})=>setOnline(count));
    socket.on("chat:message",(line:ChatLine)=>setChat(old=>[...old.slice(-49),line]));
    socket.on("playback:state",(state:{isPlaying:boolean;positionSec:number})=>{
      setPlaying(state.isPlaying);
      const video=videoRef.current;
      if(video && Math.abs(video.currentTime-state.positionSec)>1.5) video.currentTime=state.positionSec;
      if(video && state.isPlaying) void video.play().catch(()=>{});
      if(video && !state.isPlaying) video.pause();
    });
    return ()=>{socket.emit("room:leave",{roomCode});socket.disconnect();socketRef.current=null;};
  },[roomCode]);

  const togglePlayback=()=>{
    const video=videoRef.current;
    if(!video) return;
    const next=!playing;
    setPlaying(next);
    socketRef.current?.emit("playback:command",{roomCode,action:next?"play":"pause",positionSec:video.currentTime});
    if(next) void video.play().catch(()=>{}); else video.pause();
  };
  const sendChat=()=>{
    const clean=message.trim().slice(0,500);
    if(!clean) return;
    socketRef.current?.emit("chat:send",{roomCode,message:clean,user:{name:"Khách"}});
    setMessage("");
  };
  const loadVideo=()=>{
    try {
      const url=new URL(videoUrl);
      if(!["https:","http:"].includes(url.protocol)) throw new Error();
      if (!videoRef.current) throw new Error();
      videoRef.current.src = url.href;
      videoRef.current.load();
      setTitle(url.hostname+" — video");
    } catch { alert("Vui lòng nhập URL video http(s) hợp lệ và thử lại."); }
  };

  return <main className="theater-page">
    <header className="theater-top"><Link href="/" className="back-link"><ArrowLeft/> TCG Cinema</Link><div><b>Phòng {roomCode}</b><span className={connected?"status-on":"status-off"}>{connected?"Đã kết nối":"Đang kết nối…"}</span></div><span className="online-pill"><Users size={16}/>{online} đang xem</span></header>
    <div className="theater-layout">
      <section className="theater-main">
        <div className="theater-heading"><div><small>NOW SHOWING</small><h1>{title}</h1><p>Phòng chiếu ảo · Chủ phòng quản lý đồng bộ</p></div><button className="ghost-button" onClick={()=>document.documentElement.requestFullscreen?.()}><Maximize2 size={16}/> Toàn màn hình</button></div>
        <div className="scene-wrap"><TheaterScene/><div className="scene-label">GÓC NHÌN RẠP 3D · KÉO ĐỂ XOAY</div></div>
        <div className="video-panel">
          <div className="video-head"><div><b>Trình phát video</b><small>URL video trực tiếp được phép nhúng</small></div><span className="sync-badge">● Đồng bộ phòng</span></div>
          <video ref={videoRef} className="video-player" controls playsInline crossOrigin="anonymous" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/>
          <div className="video-source"><input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="Dán URL video .mp4 hoặc HLS .m3u8"/><button onClick={loadVideo}>Kiểm tra URL</button></div>
          <div className="player-actions"><button onClick={togglePlayback}>{playing?<Pause size={17}/>:<Play size={17}/>} {playing?"Tạm dừng":"Phát"}</button><span><Volume2 size={16}/> Âm lượng do từng người tự chỉnh</span></div>
        </div>
      </section>
      <aside className="chat-panel"><div className="chat-title"><div><b>Chat chung</b><small>{online} thành viên trong phòng</small></div><span className="chat-live">LIVE</span></div>
        <div className="chat-messages">{chat.map((line,i)=><div className="chat-line" key={i}><span className="chat-avatar">{line.user.slice(0,1).toUpperCase()}</span><div><b>{line.user}</b><p>{line.message}</p></div></div>)}</div>
        <div className="quick-reactions"><button onClick={()=>socketRef.current?.emit("reaction:send",{roomCode,emoji:"❤️"})}><Heart/></button><button onClick={()=>socketRef.current?.emit("reaction:send",{roomCode,emoji:"👍"})}><ThumbsUp/></button><button onClick={()=>socketRef.current?.emit("reaction:send",{roomCode,emoji:"🔥"})}>🔥</button></div>
        <form className="chat-form" onSubmit={e=>{e.preventDefault();sendChat();}}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Nói gì với cả rạp đi…"/><button aria-label="Gửi tin nhắn"><Send size={18}/></button></form>
      </aside>
    </div>
    <footer className="theater-footer">TCG Cinema · Không gian xem phim cùng bạn bè</footer>
  </main>;
}
