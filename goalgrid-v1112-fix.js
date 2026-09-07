(()=>{
  'use strict';

  const oldMatchCard = window.matchCard;
  if (typeof oldMatchCard !== 'function') return;

  const pct = v => `%${Math.round((Number(v)||0)*100)}`;
  const num = v => Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '—';

  function basicStatsHtml(a){
    if(!a?.homeForm || !a?.awayForm) return '';
    const h=a.homeForm, d=a.awayForm;
    const row=(label,ev,dep)=>`<div class="metric"><small>${label}</small><b>${ev} / ${dep}</b></div>`;
    return `<div class="section"><div class="sectionTitle">SON 10 İSTATİSTİK ÖZETİ</div><div class="grid2">
      ${row('Maç başı gol',num(h.scored),num(d.scored))}
      ${row('Maç başı yenilen gol',num(h.conceded),num(d.conceded))}
      ${row('KG Var',h.btts!=null?pct(h.btts):'—',d.btts!=null?pct(d.btts):'—')}
      ${row('2.5 Üst',h.over25!=null?pct(h.over25):'—',d.over25!=null?pct(d.over25):'—')}
    </div><div class="muted" style="margin-top:6px">Solda ev sahibi, sağda deplasman takımı.</div></div>`;
  }

  window.matchCard=function(a,index){
    const html=oldMatchCard(a,index);
    if(!a?.homeForm) return html;

    const box=document.createElement('div');
    box.innerHTML=html;

    for(const section of [...box.querySelectorAll('.section')]){
      const title=section.querySelector('.sectionTitle')?.textContent?.trim();
      if(title==='MODEL KALİTESİ') section.remove();
    }

    const info=[...box.querySelectorAll('.section')].find(s=>s.querySelector('.sectionTitle')?.textContent?.trim()==='MAÇ BİLGİLERİ');
    if(info){
      const holder=document.createElement('div');
      holder.innerHTML=basicStatsHtml(a);
      const stats=holder.firstElementChild;
      if(stats) info.parentNode.insertBefore(stats,info);
    }

    return box.innerHTML;
  };
})();
