import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
test('database policies isolate users and claim notifications transactionally',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
    await db.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
    const asUser=async(id)=>{await db.exec('reset role; set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
    const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
    await asUser(a);
    await db.query("select public.nox_write('alert-a','alert',$1,false,0)",[JSON.stringify({enabled:true,target:10})]);
    await asUser(b);assert.equal((await db.query('select * from public.nox_items')).rows.length,0);
    await assert.rejects(()=>db.query("select public.nox_claim_alert('alert-a',1,'event-b','{}')"),/already claimed or changed/);
    await assert.rejects(()=>db.query("update public.nox_items set payload='{}'"),/permission denied/);
    await asUser(a);
    await assert.rejects(()=>db.query("select public.nox_write('alert-a','alert','{}',false,0)"),/Revision conflict/);
    await db.query("select public.nox_claim_alert('alert-a',1,'event-a',$1)",[JSON.stringify({status:'preparing'})]);
    const rows=(await db.query('select * from public.nox_items')).rows;
    assert.equal(rows.find(r=>r.id==='alert-a').payload.enabled,false);assert.equal(rows.find(r=>r.id==='event-a').kind,'event');
    await assert.rejects(()=>db.query("select public.nox_claim_alert('alert-a',1,'event-duplicate','{}')"),/already claimed or changed/);
    assert.equal((await db.query("select * from public.nox_items where kind='event'")).rows.length,1);
    await db.exec("reset role; set role anon;");
    await assert.rejects(()=>db.query('select * from public.nox_items'),/permission denied/);
    await assert.rejects(()=>db.query("select public.nox_write('x','drawing','{}',false,0)"),/permission denied/);
  }finally{await db.close();}
});
