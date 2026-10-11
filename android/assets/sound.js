// Android SoundPool sonification, deliberately no AudioManager focus requests.
(()=>{'use strict';let enabled=localStorage.getItem('stardew.sound')!=='off';const audio=new Map();
 function play(cue){if(!enabled||document.hidden)return;if(window.ThorCommands){ThorCommands.play(cue);return;}let a=audio.get(cue);if(!a){a=new Audio('audio/'+cue+'.wav');a.volume=.25;audio.set(cue,a);}a.currentTime=0;a.play().catch(()=>{});}
 const row=document.querySelector('.sound-row'),toggle=document.createElement('button');row.querySelector('.tag').replaceWith(toggle);toggle.id='sound-toggle';
 const original=translate;translate=function(){original();toggle.textContent=ft(enabled?'on':'off');toggle.dataset.checked=String(enabled);};
 toggle.onclick=()=>{enabled=!enabled;localStorage.setItem('stardew.sound',enabled?'on':'off');translate();if(enabled)play('smallSelect');};
 // Capture before a click handler replaces its own row/detail. Slots have their
 // own tap/drag recognizer; its accepted gestures, not synthetic clicks, play.
 document.addEventListener('click',e=>{const b=window.ThorFeedback?.control(e.target)||e.target.closest?.('button,summary,select');if(!b||b.matches(':disabled,[aria-disabled=true]')||b.closest('[inert]')||b.matches('.slot')||b.id==='sound-toggle'||b.matches('#page-back,#person-back,#guide-back,.journal-toolbar .journal-back')||(window.ThorFeedback&&!ThorFeedback.shouldSound(e,b)))return;if(b.closest('.tabs'))play('bigSelect');else if(b.id.includes('back')||b.matches('.dialog-buttons>button:first-child,[data-cue=cancel]')||b.matches('summary')&&b.parentElement.open)play('cancel');else play('smallSelect');},true);
 window.ThorSound={play,get enabled(){return enabled;}};translate();
})();
