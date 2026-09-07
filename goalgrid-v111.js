(()=>{
  'use strict';
  const VERSION='V1.11.0';
  const HISTORY_KEY='goalgrid_analiz_gecmisi_v111';
  const RESULT_KEY='goalgrid_mac_istatistik_v111';
  const STAT_CACHE='goalgrid_fixture_stats_v111_';
  const TEAM_CACHE='goalgrid_teamresolve_v111_';
  const safe=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=v=>`%${Math.round((Number(v)||0)*100)}`;
  const now=()=>Date.now();

  function getHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}')||{}}catch{return {}}}
  function putHistory(date,analyses){const h=getHistory();h[date]={savedAt:new Date().toISOString(),analyses:JSON.parse(JSON.stringify(analyses||[]))};localStorage.setItem(HISTORY_KEY,JSON.stringify(h));}
  function getResults(){try{return JSON.parse(localStorage.getItem(RESULT_KEY)||'{}')||{}}catch{return {}}}
  function putResult(id,data){const x=getResults();x[id]=data;localStorage.setItem(RESULT_KEY,JSON.stringify(x));}
  function fixtureMs(f){const v=f?.fixture?.date;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}
  function fixtureStarted(f){const ms=fixtureMs(f);return ms>0 && ms<=now()}
  function fixtureReadyForResult(f){const ms=fixtureMs(f);return ms>0 && ms+2*60*60*1000<=now()}
  function isUefa(f){const id=Number(f?.league?.id);const n=plain(f?.league?.name||'');return [2,3,848].includes(id)||includesAny(n,EUROPE_NAMES)}

  async function resolveTeamId(name){
    if(!name) return null;
    const key=TEAM_CACHE+normalizeText(name);
    try{const c=JSON.parse(localStorage.getItem(key)||'null');if(c&&c.id) return c.id;}catch{}
    try{
      const arr=await apiFootball(`/teams?search=${encodeURIComponent(name)}`);
      if(!arr.length) return null;
      let best=arr.find(x=>sameTeamName(name,x.team?.name||''))||arr[0];
      const id=best?.team?.id??null;
      if(id) localStorage.setItem(key,JSON.stringify({id,name:best.team.name,time:Date.now()}));
      return id;
    }catch{return null;}
  }

  const oldNormalize=window.normalizeApiFootballHistoryMatch;
  window.normalizeApiFootballHistoryMatch=function(match){
    const x=oldNormalize(match);
    if(x) x.fixtureId=match?.fixture?.id??null;
    return x;
  };

  const oldBuild=window.buildFixtureHistory;
  window.buildFixtureHistory=async function(fixture){
    if(!isUefa(fixture)) return oldBuild(fixture);
    if(fixture.teams?.home && !fixture.teams.home.id) fixture.teams.home.id=await resolveTeamId(fixture.teams.home.name);
    if(fixture.teams?.away && !fixture.teams.away.id) fixture.teams.away.id=await resolveTeamId(fixture.teams.away.name);
    const base=await oldBuild(fixture);
    const groups=[base.matches||[]];
    const sources=[...(base.sources||[])];
    const errors=[...(base.errors||[])];
    for(const side of ['home','away']){
      const t=fixture.teams?.[side];
      if(!t?.id) continue;
      try{
        const hist=await loadTeamHistory(t.id);
        if(hist.length){groups.push(hist);sources.push(`UEFA takım geçmişi ${t.name} (${hist.length})`);}
      }catch(e){errors.push(`${t.name}: ${e.message}`)}
    }
    return {matches:mergeMatches(...groups),sources,errors};
  };

  const oldAnalyse=window.analyseFixture;
  window.analyseFixture=function(fixture,history,sourceNames){
    const a=oldAnalyse(fixture,history,sourceNames);
    if(!a?.markets||!a.homeForm) return a;
    const ranked=Object.entries(a.markets).map(([name,probability])=>({name,probability})).sort((x,y)=>y.probability-x.probability);
    if(a.mainMarket==='1.5 Üst'){
      const alt=ranked.find(x=>x.name!=='1.5 Üst' && x.probability>=.55);
      if(alt){
        a.mainMarket=alt.name;
        a.mainProbability=alt.probability;
        a.alternative=ranked.find(x=>x.name!==alt.name) || ranked[1];
        const g=grade(a.score,a.quality,a.mainProbability);
        a.grade=g[0];a.gradeClass=g[1];
        a.noReason=a.grade==='OYNAMA'?noReason(a.mainProbability,a.score,a.quality):'';
      }
    }
    a.marketRanking=ranked;
    return a;
  };

  const oldWanted=window.wantedFixture;
  window.wantedFixture=function(fixture){return oldWanted(fixture) && !fixtureStarted(fixture);};

  function qualityLabel(v){if(v>=85)return ['Çok iyi','İki takım için geniş ve kullanılabilir geçmiş var.'];if(v>=70)return ['İyi','Analiz için yeterli geçmiş var.'];if(v>=50)return ['Orta','Veri kullanılabilir ama temkin payı gerekli.'];return ['Zayıf','Geçmiş veri sınırlı; sonuç güveni düşer.'];}
  function agreementLabel(v){if(v>=80)return ['Yüksek','Matematik model ile geçmiş maç eğilimleri aynı yönde.'];if(v>=60)return ['Orta','Model ile geçmiş veri genel olarak uyuşuyor.'];return ['Düşük','Model ile geçmiş eğilimler arasında belirgin fark var.'];}
  function volatilityLabel(v){if(v<35)return ['Düşük','Takımların skor profili daha öngörülebilir.'];if(v<65)return ['Orta','Maçtan maça skor değişkenliği normal seviyede.'];return ['Yüksek','Skorlar çok değişiyor; sürpriz ihtimali artıyor.'];}
  function stabilityLabel(v){if(v>=70)return ['Yüksek','Sonuç profili istikrarlı.'];if(v>=45)return ['Orta','Form ve skor düzeni kısmen dalgalı.'];return ['Düşük','Takımların son dönem profili düzensiz.'];}
  function modelQualityHtml(a){
    const rows=[['Veri Kalitesi',...qualityLabel(a.quality)],['Model Uyumu',...agreementLabel(a.agreement)],['Oynaklık',...volatilityLabel(a.volatility)],['İstikrar',...stabilityLabel(a.stability)]];
    return `<div class="section"><div class="sectionTitle">MODEL KALİTESİ</div><div class="explainGrid">${rows.map(([k,l,d])=>`<div class="explainCard"><small>${k}</small><b>${l}</b><span>${d}</span></div>`).join('')}</div></div>`;
  }
  function commentaryHtml(a){
    const h=a.homeForm, d=a.awayForm, f=a.fixture;
    const total=(a.homeXg+a.awayXg).toFixed(2);
    const second=a.marketRanking?.find(x=>x.name!==a.mainMarket);
    let text=`${safe(f.teams.home.name)} son döneminde maç başına ${h.scored.toFixed(2)} gol atıp ${h.conceded.toFixed(2)} gol yiyor; ${safe(f.teams.away.name)} ise ${d.scored.toFixed(2)} atıp ${d.conceded.toFixed(2)} yiyor. Toplam gol beklentisi ${total}. `;
    text+=`Bu nedenle GoalGrid'in öne çıkardığı yorum <b>${safe(a.mainMarket)}</b> (${pct(a.mainProbability)}).`;
    if(second) text+=` Yakın ikinci seçenek <b>${safe(second.name)}</b> (${pct(second.probability)}).`;
    if(a.mainMarket!=='1.5 Üst' && a.markets['1.5 Üst']>=a.mainProbability) text+=` 1.5 Üst daha yüksek olasılığa sahip olsa da oranı genellikle düşük olduğu için ana seçim olarak bastırıldı.`;
    return `<div class="section"><div class="sectionTitle">YORUM</div><div class="muted">${text}</div></div>`;
  }

  function marketOddsHtml(a,index){
    const markets=Object.entries(a.markets).sort((x,y)=>y[1]-x[1]);
    return `<div class="section"><button class="secondary wide" onclick="GoalGrid111.toggleOdds(${index})">Oranları Aç / Kapat</button><div id="manualOdds_${index}" class="hidden manualOdds">${markets.map(([m,p])=>{
      const id=safeId(m);return `<div class="manualOddRow"><div><b>${safe(m)}</b><small>${pct(p)}</small></div><input id="manual_odds_${index}_${id}" type="number" inputmode="decimal" step="0.01" placeholder="Oran"><input id="manual_coupon_${index}_${id}" type="checkbox" title="Kupona ekle"><button class="secondary" onclick="GoalGrid111.saveOdd(${index},'${safe(m).replace(/'/g,"\\'")}')">Kaydet</button><div id="manual_result_${index}_${id}" class="oddsResult"></div></div>`;
    }).join('')}</div></div>`;
  }

  async function loadInjuriesForTeam(teamId){
    if(!teamId) return [];
    const seasons=[2026,2025];
    for(const s of seasons){try{const arr=await apiFootball(`/injuries?team=${teamId}&season=${s}&timezone=Europe/Istanbul`);if(arr.length)return arr;}catch{}}
    return [];
  }

  async function showInjuries(index){
    const a=state.analyses[index], host=document.querySelector(`#injury_${index}`); if(!a||!host)return;
    host.classList.toggle('hidden'); if(host.dataset.loaded==='1')return;
    host.innerHTML='Eksik oyuncular yükleniyor…';
    const f=a.fixture;
    if(!f.teams.home.id) f.teams.home.id=await resolveTeamId(f.teams.home.name);
    if(!f.teams.away.id) f.teams.away.id=await resolveTeamId(f.teams.away.name);
    const [h,d]=await Promise.all([loadInjuriesForTeam(f.teams.home.id),loadInjuriesForTeam(f.teams.away.id)]);
    const render=(name,list)=>`<div class="injuryTeam"><b>${safe(name)}</b>${list.length?list.slice(0,12).map(x=>`<div>${safe(x.player?.name||'Oyuncu')} <span>${safe(x.player?.reason||x.type||'Durumu belirsiz')}</span></div>`).join(''):'<div class="muted">Kayıtlı eksik bilgisi bulunamadı.</div>'}</div>`;
    host.innerHTML=render(f.teams.home.name,h)+render(f.teams.away.name,d);host.dataset.loaded='1';
  }

  async function resolveFixtureId(f){
    const raw=String(f?.fixture?.id||''); if(/^\d+$/.test(raw)) return Number(raw);
    const date=String(f?.fixture?.date||'').slice(0,10); if(!date)return null;
    try{
      const arr=await apiFootball(`/fixtures?date=${date}&timezone=Europe/Istanbul`);
      const hit=arr.find(x=>sameTeamName(f.teams.home.name,x.teams?.home?.name||'')&&sameTeamName(f.teams.away.name,x.teams?.away?.name||''));
      return hit?.fixture?.id??null;
    }catch{return null;}
  }

  async function fixtureStats(id){
    if(!id) return null;
    const key=STAT_CACHE+id;
    try{const c=JSON.parse(localStorage.getItem(key)||'null');if(c)return c;}catch{}
    try{const arr=await apiFootball(`/fixtures/statistics?fixture=${id}`);localStorage.setItem(key,JSON.stringify(arr));return arr;}catch{return null;}
  }
  function statNum(v){if(v===null||v===undefined)return null;const n=parseFloat(String(v).replace('%',''));return Number.isFinite(n)?n:null}
  function aggregateStats(groups){
    const sums={},counts={};
    groups.flat().forEach(team=>{(team?.statistics||[]).forEach(s=>{const n=statNum(s.value);if(n===null)return;const k=s.type;sums[k]=(sums[k]||0)+n;counts[k]=(counts[k]||0)+1;})});
    return Object.keys(sums).map(k=>({name:k,value:sums[k]/counts[k]})).sort((a,b)=>a.name.localeCompare(b.name));
  }
  async function recentDetailedStats(teamId){
    if(!teamId)return [];
    let fixtures=[];try{fixtures=await apiFootball(`/fixtures?team=${teamId}&last=10&timezone=Europe/Istanbul`)}catch{return []}
    const all=[];for(const f of fixtures.slice(0,10)){const s=await fixtureStats(f.fixture?.id);if(s)all.push(s)}
    return aggregateStats(all);
  }
  function statTable(title,stats){return `<div class="statTeam"><b>${safe(title)}</b>${stats.length?stats.map(s=>`<div><span>${safe(s.name)}</span><strong>${s.value.toFixed(1)}</strong></div>`).join(''):'<div class="muted">Detaylı istatistik bulunamadı.</div>'}</div>`}
  async function showStats(index){
    const a=state.analyses[index],host=document.querySelector(`#stats_${index}`);if(!a||!host)return;
    host.classList.toggle('hidden');if(host.dataset.loaded==='1')return;
    host.innerHTML='İstatistikler hazırlanıyor…';const f=a.fixture;
    if(fixtureReadyForResult(f)){
      const id=await resolveFixtureId(f);const stats=await fixtureStats(id);let fixtureInfo=null;
      if(id){try{const arr=await apiFootball(`/fixtures?id=${id}&timezone=Europe/Istanbul`);fixtureInfo=arr[0]||null}catch{}}
      if(stats){const rec={fixtureId:id,savedAt:new Date().toISOString(),fixture:fixtureInfo,statistics:stats};putResult(f.fixture.id,rec);host.innerHTML=finishedStatsHtml(a,rec);host.dataset.loaded='1';return;}
    }
    if(!f.teams.home.id)f.teams.home.id=await resolveTeamId(f.teams.home.name);if(!f.teams.away.id)f.teams.away.id=await resolveTeamId(f.teams.away.name);
    const [hs,as]=await Promise.all([recentDetailedStats(f.teams.home.id),recentDetailedStats(f.teams.away.id)]);
    host.innerHTML=`<div class="muted" style="margin-bottom:8px">Son 10 maçta erişilebilen tüm detay istatistiklerin maç başı ortalaması.</div><div class="statsDetailGrid">${statTable(f.teams.home.name,hs)}${statTable(f.teams.away.name,as)}</div>`;host.dataset.loaded='1';
  }
  function finishedStatsHtml(a,rec){
    const fi=rec.fixture;const score=fi?`${fi.goals?.home??'-'} - ${fi.goals?.away??'-'}`:'Bitti';
    const blocks=(rec.statistics||[]).map(t=>`<div class="statTeam"><b>${safe(t.team?.name||'Takım')}</b>${(t.statistics||[]).map(s=>`<div><span>${safe(s.type)}</span><strong>${safe(s.value??'—')}</strong></div>`).join('')}</div>`).join('');
    return `<div class="finishedScore">${score}</div><div class="statsDetailGrid">${blocks||'<div class="muted">İstatistik bulunamadı.</div>'}</div>`;
  }

  async function captureFinished(){
    for(const a of state.analyses||[]){const f=a.fixture;if(!fixtureReadyForResult(f))continue;const key=String(f.fixture.id);if(getResults()[key])continue;const id=await resolveFixtureId(f);if(!id)continue;const stats=await fixtureStats(id);if(!stats)continue;let info=null;try{const x=await apiFootball(`/fixtures?id=${id}&timezone=Europe/Istanbul`);info=x[0]||null}catch{}putResult(key,{fixtureId:id,savedAt:new Date().toISOString(),fixture:info,statistics:stats});}
  }

  function saveOdd(index,market){
    const a=state.analyses[index];if(!a)return;const id=safeId(market);const input=document.querySelector(`#manual_odds_${index}_${id}`);const odds=Number(input?.value);if(!Number.isFinite(odds)||odds<=1){alert('Geçerli bir oran gir.');return}
    const p=a.markets[market]||0, marketP=1/odds, fair=p?1/p:null, edge=(p-marketP)*100, value=(odds*p-1)*100;
    addOddsHistory({time:new Date().toISOString(),matchId:a.fixture.fixture.id,league:a.fixture.league.name,home:a.fixture.teams.home.name,away:a.fixture.teams.away.name,market,type:'manual',site:'Manuel',odds,modelProbability:p,marketProbability:marketP,fairOdds:fair,edge,value,score:a.score});
    const host=document.querySelector(`#manual_result_${index}_${id}`);if(host)host.innerHTML=`Model ${pct(p)} • Adil oran ${fair?fair.toFixed(2):'—'} • Değer ${value>=0?'+':''}${value.toFixed(1)}%`;
    const cb=document.querySelector(`#manual_coupon_${index}_${id}`);if(cb?.checked){state.coupon=state.coupon.filter(x=>!(x.matchId===a.fixture.fixture.id&&x.market===market));state.coupon.push({id:Date.now()+Math.random(),matchId:a.fixture.fixture.id,match:`${a.fixture.teams.home.name} - ${a.fixture.teams.away.name}`,market,type:'manual',site:'Manuel',odds,modelProbability:p,score:a.score,matchDate:a.fixture.fixture.date});saveActiveCoupon();updateCoupon();}
  }

  function noDataCard(a){const f=a.fixture;const t=new Date(f.fixture.date).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'});return `<section class="card"><div class="row"><div><div class="league">${safe(f.league.country||'')} • ${safe(f.league.name)}</div><div class="teams">${safe(f.teams.home.name)} — ${safe(f.teams.away.name)}</div></div><div class="time">${t}</div></div><div class="mainPick"><div class="pick">VERİ YETERSİZ <span class="grade grade-no">OYNAMA</span></div></div><div class="reasonNo">Bu iki takım için yeterli geçmiş maç verisi eşleştirilemedi. Avrupa kupası maçlarında takım kimlikleri ve yerel lig geçmişi ayrıca aranıyor.</div></section>`}
  window.matchCard=function(a,index){
    if(!a.homeForm)return noDataCard(a);
    const f=a.fixture;const t=new Date(f.fixture.date).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'});
    const result=getResults()[String(f.fixture.id)];
    return `<section class="card"><div class="row"><div><div class="league">${safe(f.league.country||'')} • ${safe(f.league.name)}</div><div class="teams">${safe(f.teams.home.name)} — ${safe(f.teams.away.name)}</div></div><div class="time">${t}</div></div><div class="mainPick"><div><div class="pick">🎯 ${safe(a.mainMarket)} <span class="grade ${a.gradeClass}">${safe(a.grade)}</span></div><div class="muted">GoalGrid Güven Puanı: ${a.score}/100</div></div><div class="bigPct">${pct(a.mainProbability)}</div></div>${a.grade==='OYNAMA'?`<div class="reasonNo"><b>Neden OYNAMA?</b><br>${safe(a.noReason)}</div>`:''}<div class="section"><div class="sectionTitle">1 • X • 2 OLASILIKLARI</div><div class="grid3"><div class="metric"><small>1 - Ev Sahibi</small><b>${pct(a.markets['Ev Sahibi'])}</b></div><div class="metric"><small>X - Beraberlik</small><b>${pct(a.markets['Beraberlik'])}</b></div><div class="metric"><small>2 - Deplasman</small><b>${pct(a.markets['Deplasman'])}</b></div></div></div><div class="grid2"><div class="metric"><small>Ev Beklenen Gol</small><b>${a.homeXg.toFixed(2)}</b></div><div class="metric"><small>Dep Beklenen Gol</small><b>${a.awayXg.toFixed(2)}</b></div><div class="metric"><small>Toplam Gol Beklentisi</small><b>${(a.homeXg+a.awayXg).toFixed(2)}</b></div><div class="metric"><small>1.5 Üst</small><b>${pct(a.markets['1.5 Üst'])}</b></div><div class="metric"><small>2.5 Üst</small><b>${pct(a.markets['2.5 Üst'])}</b></div><div class="metric"><small>KG Var</small><b>${pct(a.markets['KG Var'])}</b></div><div class="metric"><small>1X</small><b>${pct(a.markets['1X'])}</b></div><div class="metric"><small>X2</small><b>${pct(a.markets['X2'])}</b></div></div>${modelQualityHtml(a)}${commentaryHtml(a)}<div class="section"><div class="sectionTitle">MAÇ BİLGİLERİ</div><div class="actionGrid"><button class="secondary" onclick="GoalGrid111.showInjuries(${index})">Muhtemel Eksikler</button><button class="secondary" onclick="GoalGrid111.showStats(${index})">${result||fixtureReadyForResult(f)?'Maç İstatistikleri':'İstatistik'}</button></div><div id="injury_${index}" class="hidden detailBox"></div><div id="stats_${index}" class="hidden detailBox">${result?finishedStatsHtml(a,result):''}</div></div>${marketOddsHtml(a,index)}</section>`;
  };

  function renderAnalysisHistory(){
    const h=getHistory();const dates=Object.keys(h).sort().reverse();
    const host=document.querySelector('#content');if(!host)return;
    host.innerHTML=dates.length?dates.map(d=>`<section class="card"><div class="row"><div><b>${safe(d)}</b><div class="muted">${h[d].analyses?.length||0} maçlık kayıt</div></div><button class="secondary" onclick="GoalGrid111.loadHistory('${d}')">Aç</button></div></section>`).join(''):'<div class="empty">Henüz kayıtlı analiz günü yok.</div>';
  }
  function loadHistory(date){const h=getHistory();if(!h[date])return;state.analyses=h[date].analyses||[];state.tab='all';document.querySelector('#selectedDate').value=date;updateSelectedDateText();render();document.querySelector('#scanState').textContent=`${date} tarihindeki kayıtlı analizler açıldı.`}

  const oldRender=window.render;
  window.render=function(){if(state.tab==='history'){renderAnalysisHistory();return;}oldRender();};

  const oldScan=window.scan;
  window.scan=async function(){
    const d=selectedDateISO();const today=todayISO();
    if(d<today){const h=getHistory();if(h[d]){loadHistory(d);return;}state.analyses=[];render();document.querySelector('#scanState').textContent='Bu tarih için daha önce kaydedilmiş analiz yok.';return;}
    await oldScan();putHistory(d,state.analyses);captureFinished().catch(()=>{});
  };

  function addHistoryTab(){
    const tabs=[...document.querySelectorAll('.tabs')].find(x=>x.querySelector('[data-tab="coupons"]'));if(!tabs||tabs.querySelector('[data-tab="history"]'))return;
    const b=document.createElement('button');b.className='tab';b.dataset.tab='history';b.textContent='Geçmiş Analizler';b.onclick=()=>{tabs.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.tab='history';window.render();};tabs.appendChild(b);
  }
  function cleanUi(){
    document.title=`GoalGrid ${VERSION}`;const sub=document.querySelector('.subtitle');if(sub)sub.textContent=`Futbol Karar Motoru • ${VERSION}`;
    document.querySelectorAll('.sectionTitle').forEach(t=>{if(t.textContent.trim()==='VERİ KAYNAKLARI')t.closest('.section')?.remove();});
    addHistoryTab();
  }
  function toggleOdds(index){document.querySelector(`#manualOdds_${index}`)?.classList.toggle('hidden')}

  window.GoalGrid111={toggleOdds,saveOdd,showInjuries,showStats,loadHistory};
  window.addEventListener('DOMContentLoaded',()=>{cleanUi();captureFinished().catch(()=>{});});
})();
