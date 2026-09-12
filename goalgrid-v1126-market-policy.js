(()=>{
'use strict';

const VERSION='V1.12.6';
const MIN_ALT_PROB=.60;
const MAX_GAP_TO_O15=.12;

function ranked(a){
  return Object.entries(a?.markets||{})
    .map(([name,probability])=>({name,probability:Number(probability)||0}))
    .sort((x,y)=>y.probability-x.probability);
}

function chooseMain(a){
  if(!a?.markets)return a;
  const list=ranked(a);
  if(!list.length)return a;

  const o15=list.find(x=>x.name==='1.5 Üst');
  const bestNonO15=list.find(x=>x.name!=='1.5 Üst');
  if(!o15||!bestNonO15){
    a.marketRanking=list;
    return a;
  }

  /* 1.5 Üst kupon değerini çoğu zaman düşürdüğü için ana tercih olarak
     yalnızca alternatif pazar belirgin biçimde zayıfsa tutulur. */
  const altStrongEnough=bestNonO15.probability>=MIN_ALT_PROB;
  const altCloseEnough=(o15.probability-bestNonO15.probability)<=MAX_GAP_TO_O15;

  if(o15.probability>=bestNonO15.probability && altStrongEnough && altCloseEnough){
    a.mainMarket=bestNonO15.name;
    a.mainProbability=bestNonO15.probability;
    a.alternative=o15;
    a.valuePolicy='1.5 Üst bastırıldı: ikinci pazar yeterince güçlü ve olasılık farkı kabul edilebilir.';
  }else if(o15.probability>=bestNonO15.probability){
    a.mainMarket='1.5 Üst';
    a.mainProbability=o15.probability;
    a.alternative=bestNonO15;
    a.valuePolicy='1.5 Üst korunuyor: diğer pazarlar güven bakımından yeterince yakın değil.';
  }else{
    a.mainMarket=list[0].name;
    a.mainProbability=list[0].probability;
    a.alternative=list.find(x=>x.name!==a.mainMarket)||null;
    a.valuePolicy='Ana pazar doğrudan en yüksek model olasılığına göre seçildi.';
  }

  a.marketRanking=list;
  return a;
}

const prev=window.analyseFixture;
if(typeof prev==='function'){
  window.analyseFixture=function(...args){
    return chooseMain(prev.apply(this,args));
  };
}

window.addEventListener('DOMContentLoaded',()=>{
  document.title=`GoalGrid ${VERSION}`;
  const s=document.querySelector('.subtitle');
  if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();
