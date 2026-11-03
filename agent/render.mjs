import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {existsSync} from 'node:fs';
import {linePrice,sma} from '../src/core.mjs';
const koreanFont='C:/Windows/Fonts/malgun.ttf';
if(existsSync(koreanFont))GlobalFonts.registerFromPath(koreanFont,'Nox Korean');
export function renderAlert(market,rows,drawings,alert,price){
  const canvas=createCanvas(1200,720),c=canvas.getContext('2d');
  c.fillStyle='#090b0e';c.fillRect(0,0,1200,720);c.fillStyle='#eac78c';c.font='bold 25px Nox Korean, sans-serif';c.fillText('NOX  /  PRICE ALERT',36,44);c.fillStyle='#edf0f5';c.font='23px Nox Korean, sans-serif';c.fillText(`${market.symbol}  ·  ${market.exchange.toUpperCase()}  ·  ${market.category==='linear'?'USDT 무기한':'현물'}`,36,86);c.fillStyle='#9da8b8';c.font='14px Nox Korean, sans-serif';c.fillText(`${alert.interval} · 최근 100개 봉 · 체결가 ${price.toLocaleString('en-US',{maximumFractionDigits:8})} ${market.quote}`,36,116);
  const data=rows.slice(-100);if(!data.length)throw new Error('캡처할 캔들이 없습니다.');
  const left=36,right=1080,top=155,bottom=592;const low=Math.min(...data.map(r=>r.low)),high=Math.max(...data.map(r=>r.high)),padding=(high-low)*.08||high*.01;const min=low-padding,max=high+padding;const step=(right-left)/data.length;
  const y=p=>bottom-(p-min)/(max-min)*(bottom-top),x=i=>left+(i+.5)*step;
  c.font='11px Nox Korean, sans-serif';for(let i=0;i<=5;i++){const p=min+(max-min)*i/5,yy=y(p);c.strokeStyle='#1d232c';c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();c.fillStyle='#7d899a';c.fillText(p.toLocaleString('en-US',{maximumFractionDigits:6}),right+12,yy+4);}
  const vmax=Math.max(1,...data.map(r=>r.volume||0));
  data.forEach((r,i)=>{const xx=x(i),up=r.close>=r.open;c.fillStyle=up?'#234e42':'#512e34';c.fillRect(xx-step*.34,654-(r.volume||0)/vmax*45,step*.68,(r.volume||0)/vmax*45);c.strokeStyle=up?'#4ac5a1':'#ed6b73';c.fillStyle=c.strokeStyle;c.beginPath();c.moveTo(xx,y(r.high));c.lineTo(xx,y(r.low));c.stroke();c.fillRect(xx-step*.3,Math.min(y(r.open),y(r.close)),Math.max(1,step*.6),Math.max(1,Math.abs(y(r.open)-y(r.close))));});
  const t0=data[0].time,t1=data.at(-1).time;
  const tx=t=>{let i=data.findIndex(r=>r.time>=t);if(i===0)return x(0)+(t-t0)/(data[1]?.time-t0||60)*step;if(i<0)return x(data.length-1)+(t-t1)/(data.at(-1).time-data.at(-2)?.time||60)*step;return x(i-1)+(t-data[i-1].time)/(data[i].time-data[i-1].time)*step;};
  c.save();c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();
  for(const [period,color]of [[20,'#d7b57b'],[60,'#8e8ad4']]){const values=sma(rows,period).filter(r=>r.time>=t0);c.strokeStyle=color;c.lineWidth=1;c.beginPath();values.forEach((r,i)=>i?c.lineTo(tx(r.time),y(r.value)):c.moveTo(tx(r.time),y(r.value)));c.stroke();}
  for(const d of drawings){if(!d.points?.length)continue;const [a,b]=d.points;c.strokeStyle=d.color||'#eac78c';c.fillStyle=c.strokeStyle;c.lineWidth=1.7;c.beginPath();if(d.type==='horizontal'){c.moveTo(left,y(a.price));c.lineTo(right,y(a.price));c.stroke();}else if(d.type==='trend'&&b){c.moveTo(tx(a.time),y(a.price));c.lineTo(tx(b.time),y(b.price));c.stroke();}else if(d.type==='rectangle'&&b){c.globalAlpha=.1;c.fillRect(tx(a.time),y(a.price),tx(b.time)-tx(a.time),y(b.price)-y(a.price));c.globalAlpha=1;c.strokeRect(tx(a.time),y(a.price),tx(b.time)-tx(a.time),y(b.price)-y(a.price));}else if(d.type==='text'){c.font='13px Nox Korean, sans-serif';c.fillText(d.text||'',tx(a.time),y(a.price));}}
  const target=alert.line?linePrice(alert.line,data.at(-1).time):alert.target;c.strokeStyle='#eac78c';c.setLineDash([6,5]);c.beginPath();c.moveTo(left,y(target));c.lineTo(right,y(target));c.stroke();c.restore();
  c.fillStyle='#788597';c.font='12px Nox Korean, sans-serif';c.fillText(new Date(t0*1000).toLocaleString('ko-KR'),left,681);c.fillText(new Date(t1*1000).toLocaleString('ko-KR'),right-185,681);c.fillStyle='#596679';c.font='10px Nox Korean, sans-serif';c.fillText('알림 전용 렌더링 · 거래소 데이터 · 이동평균 20 / 60 · '+new Date().toLocaleString('ko-KR'),left,707);
  return canvas.toBuffer('image/png');
}
