(()=>{
'use strict';
const VERSION='V1.12.2';
const CACHE_PREFIX='goalgrid_api_cache_v1122_';
const HISTORY_KEY='goalgrid_analiz_gecmisi_v111';

const originalApi=window.apiFootball;
if(typeof originalApi!=='function') return;

function cacheKey(path){return CACHE_PREFIX+encodeURIComponent(path);}
function readCache(path){
  try{const x=JSON.parse(localStorage.getItem(cacheKey(path))||'null');return x?.data||null;}catch{return null;}
}
function writeCache(path,data){
  try{localStorage.setItem(cacheKey(path),JSON.stringify({time:Date.now(),data}));}catch{}
}
function quotaError(e){
  const s=String(e?.message||e||'').toLowerCase();
  return s.includes('request limit')||s.includes('reached the request limit')||s.includes('upgrade your plan');
}
function savedFixturesForDate(path){
  const m=String(path).match(/^\/fixtures\?date=(\d{4}-\d{2}-\d{2})/);
  if(!m)return null;
  try{
    const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}');
    const a=h?.[m[1]]?.analyses;
    if(!Array.isArray(a)||!a.length)return null;
    const seen=new Set(),out=[];
    for(const x of a){
      const f=x?.fixture;if(!f?.fixture||!f?.teams||!f?.league)continue;
      const k=String(f.fixture.id||`${f.teams.home?.name}|${f.teams.away?.name}|${f.fixture.date}`);
      if(seen.has(k))continue;seen.add(k);out.push(f);
    }
    return out.length?out:null;
  }catch{return null;}
}

window.apiFootball=async function(path){
  const cached=readCache(path);
  /* Team-history/stat endpoints are stable enough to reuse for 6 hours, greatly
     reducing the free-plan daily request burn. Fixtures-by-date use 10 minutes. */
  try{
    const raw=localStorage.getItem(cacheKey(path));
    if(raw){
      const parsed=JSON.parse(raw);const age=Date.now()-(parsed.time||0);
      const ttl=String(path).startsWith('/fixtures?date=')?10*60*1000:6*60*60*1000;
      if(age<ttl&&Array.isArray(parsed.data))return parsed.data;
    }
  }catch{}
  try{
    const data=await originalApi(path);
    if(Array.isArray(data))writeCache(path,data);
    return data;
  }catch(e){
    if(quotaError(e)){
      if(Array.isArray(cached))return cached;
      const saved=savedFixturesForDate(path);
      if(Array.isArray(saved))return saved;
    }
    throw e;
  }
};

/* Make the user-facing error understandable when the free daily quota is spent. */
const oldScan=window.scan;
if(typeof oldScan==='function'){
  window.scan=async function(){
    try{return await oldScan();}
    catch(e){
      if(quotaError(e)){
        const el=document.querySelector('#scanState');
        if(el)el.textContent='API-Football günlük istek limiti doldu. Kayıtlı/cache verisi yoksa yeni fikstür çekilemez; limit yenilendiğinde otomatik devam eder.';
        return;
      }
      throw e;
    }
  };
}

window.addEventListener('DOMContentLoaded',()=>{
  document.title=`GoalGrid ${VERSION}`;
  const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();