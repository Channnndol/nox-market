const resolutions={'1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','1d':'D'};
const mounted=new WeakMap();

export function tradingViewSymbol(market){
  const {exchange,category,symbol}=market??{};
  if(!['upbit','binance','bybit'].includes(exchange)||!['spot','linear'].includes(category))throw new Error('지원하지 않는 거래소·상품입니다.');
  if(exchange==='upbit'){
    if(category!=='spot'||!/^KRW-[A-Z0-9]+$/.test(symbol))throw new Error('업비트 원화 현물 종목을 선택하세요.');
    return `UPBIT:${symbol.slice(4)}KRW`;
  }
  if(typeof symbol!=='string'||! /^[A-Z0-9]+USDT$/.test(symbol))throw new Error('USDT 종목 코드가 올바르지 않습니다.');
  return `${exchange.toUpperCase()}:${symbol}${category==='linear'?'.P':''}`;
}

export function widgetOptions({symbol,interval='1d',allowSymbolChange=false}){
  if(!Object.hasOwn(resolutions,interval))throw new Error('지원하지 않는 시간봉입니다.');
  return {
    autosize:true,symbol,interval:resolutions[interval],timezone:'Asia/Seoul',
    theme:'dark',style:'1',locale:'kr',backgroundColor:'#090b0e',gridColor:'rgba(35, 40, 50, 0.6)',
    allow_symbol_change:allowSymbolChange,hide_top_toolbar:false,hide_side_toolbar:false,
    hide_legend:false,hide_volume:false,save_image:true,withdateranges:true,
    calendar:false,details:false,hotlist:false,support_host:'https://www.tradingview.com'
  };
}

export const tradingViewLink=symbol=>'https://www.tradingview.com/chart/?symbol='+encodeURIComponent(symbol);

export function mountTradingView(host,options,onError=()=>{}){
  const config=JSON.stringify(options),previous=mounted.get(host);
  if(previous?.config===config&&previous.container.parentNode===host)return;
  // A fresh container isolates late execution of a previously requested embed.
  const doc=host.ownerDocument,container=doc.createElement('div');
  container.className='tradingview-widget-container';
  const inner=doc.createElement('div');inner.className='tradingview-widget-container__widget';
  const attribution=doc.createElement('div');attribution.className='tradingview-widget-copyright';
  const link=doc.createElement('a');link.href=tradingViewLink(options.symbol);link.target='_blank';link.rel='noopener nofollow';link.textContent=options.symbol+' chart';
  attribution.append(link,doc.createTextNode(' by TradingView'));
  const script=doc.createElement('script');
  script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async=true;script.textContent=config;
  script.onerror=()=>{if(container.parentNode===host){mounted.delete(host);onError();}};
  mounted.set(host,{config,container});
  container.append(inner,attribution,script);host.replaceChildren(container);
}
