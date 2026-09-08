(()=>{
  'use strict';

  const VERSION='V1.11.5';
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const ALIASES={
    inter:'inter',internazionale:'inter',intermilano:'inter',fcinternazionale:'inter',fcinternazionalemilano:'inter',internazionalemilano:'inter',
    realmadrid:'realmadrid',realmadridcf:'realmadrid',
    manchestercity:'manchestercity',manchestercityfc:'manchestercity',mancity:'manchestercity',
    manchesterunited:'manchesterunited',manchesterunitedfc:'manchesterunited',manutd:'manchesterunited',
    borussiadortmund:'borussiadortmund',dortmund:'borussiadortmund',bvbdortmund:'borussiadortmund',
    borussiamonchengladbach:'borussiamonchengladbach',borussiamgladbach:'borussiamonchengladbach',monchengladbach:'borussiamonchengladbach',gladbach:'borussiamonchengladbach',
    bayernmunich:'bayernmunich',bayernmunchen:'bayernmunich',fcbayernmunchen:'bayernmunich',
    acmilan:'acmilan',milan:'acmilan',
    juventus:'juventus',juventusfc:'juventus',
    barcelona:'barcelona',fcbarcelona:'barcelona',
    atletico:'atleticomadrid',atleticomadrid:'atleticomadrid',atleticodemadrid:'atleticomadrid',
    parisstgermain:'psg',parissaintgermain:'psg',psg:'psg',
    fcporto:'porto',porto:'porto'
  };

  function canonical(name){
    let x=String(name||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
    x=x.replace(/^(fc|cf|ac|sc|fk|sk)/,'').replace(/(fc|cf|ac|sc|fk|sk)$/,'');
    return ALIASES[x]||x;
  }

  function strictSameName(a,b){
    const x=canonical(a),y=canonical(b);
    if(!x||!y)return false;
    return x===y;
  }

  window.sameTeamName=strictSameName;
  window.sameTeam=function(targetName,targetId,matchName,matchId){
    const hasTarget=targetId!==null&&targetId!==undefined&&targetId!=='';
    const hasMatch=matchId!==null&&matchId!==undefined&&matchId!=='';
    if(hasTarget&&hasMatch) return Number(targetId)===Number(matchId);
    return strictSameName(targetName,matchName);
  };

  const previousBuild=window.buildFixtureHistory;
  if(typeof previousBuild==='function'){
    window.buildFixtureHistory=async function(fixture){
      const base=await previousBuild(fixture);
      const date=String(fixture.fixture?.date||'').slice(0,10);
      const id=Number(fixture.league?.id);
      const lname=String(fixture.league?.name||'').toLowerCase();
      const isUefa=[2,3,848].includes(id)||lname.includes('champions league')||lname.includes('europa league')||lname.includes('conference league');
      if(!isUefa) return base;

      const groups=[base.matches||[]];
      const sources=[...(base.sources||[])];
      const errors=[...(base.errors||[])];
      const home=fixture.teams.home,away=fixture.teams.away;

      let merged=mergeMatches(...groups);
      let hc=lastMatches(home.name,home.id,merged,date).length;
      let ac=lastMatches(away.name,away.id,merged,date).length;

      if(hc<5||ac<5){
        const codes=['PL','ELC','BL1','SA','PD','FL1','DED','PPL'];
        const settled=await Promise.allSettled(codes.map(code=>loadFootballData(code)));
        let added=0;
        settled.forEach((r,i)=>{
          if(r.status==='fulfilled'&&r.value?.length){groups.push(r.value);added+=r.value.length;}
          else if(r.status==='rejected') errors.push(`football-data.org ${codes[i]}: ${r.reason?.message||r.reason}`);
        });
        if(added) sources.push(`football-data.org Avrupa lig havuzu (${added})`);
        merged=mergeMatches(...groups);
        hc=lastMatches(home.name,home.id,merged,date).length;
        ac=lastMatches(away.name,away.id,merged,date).length;
      }

      if(hc<5&&home.id){
        try{const h=await loadTeamHistory(home.id);if(h.length){groups.push(h);sources.push(`API-Football ${home.name} (${h.length})`);}}catch(e){errors.push(`${home.name}: ${e.message}`)}
      }
      if(ac<5&&away.id){
        try{const a=await loadTeamHistory(away.id);if(a.length){groups.push(a);sources.push(`API-Football ${away.name} (${a.length})`);}}catch(e){errors.push(`${away.name}: ${e.message}`)}
      }

      merged=mergeMatches(...groups);
      return {matches:merged,sources:[...new Set(sources)],errors};
    };
  }

  function teamPerspective(match,teamName,teamId){
    const ft=match?.score?.ft;
    if(!Array.isArray(ft)||ft.length<2)return null;
    const home=window.sameTeam(teamName,teamId,match.team1,match.team1Id);
    const away=window.sameTeam(teamName,teamId,match.team2,match.team2Id);
    if(!home&&!away)return null;
    const gf=Number(home?ft[0]:ft[1]);
    const ga=Number(home?ft[1]:ft[0]);
    if(!Number.isFinite(gf)||!Number.isFinite(ga))return null;
    return {gf,ga,result:gf>ga?'G':gf===ga?'B':'M',home};
  }

  function summarize(list,teamName,teamId){
    const rows=(list||[]).map(m=>({m,p:teamPerspective(m,teamName,teamId)})).filter(x=>x.p).slice(0,5);
    const s={g:0,b:0,m:0,attigi:0,yedigi:0};
    rows.forEach(x=>{s.attigi+=x.p.gf;s.yedigi+=x.p.ga;if(x.p.result==='G')s.g++;else if(x.p.result==='B')s.b++;else s.m++;});
    return {rows,s};
  }

  const previousAnalyse=window.analyseFixture;
  if(typeof previousAnalyse==='function'){
    window.analyseFixture=function(fixture,history,sourceNames){
      const a=previousAnalyse(fixture,history,sourceNames);
      if(!a?.homeForm||!a?.awayForm)return a;
      const date=String(fixture.fixture?.date||'').slice(0,10);
      const h=fixture.teams.home,d=fixture.teams.away;
      a.lastFiveHome=lastMatches(h.name,h.id,history,date).filter(m=>window.sameTeam(h.name,h.id,m.team1,m.team1Id)||window.sameTeam(h.name,h.id,m.team2,m.team2Id)).slice(0,5);
      a.lastFiveAway=lastMatches(d.name,d.id,history,date).filter(m=>window.sameTeam(d.name,d.id,m.team1,m.team1Id)||window.sameTeam(d.name,d.id,m.team2,m.team2Id)).slice(0,5);
      return a;
    };
  }

  function dateText(v){
    if(!v)return'';
    const d=new Date(`${String(v).slice(0,10)}T12:00:00`);
    return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit'});
  }

  function rowHtml(m,teamName,teamId){
    const p=teamPerspective(m,teamName,teamId);
    const ft=m?.score?.ft||[];
    const homeWin=Number(ft[0])>Number(ft[1]);
    const awayWin=Number(ft[1])>Number(ft[0]);
    const cls=p?.result==='G'?'lastFiveWin':p?.result==='M'?'lastFiveLoss':'lastFiveDraw';
    return `<div class="lastFiveRow ${cls}"><span>${safe(dateText(m?.date))}</span><b class="${homeWin?'winner':''}">${safe(m?.team1||'')}</b><strong>${safe(`${ft?.[0]??'—'} - ${ft?.[1]??'—'}`)}</strong><b class="${awayWin?'winner':''}">${safe(m?.team2||'')}</b></div>`;
  }

  function teamBlock(name,id,list){
    const {rows,s}=summarize(list,name,id);
    const title=`${safe(name)} <span class="lastFiveSummary">(${s.g}G-${s.b}B-${s.m}M) (${s.attigi}A-${s.yedigi}Y)</span>`;
    return `<div class="lastFiveTeam"><div class="lastFiveTeamTitle">${title}</div>${rows.length?rows.map(x=>rowHtml(x.m,name,id)).join(''):'<div class="muted">Son maç verisi bulunamadı.</div>'}</div>`;
  }

  function replaceLastFive(a,index,box){
    const f=a.fixture;
    const old=[...box.querySelectorAll('.section')].find(s=>s.querySelector('.sectionTitle')?.textContent?.trim()==='SON 5 MAÇ');
    if(!old)return;
    old.innerHTML=`<div class="sectionTitle">SON 5 MAÇ</div><button class="secondary wide" onclick="GoalGrid114.toggleLastFive(${index})">Son 5 Maçı Aç / Kapat</button><div id="lastFive_${index}" class="hidden lastFiveBox">${teamBlock(f.teams.home.name,f.teams.home.id,a.lastFiveHome||[])}${teamBlock(f.teams.away.name,f.teams.away.id,a.lastFiveAway||[])}</div>`;
  }

  const previousCard=window.matchCard;
  if(typeof previousCard==='function'){
    window.matchCard=function(a,index){
      const html=previousCard(a,index);
      if(!a?.homeForm)return html;
      const box=document.createElement('div');box.innerHTML=html;
      replaceLastFive(a,index,box);
      return box.innerHTML;
    };
  }

  function css(){
    if(document.querySelector('#goalgrid-v1115-style'))return;
    const s=document.createElement('style');s.id='goalgrid-v1115-style';s.textContent=`
      .lastFiveTeamTitle{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
      .lastFiveSummary{font-size:10px;color:#9fb1c8;font-weight:800}
      .lastFiveRow{border-radius:8px;padding-left:6px;padding-right:6px;margin:2px 0}
      .lastFiveRow.lastFiveWin{background:rgba(110,231,183,.08)}
      .lastFiveRow.lastFiveDraw{background:rgba(147,197,253,.05)}
      .lastFiveRow.lastFiveLoss{background:rgba(251,113,133,.04)}
      .lastFiveRow b.winner{color:#eef4ff;background:#1b2d43;border-radius:6px;padding:3px 5px;font-weight:900}
    `;document.head.appendChild(s);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    css();
    document.title=`GoalGrid ${VERSION}`;
    const sub=document.querySelector('.subtitle');if(sub)sub.textContent=`Futbol Karar Motoru • ${VERSION}`;
  });
})();
