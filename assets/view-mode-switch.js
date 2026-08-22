(function(){
  const STORAGE_KEY='hrtechify:view-mode';
  const media=window.matchMedia('(max-width:1024px)');
  const valid=new Set(['compact','wide']);

  function readStored(){
    try{const value=localStorage.getItem(STORAGE_KEY);return valid.has(value)?value:null;}catch(_){return null;}
  }
  function systemMode(){return media.matches?'compact':'wide';}
  function currentMode(){const mode=document.documentElement.dataset.viewMode;return valid.has(mode)?mode:(readStored()||systemMode());}
  function updateButtons(mode){
    document.querySelectorAll('[data-view-mode-choice]').forEach((button)=>{
      const selected=button.getAttribute('data-view-mode-choice')===mode;
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  function applyMode(mode,{persist=false}={}){
    if(!valid.has(mode))return;
    document.documentElement.dataset.viewMode=mode;
    if(document.body)document.body.dataset.viewMode=mode;
    if(persist){try{localStorage.setItem(STORAGE_KEY,mode);}catch(_){}}
    updateButtons(mode);
    window.dispatchEvent(new CustomEvent('hrtechify:viewmodechange',{detail:{mode}}));
  }
  function bind(){
    document.querySelectorAll('[data-view-mode-choice]').forEach((button)=>{
      button.addEventListener('click',()=>applyMode(button.getAttribute('data-view-mode-choice'),{persist:true}));
    });
    updateButtons(currentMode());
  }
  function init(){
    applyMode(currentMode());
    bind();
    const handleAutoChange=()=>{if(!readStored())applyMode(systemMode());};
    if(typeof media.addEventListener==='function')media.addEventListener('change',handleAutoChange);
    else if(typeof media.addListener==='function')media.addListener(handleAutoChange);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();