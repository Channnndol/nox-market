export const intervals = { '1m':60, '5m':300, '15m':900, '1h':3600, '4h':14400, '1d':86400 };
export const marketKey = m => `${m.exchange}:${m.category}:${m.symbol}`;
export function normalizeCandles(rows) {
  const seen = new Map();
  for (const r of rows) {
    if (![r.time,r.open,r.high,r.low,r.close].every(Number.isFinite) || r.low > r.high || r.low > Math.min(r.open,r.close) || r.high < Math.max(r.open,r.close)) continue;
    seen.set(r.time,{...r,volume:Number.isFinite(r.volume)?r.volume:0});
  }
  return [...seen.values()].sort((a,b)=>a.time-b.time);
}
export function sma(rows,period) {
  let sum=0;
  return rows.flatMap((r,i)=>{ sum+=r.close; if(i>=period)sum-=rows[i-period].close; return i>=period-1?[{time:r.time,value:sum/period}]:[]; });
}
export function linePrice(d,time) {
  if(d.type==='horizontal') return d.points[0].price;
  const [a,b]=d.points;
  if(!a||!b||a.time===b.time)return null;
  return a.price+(b.price-a.price)*(time-a.time)/(b.time-a.time);
}
export function alertHit(alert, previous, current) {
  if(!alert.enabled || !Number.isFinite(current.price) || !Number.isFinite(current.time))return false;
  const targetAt = t=>alert.line?linePrice(alert.line,t):alert.target;
  const target=targetAt(current.time);
  if(!Number.isFinite(target))return false;
  if(alert.condition==='above')return current.price>=target;
  if(alert.condition==='below')return current.price<=target;
  if(!previous || !Number.isFinite(previous.price))return false;
  const oldTarget=targetAt(previous.time);
  if(!Number.isFinite(oldTarget))return false;
  return alert.condition==='crossUp'?previous.price<oldTarget&&current.price>=target:
    alert.condition==='crossDown'?previous.price>oldTarget&&current.price<=target:false;
}
export function validateAlert(a) {
  if(!a || !['above','below','crossUp','crossDown'].includes(a.condition))throw new Error('알림 조건이 올바르지 않습니다.');
  if(!a.market || !['upbit','binance','bybit'].includes(a.market.exchange))throw new Error('직접 연결된 코인 시세만 알림을 지원합니다.');
  if(!['spot','linear'].includes(a.market.category)||a.market.exchange==='upbit'&&a.market.category!=='spot')throw new Error('지원하지 않는 상품입니다.');
  if(!/^[A-Z0-9-]{2,30}$/.test(a.market.symbol))throw new Error('종목 코드가 올바르지 않습니다.');
  if(!intervals[a.interval])throw new Error('시간봉이 올바르지 않습니다.');
  if(a.line){
    if(!['horizontal','trend'].includes(a.line.type)||!Array.isArray(a.line.points)||a.line.points.length!==(a.line.type==='horizontal'?1:2)||!a.line.points.every(p=>Number.isFinite(p.time)&&Number.isFinite(p.price)&&p.price>0)||!Number.isFinite(linePrice(a.line,Date.now()/1000)))throw new Error('알림에 사용할 선이 올바르지 않습니다.');
  }else if(!Number.isFinite(a.target)||a.target<=0)throw new Error('목표 가격은 0보다 커야 합니다.');
  return a;
}
export function validateBackupRecord(r){
  if(!r||typeof r.id!=='string'||r.id.length>300||!r.payload||typeof r.payload!=='object'||Array.isArray(r.payload))throw new Error('백업 항목의 형식이 올바르지 않습니다.');
  const p=r.payload,validMarket=m=>m&&['upbit','binance','bybit'].includes(m.exchange)&&['spot','linear'].includes(m.category)&&/^[A-Z0-9-]{2,30}$/.test(m.symbol)&&typeof m.base==='string'&&typeof m.quote==='string';
  if(r.kind==='alert'){validateAlert(p);if(typeof p.enabled!=='boolean'||p.note!=null&&typeof p.note!=='string')throw new Error('알림 형식이 올바르지 않습니다.');}
  else if(r.kind==='watch'){if(!validMarket(p.market))throw new Error('관심종목 형식이 올바르지 않습니다.');}
  else if(r.kind==='drawing'){
    const count=['horizontal','text'].includes(p.type)?1:['trend','rectangle'].includes(p.type)?2:0;
    if(!count||!Array.isArray(p.points)||p.points.length!==count||!p.points.every(x=>Number.isFinite(x.time)&&Number.isFinite(x.price)&&x.price>0)||typeof p.market!=='string'||!/^#[a-f0-9]{6}$/i.test(p.color)||p.text!=null&&typeof p.text!=='string')throw new Error('드로잉 형식이 올바르지 않습니다.');
  }else if(r.kind==='preference'){
    if(r.id==='last-market'?!validMarket(p.market):r.id==='last-interval'?!intervals[p.interval]:true)throw new Error('설정 항목이 올바르지 않습니다.');
  }else throw new Error('가져올 수 없는 항목입니다.');
  return r;
}
// Per-record optimistic writes. Conflicts are exposed, never silently overwritten.
export function reconcile(local, remote) {
  if(!local || !local.pending)return {...remote,pending:false};
  if(local.revision===remote.revision)return local;
  return {...local,conflict:remote};
}
export const defaultMarkets = [
  {exchange:'upbit',category:'spot',symbol:'KRW-BTC',name:'비트코인',base:'BTC',quote:'KRW'},
  {exchange:'upbit',category:'spot',symbol:'KRW-ETH',name:'이더리움',base:'ETH',quote:'KRW'},
  {exchange:'binance',category:'spot',symbol:'BTCUSDT',name:'Bitcoin',base:'BTC',quote:'USDT'},
  {exchange:'binance',category:'linear',symbol:'BTCUSDT',name:'Bitcoin Perpetual',base:'BTC',quote:'USDT'},
  {exchange:'bybit',category:'linear',symbol:'ETHUSDT',name:'Ethereum Perpetual',base:'ETH',quote:'USDT'}
];
