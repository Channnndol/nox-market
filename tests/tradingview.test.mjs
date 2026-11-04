import test from 'node:test';
import assert from 'node:assert/strict';
import {tradingViewSymbol,widgetOptions,mountTradingView} from '../src/tradingview.mjs';

test('exchange symbols keep spot and perpetual markets distinct',()=>{
  const cases=[
    [{exchange:'upbit',category:'spot',symbol:'KRW-BTC'},'UPBIT:BTCKRW'],
    [{exchange:'upbit',category:'spot',symbol:'KRW-ETH'},'UPBIT:ETHKRW'],
    [{exchange:'binance',category:'spot',symbol:'BTCUSDT'},'BINANCE:BTCUSDT'],
    [{exchange:'binance',category:'linear',symbol:'BTCUSDT'},'BINANCE:BTCUSDT.P'],
    [{exchange:'bybit',category:'spot',symbol:'ETHUSDT'},'BYBIT:ETHUSDT'],
    [{exchange:'bybit',category:'linear',symbol:'ETHUSDT'},'BYBIT:ETHUSDT.P'],
    [{exchange:'bybit',category:'linear',symbol:'1000PEPEUSDT'},'BYBIT:1000PEPEUSDT.P']
  ];
  for(const [market,want] of cases)assert.equal(tradingViewSymbol(market),want);
});

test('unsupported or malformed markets never silently become a different instrument',()=>{
  for(const market of [null,{exchange:'unknown',category:'spot',symbol:'BTCUSDT'},
    {exchange:'upbit',category:'linear',symbol:'KRW-BTC'},
    {exchange:'upbit',category:'spot',symbol:'BTC-KRW-ETH'},
    {exchange:'binance',category:'inverse',symbol:'BTCUSDT'},
    {exchange:'bybit',category:'spot',symbol:'BTCUSDT<script>'}]){
    assert.throws(()=>tradingViewSymbol(market));
  }
});

test('NOX intervals map to TradingView resolutions instead of changing minute/hour meaning',()=>{
  for(const [interval,want] of [['1m','1'],['5m','5'],['15m','15'],['1h','60'],['4h','240'],['1d','D']]){
    assert.equal(widgetOptions({symbol:'BINANCE:BTCUSDT.P',interval}).interval,want);
  }
  assert.throws(()=>widgetOptions({symbol:'BINANCE:BTCUSDT',interval:'invalid'}));
});

test('crypto embeds lock the instrument so NOX alerts cannot target a different displayed symbol',()=>{
  const options=widgetOptions({symbol:'BYBIT:ETHUSDT.P',interval:'1h'});
  assert.equal(options.symbol,'BYBIT:ETHUSDT.P');
  assert.equal(options.allow_symbol_change,false);
  assert.equal(widgetOptions({symbol:'NASDAQ:AAPL',allowSymbolChange:true}).allow_symbol_change,true);
});

// Only the DOM insertion boundary is simulated; no external script runs in unit tests.
function widgetHost(){
  const document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text,parentNode:null})};
  class Element{
    constructor(tag){this.tagName=tag;this.ownerDocument=document;this.children=[];this.parentNode=null;}
    append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const child of this.children)child.parentNode=null;this.children=[];this.append(...nodes);}
  }
  return document.createElement('div');
}

test('refreshing the same market preserves the live widget and its unsaved drawings',()=>{
  const host=widgetHost(),options=widgetOptions({symbol:'UPBIT:BTCKRW',interval:'1h'});
  mountTradingView(host,options);
  const first=host.children[0];
  mountTradingView(host,{...options});
  assert.equal(host.children[0],first,'a quote retry must not rebuild the TradingView iframe');
  mountTradingView(host,widgetOptions({symbol:'BINANCE:BTCUSDT.P',interval:'1h'}));
  assert.notEqual(host.children[0],first);
  const script=host.children[0].children.find(node=>node.tagName==='script');
  assert.equal(JSON.parse(script.textContent).symbol,'BINANCE:BTCUSDT.P');
});

test('detached embed errors cannot affect a newer chart and leaving NOX can mount again',()=>{
  const host=widgetHost(),options=widgetOptions({symbol:'BYBIT:ETHUSDT.P'}),errors=[];
  mountTradingView(host,options,()=>errors.push('old'));
  const old=host.children[0],oldScript=old.children.find(node=>node.tagName==='script');
  host.replaceChildren();
  mountTradingView(host,options,()=>errors.push('current'));
  assert.notEqual(host.children[0],old);
  oldScript.onerror();
  assert.deepEqual(errors,[]);
  host.children[0].children.find(node=>node.tagName==='script').onerror();
  assert.deepEqual(errors,['current']);
  const failed=host.children[0];
  mountTradingView(host,options);
  assert.notEqual(host.children[0],failed,'a failed script can be retried');
});
