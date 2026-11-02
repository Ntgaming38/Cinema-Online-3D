import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app=express();
app.use(cors({origin:(process.env.WEB_ORIGIN||"http://localhost:3000").split(","),credentials:true}));
app.get("/health",(_req,res)=>res.json({ok:true,service:"tcg-cinema-realtime",time:new Date().toISOString()}));
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:(process.env.WEB_ORIGIN||"http://localhost:3000").split(","),methods:["GET","POST"]},maxHttpBufferSize:1e6});

type Playback={isPlaying:boolean;positionSec:number;updatedAt:number};
const playback=new Map<string,Playback>();
const roomMembers=new Map<string,Set<string>>();
const cleanCode=(value:unknown)=>typeof value==="string"&&/^[A-Z0-9_-]{3,12}$/.test(value.toUpperCase())?value.toUpperCase():null;

io.on("connection",(socket)=>{
  let currentRoom:string|null=null;
  socket.on("room:join",(payload:{roomCode?:string;user?:{name?:string}})=>{
    const code=cleanCode(payload?.roomCode);
    if(!code) return socket.emit("app:error",{message:"Mã phòng không hợp lệ."});
    if(currentRoom&&currentRoom!==code) socket.leave(currentRoom);
    currentRoom=code;socket.join(code);
    const members=roomMembers.get(code)||new Set<string>();members.add(socket.id);roomMembers.set(code,members);
    socket.emit("playback:state",playback.get(code)||{isPlaying:false,positionSec:0,updatedAt:Date.now()});
    io.to(code).emit("room:presence",{count:members.size});
    socket.to(code).emit("chat:message",{user:"Hệ thống",message:`${payload?.user?.name||"Một thành viên"} đã vào phòng.`});
  });
  socket.on("room:leave",()=>leave());
  socket.on("chat:send",(payload:{roomCode?:string;message?:string;user?:{name?:string}})=>{
    if(!currentRoom||cleanCode(payload?.roomCode)!==currentRoom) return;
    const message=typeof payload.message==="string"?payload.message.trim().slice(0,500):"";
    if(!message) return;
    io.to(currentRoom).emit("chat:message",{user:(payload.user?.name||"Khách").slice(0,40),message});
  });
  socket.on("playback:command",(payload:{roomCode?:string;action?:string;positionSec?:number})=>{
    if(!currentRoom||cleanCode(payload?.roomCode)!==currentRoom) return;
    if(!["play","pause","seek"].includes(payload.action||"")) return;
    const previous=playback.get(currentRoom)||{isPlaying:false,positionSec:0,updatedAt:Date.now()};
    const position=Number.isFinite(payload.positionSec)?Math.max(0,Math.min(payload.positionSec!,86400)):previous.positionSec;
    const state={isPlaying:payload.action==="play"?true:payload.action==="pause"?false:previous.isPlaying,positionSec:position,updatedAt:Date.now()};
    playback.set(currentRoom,state);
    io.to(currentRoom).emit("playback:state",state);
  });
  socket.on("reaction:send",(payload:{roomCode?:string;emoji?:string})=>{
    if(!currentRoom||cleanCode(payload?.roomCode)!==currentRoom) return;
    const allowed=["❤️","👍","🔥","👏","😂","🎉"];
    if(payload.emoji&&allowed.includes(payload.emoji)) io.to(currentRoom).emit("reaction:new",{emoji:payload.emoji});
  });
  socket.on("disconnect",leave);
  function leave(){
    if(!currentRoom)return;
    const members=roomMembers.get(currentRoom);members?.delete(socket.id);
    const count=members?.size||0;
    if(count===0)roomMembers.delete(currentRoom);
    io.to(currentRoom).emit("room:presence",{count});
    socket.leave(currentRoom);currentRoom=null;
  }
});

const port=Number(process.env.REALTIME_PORT||4001);
httpServer.listen(port,"0.0.0.0",()=>console.log(`TCG Cinema realtime listening on :${port}`));
