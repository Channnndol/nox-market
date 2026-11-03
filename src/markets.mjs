import {normalizeCandles, intervals} from './core.mjs';
const bases={upbit:'https://api.upbit.com/v1',binance:'https://data-api.binance.vision/api/v3',linear:'https://fapi.binance.com/fapi/v1',bybit:'https://api.bybit.com/v5'};
let upbitQueue=Promise.resolve(), lastUpbit=0;
const cache=new Map();
export async function json(url, options={}) {
  const run=async()=>{
    const response=await fetch(url,{...options,signal:options.signal??AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error(response.status===429?'호출 한도에 도달했습니다. 잠시 후 재연결하세요.':`시세 서버 응답 오류 (${response.status})`);
    const result=await response.json();
    if(result.retCode)throw new Error(`Bybit: ${result.retMsg}`);
    return result;
  };
  if(typeof window!=='undefined' && url.startsWith(bases.upbit)){
    const next=upbitQueue.catch(()=>{}).then(async()=>{
      const wait=10100-(Date.now()-lastUpbit); if(wait>0)await new Promise(r=>setTimeout(r,wait)); lastUpbit=Date.now(); return run();
    }); upbitQueue=next; return next;
  }
  return run();
}
export async function catalogue(exchange,category='spot') {
  const key=exchange+category;if(cache.has(key))return cache.get(key);
  let data;
  if(exchange==='upbit')data=(await json(`${bases.upbit}/market/all?isDetails=false`)).filter(x=>x.market.startsWith('KRW-')).map(x=>({exchange,category:'spot',symbol:x.market,name:x.korean_name,base:x.market.slice(4),quote:'KRW'}));
  if(exchange==='binance')data=(await json(`${category==='linear'?bases.linear:bases.binance}/exchangeInfo`)).symbols.filter(x=>x.status==='TRADING'&&x.quoteAsset==='USDT'&&(category!=='linear'||x.contractType==='PERPETUAL')).map(x=>({exchange,category,symbol:x.symbol,name:x.baseAsset,base:x.baseAsset,quote:x.quoteAsset}));
  if(exchange==='bybit'){
    let cursor='', all=[];
    do {const r=await json(`${bases.bybit}/market/instruments-info?category=${category}&limit=1000${cursor?'&cursor='+encodeURIComponent(cursor):''}`);all.push(...r.result.list);cursor=r.result.nextPageCursor??'';}while(cursor&&all.length<5000);
    data=all.filter(x=>x.status==='Trading'&&x.quoteCoin==='USDT'&&(category!=='linear'||x.contractType==='LinearPerpetual')).map(x=>({exchange,category,symbol:x.symbol,name:x.baseCoin,base:x.baseCoin,quote:x.quoteCoin}));
  }
  cache.set(key,data??[]);return data??[];
}
export async function candles(m,interval='1h',limit=300) {
  let rows;
  if(m.exchange==='upbit'){
    const part=interval==='1d'?'days':`minutes/${intervals[interval]/60}`;
    rows=(await json(`${bases.upbit}/candles/${part}?market=${encodeURIComponent(m.symbol)}&count=${Math.min(200,limit)}`)).map(x=>({time:Date.parse(x.candle_date_time_utc+'Z')/1000,open:x.opening_price,high:x.high_price,low:x.low_price,close:x.trade_price,volume:x.candle_acc_trade_volume}));
  }else if(m.exchange==='binance'){
    rows=(await json(`${m.category==='linear'?bases.linear:bases.binance}/klines?symbol=${encodeURIComponent(m.symbol)}&interval=${interval}&limit=${limit}`)).map(x=>({time:x[0]/1000,open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]}));
  }else if(m.exchange==='bybit'){
    const v=interval==='1d'?'D':intervals[interval]/60;
    rows=(await json(`${bases.bybit}/market/kline?category=${m.category}&symbol=${encodeURIComponent(m.symbol)}&interval=${v}&limit=${limit}`)).result.list.map(x=>({time:+x[0]/1000,open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]}));
  }else throw new Error('지원하지 않는 데이터 공급처입니다.');
  const out=normalizeCandles(rows); if(!out.length)throw new Error('조회 가능한 캔들이 없습니다.');return out;
}
export async function quote(m) {
  let price, time=Date.now()/1000, extra={};
  if(m.exchange==='upbit') {const [r]=await json(`${bases.upbit}/ticker?markets=${encodeURIComponent(m.symbol)}`);price=r.trade_price;time=r.trade_timestamp/1000;}
  else if(m.exchange==='binance') {const r=await json(`${m.category==='linear'?bases.linear:bases.binance}/ticker/price?symbol=${encodeURIComponent(m.symbol)}`);price=+r.price;}
  else if(m.exchange==='bybit'){const {result}=await json(`${bases.bybit}/market/tickers?category=${m.category}&symbol=${encodeURIComponent(m.symbol)}`);const r=result.list[0];price=+r.lastPrice;extra={mark:+r.markPrice,index:+r.indexPrice,funding:+r.fundingRate};}
  if(!Number.isFinite(price)||price<=0)throw new Error('유효한 시세를 받지 못했습니다.');return {price,time,...extra};
}
export async function futuresStats(m) {
  if(m.category!=='linear')return null;
  if(m.exchange==='bybit')return quote(m);
  const r=await json(`${bases.linear}/premiumIndex?symbol=${encodeURIComponent(m.symbol)}`);
  return {mark:+r.markPrice,index:+r.indexPrice,funding:+r.lastFundingRate};
}
export function stream(m,interval,onEvent,onState) {
  let socket,timer,ping,stopped=false,attempt=0;
  function connect(){
    if(stopped)return;onState('connecting');
    const iv=interval==='1d'?'D':intervals[interval]/60;
    const url=m.exchange==='upbit'?'wss://api.upbit.com/websocket/v1':m.exchange==='bybit'?`wss://stream.bybit.com/v5/public/${m.category}`:m.category==='linear'?`wss://fstream.binance.com/market/ws/${m.symbol.toLowerCase()}@kline_${interval}`:`wss://data-stream.binance.vision/ws/${m.symbol.toLowerCase()}@kline_${interval}`;
    socket=new WebSocket(url);
    socket.onopen=()=>{attempt=0;onState('connected');if(m.exchange==='upbit')socket.send(JSON.stringify([{ticket:crypto.randomUUID()},{type:'trade',codes:[m.symbol],isOnlyRealtime:true}]));if(m.exchange==='bybit'){socket.send(JSON.stringify({op:'subscribe',args:[`kline.${iv}.${m.symbol}`]}));ping=setInterval(()=>{if(socket.readyState===1)socket.send(JSON.stringify({op:'ping'}));},20000);}};
    socket.onmessage=async event=>{
      try{const d=JSON.parse(typeof event.data==='string'?event.data:await event.data.text()); if(stopped)return;
        if(d.error || d.success===false){onState('error');socket.close();return;}
        if(m.exchange==='upbit'&&d.type==='trade')onEvent({trade:true,time:d.trade_timestamp/1000,price:d.trade_price,volume:d.trade_volume,id:d.sequential_id});
        else if(d.k){const k=d.k;onEvent({time:k.t/1000,open:+k.o,high:+k.h,low:+k.l,close:+k.c,volume:+k.v});}
        else if(d.topic?.startsWith('kline.'))for(const k of d.data)onEvent({time:k.start/1000,open:+k.open,high:+k.high,low:+k.low,close:+k.close,volume:+k.volume});
      }catch{onState('error');}
    };
    socket.onerror=()=>onState('error');
    socket.onclose=()=>{clearInterval(ping);if(stopped)return;onState('reconnecting');timer=setTimeout(connect,Math.min(30000,(m.exchange==='upbit'?11000:1500)*2**attempt++));};
  }
  connect();return()=>{stopped=true;clearTimeout(timer);clearInterval(ping);socket?.close();};
}
export async function exchangeRates(base='USD',currency='KRW') {
  const start=new Date(Date.now()-220*86400000).toISOString().slice(0,10);
  const data=await json(`https://api.frankfurter.dev/v1/${start}..?base=${base}&symbols=${currency}`);
  return Object.entries(data.rates).map(([day,r])=>({time:Date.parse(day+'T00:00:00Z')/1000,close:r[currency]})).filter(r=>Number.isFinite(r.close)).sort((a,b)=>a.time-b.time);
}
