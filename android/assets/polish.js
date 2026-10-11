// Content improvements share the approved frame, type scale and original sprites.
(()=>{'use strict';let activeSession=null,lastActive=-1,followMap=false,lastPlayer='',detailKey='';
const pager=document.querySelector('.inventory-bottom');$('slots').before(pager);
const scrollCue=el('span','detail-scroll-cue','⌄');scrollCue.setAttribute('aria-hidden','true');$('detail').after(scrollCue);
function hint(){const d=$('detail');scrollCue.hidden=d.hidden||d.scrollHeight<=d.clientHeight+3||d.scrollTop+d.clientHeight>=d.scrollHeight-3;}
$('detail').addEventListener('scroll',hint);new ResizeObserver(hint).observe($('detail'));
const follow=el('button','map-follow');follow.append(img('art/map-reset.svg'));$('map-fit').before(follow);
follow.onclick=()=>{const p=model.snapshot?.tracking?.player;if(model.status(performance.now())!=='ready'||!p)return;followMap=!followMap;if(followMap){currentRegion=p.region;mapSignature='';renderLiveMap();window.MapView?.center(p.x,p.y);}render();};
$('map-viewport').addEventListener('mapgesture',()=>{followMap=false;follow.setAttribute('aria-pressed','false');});
for(const id of ['map-fit','map-zoom'])$(id).addEventListener('click',()=>followMap=false);regions.addEventListener('change',()=>followMap=false);
const base=render;render=function(){const s=model.snapshot,ready=model.status(performance.now())==='ready',a=s?.control?.activeSlot;
 if(activeSession!==s?.session){activeSession=s?.session;lastActive=-1;followMap=false;lastPlayer='';}
 // Follow actual handpad changes, but never replace a pending touch/drag intention.
 if(ready&&Number.isInteger(a)&&a>=0&&a<s.bag?.capacity&&a!==lastActive){if(!window.BagInput?.busy()){selected=a;bagPage=Math.floor(a/12);}lastActive=a;}
 base();const v=s?.bag?.slots[selected],key=s?.session+'/'+selected+'/'+v?.key;if(key!==detailKey){detailKey=key;$('detail').scrollTop=0;}
 const local=window.LocalMap?.active();follow.disabled=!ready||!(local?s?.tracking?.playerLocal:s?.tracking?.player);const avatar=s?.tracking?.playerAvatar||'art/icon-map.png';if(follow.firstChild.getAttribute('src')!==avatar)follow.firstChild.src=avatar;follow.title=lang==='zh'?'跟随玩家':'Follow player';follow.setAttribute('aria-label',follow.title);follow.setAttribute('aria-pressed',String(local?window.LocalMap.following():followMap));
 if(page==='map'&&ready&&followMap&&!local){const p=s?.tracking?.player,k=JSON.stringify(p);if(p&&k!==lastPlayer){lastPlayer=k;if(currentRegion!==p.region){currentRegion=p.region;mapSignature='';renderLiveMap();}window.MapView?.center(p.x,p.y);}}
 requestAnimationFrame(hint);
};
const oldProfile=extendProfile;extendProfile=function(){const prev=$('person-detail').querySelector('.resident-extra'),same=!!prev&&prev.dataset.polishPerson===personId,so=same&&prev.querySelector('.schedule-fold')?.open,to=!same||prev.querySelector('.taste-fold')?.open;oldProfile();const root=$('person-detail'),facts=root.querySelector('.social-facts');if(facts){const person=db?.[lang]?.people.find(p=>p.id===personId),state=person&&socialState(person);const socialKey=JSON.stringify([lang,state]);if(state&&facts.dataset.socialKey!==socialKey){facts.dataset.socialKey=socialKey;facts.replaceChildren(daily(state));const points=el('small','social-points',state.entry?`${state.entry.points} / ${state.entry.maxHearts*250}`:words[lang].notMet);if(state.entry)facts.append(points);}}
 const social=root.querySelector('.profile-social'),copy=root.querySelector('.person-copy');if(social&&copy&&!copy.contains(social))copy.append(social);const extra=root.querySelector('.resident-extra');if(!extra)return;extra.dataset.polishPerson=personId;const schedule=extra.querySelector('.schedule-list');if(schedule&&!schedule.closest('details')){const heading=schedule.previousElementSibling,fold=el('details','schedule-fold'),summary=el('summary','',ft('schedule'));schedule.before(fold);fold.open=!!so;fold.append(summary,schedule);heading?.remove();}
 const taste=extra.querySelector('.taste-tabs');if(taste&&!taste.closest('details')){const fold=el('details','taste-fold'),summary=el('summary','',lang==='zh'?'礼物喜好':'Gift preferences'),heading=taste.previousElementSibling;heading?.replaceWith(fold);fold.open=!!to;fold.append(summary);let n=taste;while(n){const next=n.nextElementSibling;fold.append(n);n=next;}}
};
render();
})();
