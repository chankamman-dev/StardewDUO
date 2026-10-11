/* Portraits only: reject solid/transparent placeholder PNGs, retain source-specific
   validation, and recover from a missing image without an unbounded retry loop. */
(()=>{'use strict';
const checked=new Map(),limit=512;
function usable(image){const src=image.getAttribute('src');if(checked.has(src))return checked.get(src);
 let ok=true;try{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0,32,32);const pixels=g.getImageData(0,0,32,32).data;let visible=false,varied=false;for(let i=0;i<pixels.length;i+=4){visible||=pixels[i+3]>0;for(let j=0;j<4;j++)varied||=pixels[i+j]!==pixels[j];}ok=visible&&varied;}catch{/* A cross-origin restriction is not proof of a blank portrait. */}
 if(checked.size>=limit)checked.delete(checked.keys().next().value);checked.set(src,ok);return ok;
}
// A view rebuilt and morphed onto the screen (view-nodes.js) copies this image's attributes, inline style
// and handlers onto the image already shown. So the handlers act on the element they fire on, and a
// source already known to be good is never hidden: a morph must not hide a portrait that will not load again.
function attach(image,sources){const candidates=[...new Set(sources.filter(Boolean))],key=JSON.stringify(candidates);if(image.dataset.portraitCandidates===key)return image;image.dataset.portraitCandidates=key;let at=0;
 function next(target){while(at<candidates.length&&checked.get(candidates[at])===false)at++;if(at>=candidates.length){target.onload=target.onerror=null;target.removeAttribute('src');target.alt='?';target.style.visibility='visible';return;}
  const src=candidates[at++];target.style.visibility=checked.get(src)===true?'visible':'hidden';target.src=src;}
 image.onload=e=>{const t=e.currentTarget;if(!usable(t))next(t);else t.style.visibility='visible';};image.onerror=e=>next(e.currentTarget);next(image);return image;
}
function sources(person,small=false){const fallback=person&&!person.runtime?'art/'+(small?'mugshots/':'portraits/')+person.id+'.png':'art/icon-people.png';return small?[person?.liveMapAvatar,person?.livePortrait,person?.catalogPortrait,fallback]:[person?.livePortrait,person?.catalogPortrait,person?.liveMapAvatar,fallback];}
function person(person,small=false){return attach(img(''),sources(person,small));}
window.PortraitImages={attach,sources,person};
})();
