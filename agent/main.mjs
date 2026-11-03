import {createClient} from '@supabase/supabase-js';
import {writeFile,mkdir,rename,readFile} from 'node:fs/promises';
import {hostname} from 'node:os';
import {createHash} from 'node:crypto';
import {alertHit,validateAlert,marketKey} from '../src/core.mjs';
import {quote,candles} from '../src/markets.mjs';
import {renderAlert} from './render.mjs';

const names=['SUPABASE_URL','SUPABASE_ANON_KEY','NOX_EMAIL','NOX_PASSWORD','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID'];
const missing=names.filter(k=>!process.env[k]);
if(missing.length){console.error('설정이 필요합니다: '+missing.join(', '));console.error('.env.example을 .env로 복사하고 README의 PC 알림 연결 절차를 따르세요.');process.exit(1);}
if(process.argv.includes('--check-config')){console.log('필수 설정 항목 확인 완료. 네트워크 연결·실제 전송은 검사하지 않았습니다.');process.exit(0);}
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:true}});
const {error:authError}=await client.auth.signInWithPassword({email:process.env.NOX_EMAIL,password:process.env.NOX_PASSWORD});
if(authError){console.error('로그인에 실패했습니다. 이메일 확인 여부와 PC 전용 설정 파일을 확인하세요.');process.exit(1);}
const telegramBase=`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const identity='agent:'+createHash('sha256').update(hostname()).digest('hex').slice(0,16);
await mkdir('.agent',{recursive:true});
let ledger={};try{ledger=JSON.parse(await readFile('.agent/delivery.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('전송 기록 파일을 읽을 수 없습니다. 중복 전송 방지를 위해 중단합니다.');}
let stopped=false;const previous=new Map();
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const write=async(id,kind,payload,revision=0,deleted=false)=>{const {data,error}=await client.rpc('nox_write',{item_id:id,item_kind:kind,item_payload:payload,item_deleted:deleted,expected_revision:revision});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row||!Number.isFinite(row.revision))throw new Error('Invalid server write response');return row;};
async function persist(){await writeFile('.agent/delivery.tmp',JSON.stringify(ledger,null,2));await rename('.agent/delivery.tmp','.agent/delivery.json');}
async function sendPhoto(buffer,caption){const body=new FormData();body.set('chat_id',process.env.TELEGRAM_CHAT_ID);body.set('caption',caption.slice(0,1000));body.set('photo',new Blob([buffer],{type:'image/png'}),'nox-alert.png');const r=await fetch(telegramBase+'/sendPhoto',{method:'POST',body,signal:AbortSignal.timeout(20000)});const result=await r.json();if(!r.ok||!result.ok)throw new Error('텔레그램이 전송을 수락하지 않았습니다. 봇 시작 여부와 대상 채팅을 확인하세요.');}
async function heartbeat(records){const r=records.find(x=>x.id===identity);await write(identity,'agent',{lastSeen:Date.now(),status:'running',version:'0.1.0'},r?.revision??0);}
console.log('NOX 감시 프로그램 시작. Ctrl+C로 종료합니다. 기본 감시 주기는 15초이며 체결가를 사용합니다.');
while(!stopped){
  try{
    const {data:records,error}=await client.from('nox_items').select('*');if(error)throw error;
    await heartbeat(records);
    for(const stale of records.filter(r=>r.kind==='event'&&!r.deleted&&r.payload.status==='전송 준비'&&Date.now()-r.payload.at>120000)){
      await write(stale.id,'event',{...stale.payload,status:'전송 결과 확인 필요',message:'감시 프로그램이 중단되었거나 전송 확인을 받지 못했습니다. 텔레그램을 직접 확인하세요.'},stale.revision).catch(()=>{});
    }
    const alerts=records.filter(r=>!r.deleted&&r.kind==='alert'&&r.payload.enabled);
    const quotes=new Map();
    for(const record of alerts){
      if(stopped)break;
      try{
        const a=validateAlert(record.payload),key=marketKey(a.market);let q=quotes.get(key);
        if(!q){q=await quote(a.market);quotes.set(key,q);await sleep(150);}
        // The first observation after activation establishes the baseline for crossing alerts.
        const prev=previous.get(record.id);const validPrevious=prev&&prev.activatedAt===a.activatedAt?prev:null;
        previous.set(record.id,{...q,activatedAt:a.activatedAt});
        if(!alertHit(a,validPrevious,q))continue;
        const eventId=`event:${record.id}:${record.revision}`;
        if(ledger[eventId])continue;
        // CAS claims the alert across multiple agents before any external message is sent.
        const at=Date.now(),event={at,symbol:a.market.symbol,status:'전송 준비',message:a.note||''};
        const {data:claimResponse,error:claimError}=await client.rpc('nox_claim_alert',{alert_id:record.id,expected_revision:record.revision,event_id:eventId,event_payload:event});
        if(claimError)throw claimError;
        const eventRecord=Array.isArray(claimResponse)?claimResponse[0]:claimResponse;
        if(!eventRecord||!Number.isFinite(eventRecord.revision))throw new Error('Invalid claim response');
        ledger[eventId]={state:'preparing',at};await persist();
        try{
          const rows=await candles(a.market,a.interval,200);
          const drawings=records.filter(r=>r.kind==='drawing'&&!r.deleted&&r.payload.market===key).map(r=>r.payload);
          const buffer=renderAlert(a.market,rows,drawings,a,q.price);
          // A durable sending intent prevents duplicate notifications after an uncertain timeout or crash.
          ledger[eventId].state='sending';await persist();
          await sendPhoto(buffer,`NOX 가격 알림\n${a.market.symbol} · ${a.market.exchange.toUpperCase()} · ${a.market.category==='linear'?'USDT 무기한':'현물'}\n체결가 ${q.price} ${a.market.quote}\n${a.note||''}\n감시 주기 약 15초 · 차트는 알림 시점 최근 100봉`);
          ledger[eventId].state='sent';await persist();
          await write(eventId,'event',{...event,status:'전송 완료'},eventRecord.revision);
          console.log(new Date().toISOString(),'알림 전송 완료:',a.market.symbol);
        }catch{
          const uncertain=ledger[eventId].state==='sending';ledger[eventId].state=uncertain?'uncertain':'failed';await persist();
          await write(eventId,'event',{...event,status:uncertain?'전송 결과 확인 필요':'전송 실패',message:'자동 재전송하지 않습니다. 텔레그램을 확인하고 필요하면 알림을 다시 켜세요.'},eventRecord.revision).catch(()=>{});
          console.error('알림 처리 실패. 앱의 알림 기록을 확인하세요.');
        }
      }catch(e){if(e.code!=='PT409')console.error('시세 또는 알림 처리에 실패했습니다. 다음 주기에 재확인합니다.');}
    }
  }catch{console.error('서버 연결을 확인할 수 없습니다. 15초 후 재시도합니다.');}
  for(let i=0;i<15&&!stopped;i++)await sleep(1000);
}
await client.auth.signOut({scope:'local'});console.log('NOX 감시 프로그램을 종료했습니다.');process.exit(0);
