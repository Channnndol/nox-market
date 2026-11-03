import {createClient} from '@supabase/supabase-js';
import {reconcile,validateBackupRecord} from './core.mjs';
const KEY='nox.records.v1', CONFIG='nox.connection.v1';
export class Store extends EventTarget {
  constructor(){super();try{this.records=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{this.records={};}this.user=null;this.busy=false;this.status='이 기기에 저장';this.conflicts=[];this.client=null;this.timer=null;this.configure(this.config());window.addEventListener('online',()=>this.sync());}
  config(){try{return JSON.parse(localStorage.getItem(CONFIG)||'null')??{url:import.meta.env.VITE_SUPABASE_URL||'',key:import.meta.env.VITE_SUPABASE_ANON_KEY||''};}catch{return {};}}
  configure({url,key}={}){
    this.subscription?.unsubscribe();clearInterval(this.timer);
    if(!url||!key)return;
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw new Error('Supabase 프로젝트의 HTTPS 주소를 입력하세요.');
    localStorage.setItem(CONFIG,JSON.stringify({url,key}));
    this.client=createClient(url,key);const {data}=this.client.auth.onAuthStateChange((_,session)=>{queueMicrotask(()=>this.onSession(session));});this.subscription=data.subscription;
    this.timer=setInterval(()=>this.sync(),15000);
  }
  async onSession(session){
    const id=session?.user?.id??null;
    const previous=localStorage.getItem('nox.owner');
    // A different authenticated account never inherits the previous account's private records.
    if(id&&previous&&previous!==id){this.records={};this.persist();}
    if(id)localStorage.setItem('nox.owner',id);
    this.user=session?.user??null;this.status=this.user?'동기화 연결 중':'이 기기에 저장';this.emit();if(this.user)await this.sync();
  }
  emit(){this.dispatchEvent(new Event('change'));}
  persist(){localStorage.setItem(KEY,JSON.stringify(this.records));}
  list(kind){return Object.values(this.records).filter(r=>!r.deleted&&r.kind===kind).map(r=>({...r.payload,id:r.id}));}
  get(id){const r=this.records[id];return r&&!r.deleted?{...r.payload,id:r.id}:null;}
  put(kind,id,payload){const r=this.records[id];this.records[id]={id,kind,payload,deleted:false,revision:r?.revision??0,pending:true,edit:crypto.randomUUID()};this.persist();this.emit();this.schedule();}
  remove(id){const r=this.records[id];if(!r)return;this.records[id]={...r,deleted:true,pending:true,edit:crypto.randomUUID()};this.persist();this.emit();this.schedule();}
  schedule(){clearTimeout(this.debounce);this.debounce=setTimeout(()=>this.sync(),700);}
  async sync(){
    if(!this.user||!this.client||this.busy||!navigator.onLine)return;this.busy=true;
    try{
      const {data,error}=await this.client.from('nox_items').select('*');if(error)throw error;
      for(const remote of data){this.records[remote.id]=reconcile(this.records[remote.id],remote);}
      for(const [id,r] of Object.entries(this.records)){
        if(!r.pending||r.conflict)continue;
        const edit=r.edit;
        const {data:written,error:e}=await this.client.rpc('nox_write',{item_id:id,item_kind:r.kind,item_payload:r.payload,item_deleted:!!r.deleted,expected_revision:r.revision});
        if(e){if(e.code==='PT409'){const {data:remote}=await this.client.from('nox_items').select('*').eq('id',id).single();if(remote)this.records[id]={...this.records[id],conflict:remote};continue;}throw e;}
        const current=this.records[id];this.records[id]=current.edit===edit?{...written,pending:false}:{...current,revision:written.revision};
      }
      this.conflicts=Object.values(this.records).filter(x=>x.conflict);
      this.status=this.conflicts.length?`충돌 ${this.conflicts.length}건 · 설정에서 해결`:`동기화됨 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`;
      this.persist();this.emit();
    }catch(e){this.status='동기화 대기 · '+e.message;this.emit();}finally{this.busy=false;}
  }
  resolve(id,useLocal){const r=this.records[id];if(!r?.conflict)return;this.records[id]=useLocal?{...r,revision:r.conflict.revision,conflict:null,pending:true}:{...r.conflict,pending:false};this.persist();this.emit();this.schedule();}
  async signIn(email,password){if(!this.client)throw new Error('먼저 Supabase 연결을 저장하세요.');const {error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;}
  async signUp(email,password){if(!this.client)throw new Error('먼저 Supabase 연결을 저장하세요.');const {error}=await this.client.auth.signUp({email,password,options:{emailRedirectTo:location.href.split('#')[0]}});if(error)throw error;}
  async signOut(){await this.client?.auth.signOut();this.user=null;this.records={};localStorage.removeItem('nox.owner');this.persist();this.status='로그아웃 · 로컬 개인 데이터 삭제됨';this.emit();}
  export(){return {app:'nox-market',version:1,exportedAt:new Date().toISOString(),records:Object.values(this.records).filter(r=>!r.deleted).map(({id,kind,payload})=>({id,kind,payload}))};}
  import(value){if(value.app!=='nox-market'||value.version!==1||!Array.isArray(value.records)||value.records.length>5000)throw new Error('NOX 백업 파일이 아닙니다.');const accepted=value.records.filter(r=>['drawing','watch','alert','preference'].includes(r.kind));accepted.forEach(validateBackupRecord);for(const r of accepted)this.put(r.kind,r.id,r.payload);}
}
