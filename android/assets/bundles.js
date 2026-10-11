/* Community Center requirements and donations. Unknown status remains unknown; no donation commands. */
(()=>{'use strict';
const T={zh:{building:'正在读取收集包…',unsupported:'当前收集包格式暂不支持',unavailable:'暂时无法读取收集包',update:'更新配套模组后查看收集包',joja:'这个存档已选择 Joja 路线',empty:'没有可显示的收集包',complete:'已完成',unknown:'捐赠状态未知',progress:'{n} / {t}',choose:'任选 {n} 项',donated:'已捐赠',needed:'未捐赠',reward:'奖励',rewardUnknown:'奖励资料暂不支持',quality:'品质',silver:'银星',gold:'金星',iridium:'铱星',category:'类别 {n}',stale:'资料正在更新，暂显示上次结果'},
en:{building:'Reading bundles…',unsupported:'This bundle format is not supported',unavailable:'Bundles are unavailable right now',update:'Update the companion mod to view bundles',joja:'This save follows the Joja route',empty:'No bundles to show',complete:'Completed',unknown:'Donation status unknown',progress:'{n} / {t}',choose:'Choose any {n}',donated:'Donated',needed:'Not donated',reward:'Reward',rewardUnknown:'Reward information is not supported',quality:'Quality',silver:'Silver',gold:'Gold',iridium:'Iridium',category:'Category {n}',stale:'Updating; showing the previous result'}};
const w=(k,v={})=>((T[lang]||T.en)[k]||k).replace(/\{(\w)\}/g,(_,x)=>v[x]??'');
function itemOf(id){return db?.[lang]?.items.find(i=>i.id===id);}
function art(id){return icons.get(id)||itemOf(id)?.icon||'art/gift.png';}
function count(b){return Math.min(b.required,b.items.filter(i=>i.donated===true).length);}
function bar(n,total){const b=el('span','collection-bar'),fill=el('span','collection-fill');fill.style.width=(total?100*n/total:0)+'%';b.append(fill);b.setAttribute('aria-hidden','true');return b;}
function itemRow(i,ui,reward=false){const item=itemOf(i.id),hidden=i.id&&!!window.Spoiler?.enabled('items')&&!window.Spoiler.itemKnown(i.id),b=ui.button('',()=>ui.openItem(i.id),'bundle-item');
 b.dataset.bundleItem=i.id||i.currency||String(i.category);b.dataset.donated=String(i.donated);b.disabled=!item||hidden;
 const face=img(i.currency==='money'?'art/hud-coin.svg':art(i.id));if(hidden)face.classList.add('spoiler-silhouette');
 const name=i.currency==='money'?String(i.count):hidden?'???':item?.name||(i.category!=null?w('category',{n:i.category}):i.id);
 const copy=el('span','bundle-item-copy');copy.append(el('strong','',name));
 if(i.currency!=='money'){const meta=['× '+i.count],quality={1:'silver',2:'gold',4:'iridium'}[i.quality];if(i.quality)meta.push(quality?w(quality):w('quality')+' '+i.quality);copy.append(el('small','',factRow(meta)));}
 b.append(face,copy);if(!reward){const mark=img(i.donated===true?'art/check-on.png':i.donated===false?'art/check-off.png':'art/quest-normal.png');mark.className='bundle-donation';mark.alt=w(i.donated===true?'donated':i.donated===false?'needed':'unknown');b.append(mark);b.setAttribute('aria-label',name+' · '+mark.alt);}return b;
}
function detail(host,b,ui){const head=el('div','directory-head');head.append(img('art/gift.png'),el('h2','journal-title',b.name));host.append(head);
 host.append(el('p','directory-note',b.complete===true?w('complete'):b.complete==null?w('unknown'):w('progress',{n:count(b),t:b.required})),bar(count(b),b.required));
 if(b.required<b.items.length)host.append(el('p','directory-note',w('choose',{n:b.required})));
 const grid=el('div','bundle-items');for(const i of b.items)grid.append(itemRow(i,ui));host.append(grid);
 host.append(el('h3','section-title',w('reward')));if(b.reward.state!=='ready')host.append(el('p','directory-note',w('rewardUnknown')));
 else{const rewards=el('div','bundle-items');for(const i of b.reward.items)rewards.append(itemRow(i,ui,true));host.append(rewards);}
}
function render(host,view,ui){const data=LiveData.need('bundles'),status=LiveData.status('bundles'),connection=StateBox.connection('art/gift.png');if(connection){host.append(connection);return;}
 if(!data||data.state!=='ready'){host.append(el('p','journal-empty',w(data?.state==='joja'?'joja':status||'update')));return;}
 if(status&&status!=='ready')host.append(el('p','directory-note',w(status)+(lang==='zh'?'，':'; ')+w('stale')));
 if(view.detailId?.startsWith('bundle:')){const id=Number(view.detailId.slice(7)),b=data.rooms.flatMap(r=>r.bundles).find(b=>b.id===id);if(b)detail(host,b,ui);else host.append(el('p','journal-empty',w('empty')));return;}
 
 if(!data.rooms.length){host.append(el('p','journal-empty',w('empty')));return;}
 for(const room of data.rooms){const section=el('section','bundle-room'),heading=el('div','bundle-room-head'),done=room.bundles.filter(b=>b.complete===true).length;heading.append(img('art/gift.png'),el('h2','journal-title',room.name),el('span','directory-tag',w('progress',{n:done,t:room.bundles.length})));section.append(heading,bar(done,room.bundles.length));
  const grid=el('div','bundle-grid');for(const b of room.bundles){const button=ui.button('',()=>ui.go('bundles','bundle:'+b.id),'bundle-card');button.dataset.bundle=String(b.id);button.append(img(b.complete===true?'art/check-on.png':'art/gift.png'),el('strong','',b.name),el('small','',b.complete==null?w('unknown'):w('progress',{n:count(b),t:b.required})),bar(count(b),b.required));grid.append(button);}section.append(grid);host.append(section);}
}
const base=window.render;window.render=function(){if(page==='manual'&&window.Journal?.getState().section==='bundles')LiveData.need('bundles');base();};
window.Bundles={render,stateKey:()=>[LiveData.peek('bundles')?.version,LiveData.peek('bundles')?.language,LiveData.status('bundles'),window.Spoiler?.enabled('items'),window.Spoiler?.version(),lang]};
})();
