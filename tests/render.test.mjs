import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAlert} from '../agent/render.mjs';
test('notification chart renders real-shaped input with annotations to a PNG',()=>{const rows=Array.from({length:100},(_,i)=>({time:1700000000+i*3600,open:100+i,high:103+i,low:99+i,close:102+i,volume:i+1}));const buffer=renderAlert({symbol:'TEST',exchange:'binance',category:'linear',quote:'USDT'},rows,[{type:'horizontal',color:'#eac78c',points:[{time:1700000000,price:150}]}],{interval:'1h',target:150},150);assert.equal(buffer.subarray(1,4).toString(),'PNG');assert.ok(buffer.length>5000);});
