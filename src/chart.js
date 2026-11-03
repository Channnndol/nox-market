import {createChart,CandlestickSeries,HistogramSeries,LineSeries,ColorType} from 'lightweight-charts';
import {sma,intervals} from './core.mjs';
export class MarketChart {
  constructor(element,onDraw,onSelect){
    this.el=element;this.onDraw=onDraw;this.onSelect=onSelect;this.rows=[];this.drawings=[];this.tool='cursor';this.color='#eac78c';this.pending=[];
    this.chart=createChart(element,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#090b0e'},textColor:'#76818f',fontFamily:'Inter, Segoe UI, sans-serif',fontSize:11,attributionLogo:true},grid:{vertLines:{color:'#15191f'},horzLines:{color:'#15191f'}},rightPriceScale:{borderColor:'#252b34',scaleMargins:{top:.12,bottom:.23}},timeScale:{borderColor:'#252b34',timeVisible:true,secondsVisible:false,rightOffset:8},crosshair:{mode:0,vertLine:{color:'#59616f',labelBackgroundColor:'#363c48'},horzLine:{color:'#59616f',labelBackgroundColor:'#363c48'}},localization:{locale:'ko-KR'},handleScroll:{vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,pinch:true,mouseWheel:true}});
    this.series=this.chart.addSeries(CandlestickSeries,{upColor:'#4ac5a1',downColor:'#ed6b73',borderVisible:false,wickUpColor:'#4ac5a1',wickDownColor:'#ed6b73'});
    this.volume=this.chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',lastValueVisible:false,priceLineVisible:false});this.volume.priceScale().applyOptions({scaleMargins:{top:.83,bottom:0}});
    this.ma20=this.chart.addSeries(LineSeries,{color:'#d7b57b',lineWidth:1,priceLineVisible:false,lastValueVisible:false});this.ma60=this.chart.addSeries(LineSeries,{color:'#8e8ad4',lineWidth:1,priceLineVisible:false,lastValueVisible:false});
    this.fx=this.chart.addSeries(LineSeries,{color:'#eac78c',lineWidth:2,visible:false});
    const self=this;
    this.primitive={attached({requestUpdate}){self.invalidate=requestUpdate;},paneViews(){return [{zOrder:()=> 'top',renderer:()=>({draw(target){target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>self.paint(ctx,mediaSize));}})}];}};
    this.series.attachPrimitive(this.primitive);
    this.chart.subscribeClick(p=>this.click(p));
  }
  setData(rows,interval='1h',fx=false){
    this.rows=rows;this.interval=interval;this.isFX=fx;this.pending=[];
    this.series.applyOptions({visible:!fx});this.volume.applyOptions({visible:!fx});this.fx.applyOptions({visible:fx});
    if(fx){this.series.setData([]);this.volume.setData([]);this.ma20.setData([]);this.ma60.setData([]);this.fx.setData(rows.map(r=>({time:r.time,value:r.close})));}
    else {this.fx.setData([]);this.series.setData(rows);this.volume.setData(rows.map(r=>({time:r.time,value:r.volume,color:r.close>=r.open?'#234e42':'#512e34'})));this.updateIndicators();
      const p=rows.at(-1)?.close??1;const precision=p<.01?8:p<1?5:p<100?4:2;this.series.applyOptions({priceFormat:{type:'price',precision,minMove:10**-precision}});
    }
    this.chart.timeScale().fitContent();this.invalidate?.();
  }
  update(row){const last=this.rows.at(-1);if(last&&row.time<last.time)return;if(last?.time===row.time)this.rows[this.rows.length-1]=row;else this.rows.push(row);this.series.update(row);this.volume.update({time:row.time,value:row.volume,color:row.close>=row.open?'#234e42':'#512e34'});this.updateIndicators();}
  updateIndicators(){this.ma20.setData(sma(this.rows,20));this.ma60.setData(sma(this.rows,60));}
  reconcile(rows){const view=this.chart.timeScale().getVisibleLogicalRange();this.rows=rows;this.series.setData(rows);this.volume.setData(rows.map(r=>({time:r.time,value:r.volume,color:r.close>=r.open?'#234e42':'#512e34'})));this.updateIndicators();if(view)this.chart.timeScale().setVisibleLogicalRange(view);this.invalidate?.();}
  indicators(enabled){this.ma20.applyOptions({visible:enabled&&!this.isFX});this.ma60.applyOptions({visible:enabled&&!this.isFX});}
  setDrawings(drawings){this.drawings=drawings;this.invalidate?.();}
  setTool(tool){this.tool=tool;this.pending=[];this.el.style.cursor=tool==='cursor'?'default':'crosshair';this.chart.applyOptions({handleScroll:tool==='cursor'?{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false}:false});this.invalidate?.();}
  activeSeries(){return this.isFX?this.fx:this.series;}
  project(point){
    const rows=this.rows;if(!rows.length)return null;
    let logical=rows.findIndex(r=>r.time>=point.time);
    if(logical<0)logical=rows.length-1+(point.time-rows.at(-1).time)/(intervals[this.interval]||86400);
    else if(rows[logical].time!==point.time){if(logical===0)logical=(point.time-rows[0].time)/(intervals[this.interval]||86400);else logical=logical-1+(point.time-rows[logical-1].time)/(rows[logical].time-rows[logical-1].time);}
    return {x:this.chart.timeScale().logicalToCoordinate(logical),y:this.activeSeries().priceToCoordinate(point.price)};
  }
  unproject(point){const logical=this.chart.timeScale().coordinateToLogical(point.x);const price=this.activeSeries().coordinateToPrice(point.y);if(logical===null||price===null||!this.rows.length)return null;const i=Math.floor(logical),frac=logical-i;let time;
    if(i<0)time=this.rows[0].time+logical*(intervals[this.interval]||86400);
    else if(i>=this.rows.length-1)time=this.rows.at(-1).time+(logical-this.rows.length+1)*(intervals[this.interval]||86400);
    else time=this.rows[i].time+frac*(this.rows[i+1].time-this.rows[i].time);
    return {time:Math.round(time),price};
  }
  click({point}){if(!point||!this.rows.length||this.isFX)return;const p=this.unproject(point);if(!p||p.price<=0)return;
    if(this.tool==='cursor'){const selected=this.drawings.findLast(d=>{const a=this.project(d.points[0]),b=d.points[1]?this.project(d.points[1]):null;if(!a)return false;if(d.type==='horizontal')return Math.abs(point.y-a.y)<9;if(d.type==='text')return Math.abs(point.x-a.x)<80&&Math.abs(point.y-a.y)<15;if(!b)return false;const t=Math.max(0,Math.min(1,((point.x-a.x)*(b.x-a.x)+(point.y-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2||1)));return Math.hypot(point.x-(a.x+t*(b.x-a.x)),point.y-(a.y+t*(b.y-a.y)))<12;});this.selected=selected?.id;this.onSelect?.(selected);this.invalidate?.();return;}
    this.pending.push(p);if(this.tool==='horizontal'||this.tool==='text'||this.pending.length===2){this.onDraw({type:this.tool,points:[...this.pending],color:this.color});this.pending=[];}this.invalidate?.();
  }
  paint(ctx,size){ctx.save();ctx.beginPath();ctx.rect(0,0,size.width,size.height);ctx.clip();
    for(const d of this.drawings){const a=this.project(d.points[0]),b=d.points[1]?this.project(d.points[1]):null;if(!a||a.x===null||a.y===null)continue;ctx.strokeStyle=d.color;ctx.fillStyle=d.color;ctx.lineWidth=d.id===this.selected?2.5:1.5;ctx.setLineDash([]);ctx.beginPath();
      if(d.type==='horizontal'){ctx.moveTo(0,a.y);ctx.lineTo(size.width,a.y);ctx.stroke();}
      else if(d.type==='trend'&&b){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      else if(d.type==='rectangle'&&b){ctx.globalAlpha=.08;ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.globalAlpha=1;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
      else if(d.type==='text'){ctx.font='12px Segoe UI, sans-serif';ctx.fillText(d.text||'메모',a.x,a.y);}
      if(d.id===this.selected){for(const p of [a,b].filter(Boolean)){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}}
    }
    for(const p of this.pending){const q=this.project(p);if(q){ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fill();}}ctx.restore();
  }
  async capture(title,subtitle){
    const screenshot=this.chart.takeScreenshot(true);const canvas=document.createElement('canvas');canvas.width=screenshot.width;canvas.height=screenshot.height+98;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#090b0e';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='bold 19px Segoe UI';ctx.fillStyle='#e7e9ee';ctx.fillText('NOX  /  '+title,24,32);ctx.font='12px Segoe UI';ctx.fillStyle='#8f98a8';ctx.fillText(subtitle,24,55);ctx.drawImage(screenshot,0,74);ctx.fillText(new Date().toLocaleString('ko-KR')+' · 차트: TradingView Lightweight Charts',20,canvas.height-9);
    return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }
}
