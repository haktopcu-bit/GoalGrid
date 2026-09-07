(()=>{
  'use strict';

  const VERSION='V1.11.1';
  const SOFA_CACHE='goalgrid_sofa_history_v1111_';
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=v=>`%${Math.round((Number(v)||0)*100)}`;
  const num=v=>Number.isFinite(Number(v))?Number(v).toFixed(2):'—';

  async function loadSofaHistory(teamName){
    if(!teamName) return [];
    const key=SOFA_CACHE+normalizeText(teamName);
    try{
      const cached=JSON.parse(localStorage.getItem(key)||'null');
      if(cached && Date.now()-cached.time<6*60*60*1000) return cached.matches||[];
    }catch{}

    try{
      const response=await fetch(`/sofa-history?team=${encodeURIComponent(teamName)}`,{cache:'no-store'});
      const json=await response.json();
      if(!response.ok || !json.ok) return [];
      const matches=(json.matches||[])
        .filter(x=>x?.team1 && x?.team2 && completed(x))
        .map(x=>({...x,team1Id:null,team2Id:null,source:'Sofascore'}));
      try{localStorage.setItem(key,JSON.stringify({time:Date.now(),matches}));}catch{}
      return matches;
    }catch{
      return [];
    }
  }

  const currentBuild=window.buildFixtureHistory;
  if(typeof currentBuild==='function'){
    window.buildFixtureHistory=async function(fixture){
      const base=await currentBuild(fixture);
      const groups=[base.matches||[]];
      const sources=[...(base.sources||[])];
      const errors=[...(base.errors||[])];
      const date=String(fixture.fixture?.date||'').slice(0,10);
      const home=fixture.teams?.home;
      const away=fixture.teams?.away;

      let merged=mergeMatches(...groups);
      let hc=lastMatches(home?.name,home?.id,merged,date).length;
      let ac=lastMatches(away?.name,away?.id,merged,date).length;

      // Özellikle UEFA maçlarında desteklenmeyen yerel ligler ve isim/ID farkları için
      // takım adına göre bağımsız Sofascore geçmişi kullanılır.
      if(hc<8 || ac<8){
        const [hs,as]=await Promise.all([
          hc<8?loadSofaHistory(home?.name):Promise.resolve([]),
          ac<8?loadSofaHistory(away?.name):Promise.resolve([])
        ]);
        if(hs.length){groups.push(hs);sources.push(`Sofascore ${home.name} (${hs.length})`);}
        if(as.length){groups.push(as);sources.push(`Sofascore ${away.name} (${as.length})`);}
        merged=mergeMatches(...groups);
        hc=lastMatches(home?.name,home?.id,merged,date).length;
        ac=lastMatches(away?.name,away?.id,merged,date).length;
      }

      if((hc<2 || ac<2) && !errors.some(x=>String(x).includes('Sofascore'))){
        errors.push(`Sofascore fallback sonrası kullanılabilir geçmiş: ${home?.name||'Ev'} ${hc}, ${away?.name||'Dep'} ${ac}`);
      }
      return {matches:merged,sources:[...new Set(sources)],errors};
    };
  }

  const currentAnalyse=window.analyseFixture;
  if(typeof currentAnalyse==='function'){
    window.analyseFixture=function(fixture,history,sourceNames){
      const a=currentAnalyse(fixture,history,sourceNames);
      if(!a?.homeForm || !a?.awayForm) return a;
      const date=String(fixture.fixture?.date||'').slice(0,10);
      const h=fixture.teams.home,d=fixture.teams.away;
      const homeVenueMatches=lastMatches(h.name,h.id,history,date,'home');
      const awayVenueMatches=lastMatches(d.name,d.id,history,date,'away');
      a.homeVenueForm=formStats(h.name,h.id,homeVenueMatches);
      a.awayVenueForm=formStats(d.name,d.id,awayVenueMatches);
      a.formEdge=(a.homeForm.ppg-a.awayForm.ppg);
      a.venueEdge=(a.homeVenueForm.ppg-a.awayVenueForm.ppg);
      return a;
    };
  }

  function rate(form,key){
    const c=Number(form?.count)||0;
    return c?Number(form?.[key]||0)/c:0;
  }

  function profileStatsHtml(a){
    if(!a?.homeForm || !a?.awayForm) return '';
    const h=a.homeForm,d=a.awayForm,hv=a.homeVenueForm||{},av=a.awayVenueForm||{};
    const row=(label,left,right)=>`<div class="metric"><small>${label}</small><b>${left} / ${right}</b></div>`;
    return `<div class="section"><div class="sectionTitle">FORM & MAÇ PROFİLİ</div><div class="grid2">
      ${row('Maç başına puan',num(h.ppg),num(d.ppg))}
      ${row('Galibiyet oranı',pct(rate(h,'wins')),pct(rate(d,'wins')))}
      ${row('Kaybetmeme oranı',pct(1-rate(h,'losses')),pct(1-rate(d,'losses')))}
      ${row('İç saha / deplasman PPG',hv.count?num(hv.ppg):'—',av.count?num(av.ppg):'—')}
      ${row('Gol yemeden bitirme',pct(h.cleanSheets),pct(d.cleanSheets))}
      ${row('KG Var eğilimi',pct(h.btts),pct(d.btts))}
      ${row('2.5 Üst eğilimi',pct(h.over25),pct(d.over25))}
      ${row('Son sonuçlar',`${h.wins}G ${h.draws}B ${h.losses}M`,`${d.wins}G ${d.draws}B ${d.losses}M`)}
    </div><div class="muted" style="margin-top:7px">Solda ev sahibi, sağda deplasman takımı. Yorum; yalnızca gol ortalamasına değil form, puan üretimi, galibiyet/kaybetmeme, saha profili, savunma temizliği, istikrar ve pazar uyumuna birlikte bakar.</div></div>`;
  }

  function detailedCommentary(a){
    const h=a.homeForm,d=a.awayForm,hv=a.homeVenueForm||{},av=a.awayVenueForm||{},f=a.fixture;
    const homeWin=rate(h,'wins'),awayWin=rate(d,'wins');
    const homeUnb=1-rate(h,'losses'),awayUnb=1-rate(d,'losses');
    const second=a.marketRanking?.find(x=>x.name!==a.mainMarket) || a.alternative;
    const parts=[];

    parts.push(`<b>Form:</b> ${safe(f.teams.home.name)} son ${h.count} maçta ${h.wins}G-${h.draws}B-${h.losses}M ve ${num(h.ppg)} PPG; ${safe(f.teams.away.name)} ${d.wins}G-${d.draws}B-${d.losses}M ve ${num(d.ppg)} PPG. Galibiyet oranları ${pct(homeWin)} / ${pct(awayWin)}, kaybetmeme oranları ${pct(homeUnb)} / ${pct(awayUnb)}.`);

    if(hv.count || av.count){
      parts.push(`<b>Saha etkisi:</b> ev sahibinin iç saha PPG'si ${hv.count?num(hv.ppg):'—'}, deplasman takımının dış saha PPG'si ${av.count?num(av.ppg):'—'}. Bu ayrım genel formdan farklıysa 1-X-2 yorumunda saha performansına ekstra temkin uygulanır.`);
    }

    parts.push(`<b>Savunma ve direnç:</b> gol yemeden bitirme oranları ${pct(h.cleanSheets)} / ${pct(d.cleanSheets)}. Model istikrarı ${a.stability}/100, oynaklık ${a.volatility}/100; yani sonuç profilinin ne kadar düzenli veya sürprize açık olduğu ayrıca hesaba katılıyor.`);

    parts.push(`<b>Gol profili:</b> KG Var geçmişi ${pct(h.btts)} / ${pct(d.btts)}, 2.5 Üst geçmişi ${pct(h.over25)} / ${pct(d.over25)}. Beklenen toplam gol ${(a.homeXg+a.awayXg).toFixed(2)}; bu bölüm tek başına karar değil, form ve saha profiliyle birlikte kullanılıyor.`);

    parts.push(`<b>Karar:</b> ana seçim <b>${safe(a.mainMarket)}</b> (${pct(a.mainProbability)}).${second?` İkinci seçenek <b>${safe(second.name)}</b> (${pct(second.probability)}).`:''} Model/tarihsel veri uyumu ${a.agreement}/100, veri kalitesi ${a.quality}/100.`);

    if(a.risks?.length) parts.push(`<b>Risk:</b> ${safe(a.risks.join(' • '))}.`);
    else parts.push(`<b>Risk:</b> mevcut örneklemde belirgin yapısal risk işareti yok.`);

    return `<div class="muted" style="line-height:1.75">${parts.map(x=>`<div style="margin-bottom:8px">${x}</div>`).join('')}</div>`;
  }

  const oldMatchCard=window.matchCard;
  if(typeof oldMatchCard==='function'){
    window.matchCard=function(a,index){
      const html=oldMatchCard(a,index);
      if(!a?.homeForm) return html;
      const box=document.createElement('div');
      box.innerHTML=html;

      // Eski, ağırlıkla gol odaklı kısa yorumu kaldırıp çok boyutlu yorum ekle.
      for(const section of [...box.querySelectorAll('.section')]){
        const title=section.querySelector('.sectionTitle')?.textContent?.trim();
        if(title==='YORUM' || title==='NEDEN BU TAHMİN?' || title==='SON 10 İSTATİSTİK ÖZETİ') section.remove();
      }

      const sections=[...box.querySelectorAll('.section')];
      const marketSection=sections.find(s=>s.querySelector('.sectionTitle')?.textContent?.trim()==='1 • X • 2 OLASILIKLARI');
      if(marketSection){
        const holder=document.createElement('div');
        holder.innerHTML=profileStatsHtml(a);
        const profile=holder.firstElementChild;
        if(profile) marketSection.parentNode.insertBefore(profile,marketSection.nextSibling);
      }

      const oddsButton=[...box.querySelectorAll('button')].find(b=>b.textContent.includes('Oranları Aç / Kapat'));
      const anchor=oddsButton?.closest('.section') || [...box.querySelectorAll('.section')].find(s=>s.querySelector('.sectionTitle')?.textContent?.trim()==='RİSKLER');
      if(anchor){
        const comment=document.createElement('div');
        comment.className='section';
        comment.innerHTML=`<div class="sectionTitle">DETAYLI MAÇ YORUMU</div>${detailedCommentary(a)}`;
        anchor.parentNode.insertBefore(comment,anchor);
      }

      return box.innerHTML;
    };
  }

  window.addEventListener('DOMContentLoaded',()=>{
    document.title=`GoalGrid ${VERSION}`;
    const sub=document.querySelector('.subtitle');
    if(sub) sub.textContent=`Futbol Karar Motoru • ${VERSION}`;
  });
})();
