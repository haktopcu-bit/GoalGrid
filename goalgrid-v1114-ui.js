(()=>{
  'use strict';

  const VERSION='V1.11.4';
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=v=>`%${Math.round((Number(v)||0)*100)}`;
  const num=v=>Number.isFinite(Number(v))?Number(v).toFixed(2):'—';

  function rate(form,key){
    const c=Number(form?.count)||0;
    return c?Number(form?.[key]||0)/c:0;
  }

  function formatDate(value){
    if(!value)return '';
    const d=new Date(`${String(value).slice(0,10)}T12:00:00`);
    if(Number.isNaN(d.getTime()))return String(value).slice(0,10);
    return d.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit'});
  }

  function matchRow(m){
    const score=m?.score?.ft;
    const home=Number(score?.[0]);
    const away=Number(score?.[1]);
    const scoreText=Number.isFinite(home)&&Number.isFinite(away)?`${home} - ${away}`:'—';
    return `<div class="lastFiveRow"><span>${safe(formatDate(m?.date))}</span><b>${safe(m?.team1||'')}</b><strong>${safe(scoreText)}</strong><b>${safe(m?.team2||'')}</b></div>`;
  }

  function lastFiveHtml(a,index){
    const h=a.lastFiveHome||[];
    const d=a.lastFiveAway||[];
    const f=a.fixture;
    const team=(name,list)=>`<div class="lastFiveTeam"><div class="lastFiveTeamTitle">${safe(name)}</div>${list.length?list.map(matchRow).join(''):'<div class="muted">Son maç verisi bulunamadı.</div>'}</div>`;
    return `<div class="section"><div class="sectionTitle">SON 5 MAÇ</div><button class="secondary wide" onclick="GoalGrid114.toggleLastFive(${index})">Son 5 Maçı Aç / Kapat</button><div id="lastFive_${index}" class="hidden lastFiveBox">${team(f.teams.home.name,h)}${team(f.teams.away.name,d)}</div></div>`;
  }

  function detailedCommentary(a){
    const h=a.homeForm,d=a.awayForm,hv=a.homeVenueForm||{},av=a.awayVenueForm||{},f=a.fixture;
    const homeWin=rate(h,'wins'),awayWin=rate(d,'wins');
    const homeUnbeaten=1-rate(h,'losses'),awayUnbeaten=1-rate(d,'losses');
    const totalXg=(Number(a.homeXg)||0)+(Number(a.awayXg)||0);
    const second=a.marketRanking?.find(x=>x.name!==a.mainMarket) || a.alternative;
    const paragraphs=[];

    let p1=`${safe(f.teams.home.name)}, son ${h.count} maçta ${h.wins} galibiyet, ${h.draws} beraberlik ve ${h.losses} mağlubiyet aldı; maç başına ${num(h.ppg)} puan üretti. ${safe(f.teams.away.name)} ise aynı dönemde ${d.wins} galibiyet, ${d.draws} beraberlik ve ${d.losses} mağlubiyetle ${num(d.ppg)} maç başına puan ortalamasına ulaştı. Galibiyet oranları sırasıyla ${pct(homeWin)} ve ${pct(awayWin)}, kaybetmeme oranları ise ${pct(homeUnbeaten)} ve ${pct(awayUnbeaten)}.`;
    paragraphs.push(p1);

    if(hv.count || av.count){
      let p2=`Saha performansı genel formdan ayrı değerlendirildi. ${safe(f.teams.home.name)} iç sahada ${hv.count?num(hv.ppg):'—'} maç başına puan üretirken, ${safe(f.teams.away.name)} deplasmanda ${av.count?num(av.ppg):'—'} seviyesinde kaldı. Bu fark, özellikle 1-X-2 pazarındaki olasılık dağılımını etkiliyor; ancak tek başına karar ölçütü olarak kullanılmıyor.`;
      paragraphs.push(p2);
    }

    let p3=`Hücum ve savunma verileri birlikte okunduğunda ${safe(f.teams.home.name)} maç başına ${num(h.scored)} gol atıp ${num(h.conceded)} gol yiyor; ${safe(f.teams.away.name)} ise ${num(d.scored)} gol atıp ${num(d.conceded)} gol yiyor. Gol yemeden tamamlama oranları ${pct(h.cleanSheets)} ve ${pct(d.cleanSheets)}. Karşılıklı gol eğilimleri ${pct(h.btts)} ve ${pct(d.btts)}, 2.5 üst geçmişleri ise ${pct(h.over25)} ve ${pct(d.over25)}. Modelin toplam gol beklentisi ${totalXg.toFixed(2)}.`;
    paragraphs.push(p3);

    let p4=`Bütün bu göstergeler birlikte değerlendirildiğinde GoalGrid'in ana tercihi ${safe(a.mainMarket)} ve bu seçimin hesaplanan olasılığı ${pct(a.mainProbability)}.`;
    if(second) p4+=` İkinci sıradaki seçenek ${safe(second.name)} ve olasılığı ${pct(second.probability)}.`;
    if(a.risks?.length) p4+=` Maçın öne çıkan riskleri: ${safe(a.risks.join(', '))}.`;
    else p4+=` Mevcut örneklemde tahmini belirgin biçimde zayıflatan yapısal bir risk görünmüyor.`;
    paragraphs.push(p4);

    return `<div class="naturalCommentary">${paragraphs.map(x=>`<p>${x}</p>`).join('')}</div>`;
  }

  const previousAnalyse=window.analyseFixture;
  if(typeof previousAnalyse==='function'){
    window.analyseFixture=function(fixture,history,sourceNames){
      const a=previousAnalyse(fixture,history,sourceNames);
      if(!a?.homeForm||!a?.awayForm)return a;
      const date=String(fixture.fixture?.date||'').slice(0,10);
      const h=fixture.teams.home,d=fixture.teams.away;
      try{
        a.lastFiveHome=lastMatches(h.name,h.id,history,date).slice(0,5);
        a.lastFiveAway=lastMatches(d.name,d.id,history,date).slice(0,5);
      }catch{
        a.lastFiveHome=[];
        a.lastFiveAway=[];
      }
      return a;
    };
  }

  const previousMatchCard=window.matchCard;
  if(typeof previousMatchCard==='function'){
    window.matchCard=function(a,index){
      const html=previousMatchCard(a,index);
      if(!a?.homeForm)return html;
      const box=document.createElement('div');
      box.innerHTML=html;

      for(const section of [...box.querySelectorAll('.section')]){
        const title=section.querySelector('.sectionTitle')?.textContent?.trim();
        if(['MODEL KALİTESİ','YORUM','NEDEN BU TAHMİN?','DETAYLI MAÇ YORUMU','MAÇ BİLGİLERİ'].includes(title)) section.remove();
      }

      const profile=[...box.querySelectorAll('.section')].find(s=>s.querySelector('.sectionTitle')?.textContent?.trim()==='FORM & MAÇ PROFİLİ');
      if(profile){
        [...profile.querySelectorAll('.muted')].forEach(el=>{
          if(el.textContent.includes('Solda ev sahibi')) el.remove();
        });
      }

      const oddsSection=[...box.querySelectorAll('.section')].find(s=>[...s.querySelectorAll('button')].some(b=>b.textContent.includes('Oranları Aç / Kapat')));
      const insertBefore=oddsSection || null;

      const comment=document.createElement('div');
      comment.className='section';
      comment.innerHTML=`<div class="sectionTitle">DETAYLI MAÇ YORUMU</div>${detailedCommentary(a)}`;

      const last=document.createElement('div');
      last.innerHTML=lastFiveHtml(a,index);
      const lastSection=last.firstElementChild;

      if(insertBefore){
        insertBefore.parentNode.insertBefore(lastSection,insertBefore);
        insertBefore.parentNode.insertBefore(comment,lastSection);
      }else{
        box.firstElementChild?.appendChild(comment);
        box.firstElementChild?.appendChild(lastSection);
      }

      return box.innerHTML;
    };
  }

  function toggleLastFive(index){
    document.querySelector(`#lastFive_${index}`)?.classList.toggle('hidden');
  }

  function applyCss(){
    if(document.querySelector('#goalgrid-v1114-style'))return;
    const style=document.createElement('style');
    style.id='goalgrid-v1114-style';
    style.textContent=`
      .naturalCommentary{color:var(--muted);font-size:12px;line-height:1.78}
      .naturalCommentary p{margin:0 0 12px}
      .naturalCommentary p:last-child{margin-bottom:0}
      .lastFiveBox{margin-top:9px;padding:10px;background:#0b1523;border:1px solid #213149;border-radius:12px}
      .lastFiveTeam+.lastFiveTeam{margin-top:14px;padding-top:13px;border-top:1px solid #24324a}
      .lastFiveTeamTitle{font-weight:900;margin-bottom:8px;color:#dcecff}
      .lastFiveRow{display:grid;grid-template-columns:48px minmax(0,1fr) 52px minmax(0,1fr);gap:7px;align-items:center;padding:7px 0;border-top:1px solid rgba(36,50,74,.6);font-size:11px}
      .lastFiveRow:first-of-type{border-top:0}
      .lastFiveRow span{color:var(--muted)}
      .lastFiveRow b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .lastFiveRow strong{text-align:center;color:var(--text)}
      @media(max-width:520px){.lastFiveRow{grid-template-columns:42px minmax(0,1fr) 46px minmax(0,1fr);gap:5px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  window.GoalGrid114={toggleLastFive};
  window.addEventListener('DOMContentLoaded',()=>{
    applyCss();
    document.title=`GoalGrid ${VERSION}`;
    const sub=document.querySelector('.subtitle');
    if(sub)sub.textContent=`Futbol Karar Motoru • ${VERSION}`;
  });
})();
