(function(){
  const scriptEl=document.currentScript||Array.from(document.scripts).find(s=>(s.getAttribute('src')||'').includes('assets/script.js'));
  const scriptSrc=(scriptEl&&scriptEl.getAttribute('src'))||'assets/script.js';
  const rootPrefix=scriptSrc.replace(/assets\/script\.js(?:[?#].*)?$/,'');
  const withRoot=(path)=>/^(?:https?:)?\/\//i.test(path)||path.startsWith('#')?path:`${rootPrefix}${path}`;

  function ensureStylesheet(id,path){
    if(document.getElementById(id))return;
    const link=document.createElement('link');
    link.id=id;
    link.rel='stylesheet';
    link.href=withRoot(path);
    document.head.appendChild(link);
  }

  ensureStylesheet('hrtechify-brand-styles','assets/brand-logo.css');
  ensureStylesheet('hrtechify-mobile-styles','assets/mobile-symmetry.css');
  ensureStylesheet('hrtechify-visual-refresh','assets/visual-refresh.css');
  ensureStylesheet('hrtechify-linkedin-graph','assets/linkedin-graph.css');
  document.documentElement.classList.add('js');

  const linkedinUrl='https://www.linkedin.com/company/hrtechifyed';
  const linkedinIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 7.6H1.7V22h3.5V7.6ZM3.45 1.5A2.04 2.04 0 1 0 3.46 5.6a2.04 2.04 0 0 0-.01-4.1ZM22 13.7c0-4.34-2.32-6.36-5.42-6.36-2.5 0-3.62 1.37-4.24 2.34V7.6H8.86V22h3.48v-7.13c0-1.88.36-3.7 2.69-3.7 2.3 0 2.33 2.15 2.33 3.82V22H22v-8.3Z"/></svg>';

  if(!document.querySelector(`link[rel="me"][href="${linkedinUrl}"]`)){
    const relMe=document.createElement('link');
    relMe.rel='me';
    relMe.href=linkedinUrl;
    document.head.appendChild(relMe);
  }

  if(!document.getElementById('hrtechify-org-schema')){
    const schema=document.createElement('script');
    schema.id='hrtechify-org-schema';
    schema.type='application/ld+json';
    schema.textContent=JSON.stringify({
      '@context':'https://schema.org',
      '@type':'Organization',
      'name':'HRTechify',
      'url':'https://hrtechify.com/',
      'logo':'https://hrtechify.com/assets/hrtechify-logo.png',
      'sameAs':[linkedinUrl]
    });
    document.head.appendChild(schema);
  }

  const currentFile=(location.pathname.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
  const activeKey=currentFile==='index.html'?'home':currentFile==='products.html'?'products':currentFile==='insights.html'||location.pathname.includes('/insights/')?'insights':currentFile==='about.html'?'about':'';
  const header=document.querySelector('.site-header');
  if(header){
    header.innerHTML=`<div class="shell header-inner">
      <a class="brand" href="${withRoot('index.html')}" aria-label="HRTechify home"><img class="brand-logo-image" src="${withRoot('assets/hrtechify-logo.png')}" alt="HRTechify"></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open navigation"><span></span><span></span><span></span></button>
      <nav id="site-nav" class="site-nav" aria-label="Primary navigation">
        <a href="${withRoot('index.html')}"${activeKey==='home'?' aria-current="page"':''}>Home</a>
        <a href="${withRoot('index.html#for-people')}">For People</a>
        <a href="${withRoot('index.html#for-organizations')}">For Organizations</a>
        <a href="${withRoot('products.html')}"${activeKey==='products'?' aria-current="page"':''}>Products</a>
        <a href="${withRoot('insights.html')}"${activeKey==='insights'?' aria-current="page"':''}>Insights</a>
        <a href="${withRoot('about.html')}"${activeKey==='about'?' aria-current="page"':''}>About</a>
        <a class="button button-small" href="${withRoot('index.html#audiences')}">Explore HRTechify</a>
        <a class="linkedin-nav-link" href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" aria-label="HRTechify on LinkedIn">${linkedinIcon}<span>LinkedIn</span></a>
      </nav>
    </div>`;
  }

  document.querySelectorAll('.founder-portrait img, img[alt*="Anurag Sinha"]').forEach(img=>{
    img.src=withRoot('assets/founder-anurag-sinha.png');
    img.alt='Anurag Sinha, Founder of HRTechify';
    img.removeAttribute('srcset');
  });

  const textWalker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const textNodes=[];
  while(textWalker.nextNode())textNodes.push(textWalker.currentNode);
  textNodes.forEach(node=>{
    node.nodeValue=node.nodeValue.replace(/GrowWith\s+HR/g,'GrowWithHR').replace(/Growwith\s*HR/g,'GrowWithHR');
  });

  document.querySelectorAll('.footer-brand').forEach(brand=>{
    brand.innerHTML=`<img class="brand-logo-image" src="${withRoot('assets/hrtechify-logo.png')}" alt="HRTechify">`;
  });

  const footerIntro=document.querySelector('.site-footer .footer-grid > div:first-child');
  if(footerIntro&&!footerIntro.querySelector('.footer-linkedin')){
    const linkedIn=document.createElement('a');
    linkedIn.className='footer-linkedin';
    linkedIn.href=linkedinUrl;
    linkedIn.target='_blank';
    linkedIn.rel='noopener noreferrer';
    linkedIn.innerHTML=`${linkedinIcon}<span>HRTechify on LinkedIn ↗</span>`;
    footerIntro.appendChild(linkedIn);
  }

  document.querySelectorAll('.footer-base span').forEach(span=>{
    if(/Context before judg|Evidence before conclu/i.test(span.textContent||''))span.remove();
  });

  const menuButton=document.querySelector('.menu-toggle');
  const nav=document.querySelector('#site-nav');
  if(menuButton&&nav){
    menuButton.addEventListener('click',()=>{
      const open=menuButton.getAttribute('aria-expanded')==='true';
      menuButton.setAttribute('aria-expanded',String(!open));
      menuButton.setAttribute('aria-label',open?'Open navigation':'Close navigation');
      nav.classList.toggle('is-open',!open);
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      menuButton.setAttribute('aria-expanded','false');
      nav.classList.remove('is-open');
    }));
  }

  const graph=document.querySelector('.ptg-map');
  if(graph){
    const explainer=graph.querySelector('#graph-explainer');
    const messages={
      people:'People drive trust, experience and culture.',
      technology:'Technology brings structure, speed and intelligence.',
      growth:'Growth happens when people and technology work together.',
      centre:'Organizations need both intelligence and empathy to grow.'
    };
    graph.querySelectorAll('.graph-trigger').forEach(trigger=>{
      trigger.addEventListener('click',()=>{
        graph.querySelectorAll('.graph-trigger').forEach(item=>item.setAttribute('aria-pressed','false'));
        trigger.setAttribute('aria-pressed','true');
        const key=trigger.dataset.graphKey;
        if(explainer&&messages[key])explainer.textContent=messages[key];
      });
    });
  }

  const carousel=document.querySelector('.showcase-carousel');
  if(carousel&&carousel.children.length){
    const controls=document.createElement('div');
    controls.className='showcase-controls';
    controls.innerHTML='<button class="showcase-control" type="button" data-dir="-1" aria-label="Previous product preview">←</button><button class="showcase-control" type="button" data-dir="1" aria-label="Next product preview">→</button>';
    carousel.insertAdjacentElement('afterend',controls);
    controls.addEventListener('click',e=>{
      const button=e.target.closest('[data-dir]');
      if(!button)return;
      const dir=Number(button.dataset.dir)||1;
      const slide=carousel.querySelector('.showcase-slide');
      const gap=parseFloat(getComputedStyle(carousel).columnGap||getComputedStyle(carousel).gap||0)||0;
      const amount=((slide?slide.getBoundingClientRect().width:carousel.clientWidth)+gap)*dir;
      carousel.scrollBy({left:amount,behavior:'smooth'});
    });
  }

  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced&&'IntersectionObserver'in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target);}
      });
    },{threshold:.12});
    document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  }else{
    document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible'));
  }

  function track(eventName,detail={}){
    window.hrtechifyDataLayer=window.hrtechifyDataLayer||[];
    window.hrtechifyDataLayer.push({event:eventName,...detail,timestamp:new Date().toISOString()});
    window.dispatchEvent(new CustomEvent('hrtechify:analytics',{detail:{event:eventName,...detail}}));
  }

  document.querySelectorAll('[data-event]').forEach(el=>el.addEventListener('click',()=>track(el.dataset.event,{href:el.getAttribute('href')})));

  const contactForm=document.querySelector('#contact-form');
  if(contactForm){
    contactForm.addEventListener('submit',e=>{
      e.preventDefault();
      const status=document.querySelector('#form-status');
      if(!contactForm.reportValidity())return;
      track('contact_submit',{reason:contactForm.reason&&contactForm.reason.value,mode:'not-configured'});
      if(status)status.textContent='This build does not yet have a live submission endpoint. Configure the approved form provider before production launch.';
    });
  }
})();

/* Refined animated People • Technology • Growth system */
(function(){
  const scriptEl=document.currentScript||Array.from(document.scripts).find(s=>(s.getAttribute('src')||'').includes('assets/script.js'));
  const scriptSrc=(scriptEl&&scriptEl.getAttribute('src'))||'assets/script.js';
  const rootPrefix=scriptSrc.replace(/assets\/script\.js(?:[?#].*)?$/,'');
  if(!document.getElementById('hrtechify-ptg-motion')){
    const link=document.createElement('link');
    link.id='hrtechify-ptg-motion';
    link.rel='stylesheet';
    link.href=`${rootPrefix}assets/ptg-motion.css`;
    document.head.appendChild(link);
  }

  const graph=document.querySelector('.ptg-map');
  if(!graph)return;
  const svg=graph.querySelector('.graph-lines');
  const explainer=graph.querySelector('#graph-explainer');
  if(!svg||!explainer)return;

  const NS='http://www.w3.org/2000/svg';
  const messages={
    people:{title:'People',body:'People drive trust, experience and culture.'},
    technology:{title:'Technology',body:'Brings structure, speed, and intelligence.'},
    growth:{title:'Growth',body:'Growth happens when people and technology work together.'},
    centre:{title:'Intelligence + Empathy',body:'Organizations need both intelligence and empathy to grow.'}
  };
  const anchorData=[
    {key:'growth',x:300,y:80},
    {key:'people',x:120,y:392},
    {key:'technology',x:480,y:392}
  ];

  function makeSvg(tag,attrs={}){
    const el=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  }

  const anchorGroup=makeSvg('g',{'class':'graph-anchor-group','aria-hidden':'true'});
  const anchorEls=new Map();
  anchorData.forEach(({key,x,y})=>{
    const ring=makeSvg('circle',{'class':'graph-anchor-ring',cx:x,cy:y,r:16});
    const dot=makeSvg('circle',{'class':'graph-anchor',cx:x,cy:y,r:6,'data-graph-key':key});
    anchorGroup.append(ring,dot);
    anchorEls.set(key,dot);
  });
  svg.appendChild(anchorGroup);

  const motionGroup=makeSvg('g',{'class':'graph-motion-group','aria-hidden':'true'});
  const trail=[];
  for(let i=0;i<5;i++){
    const circle=makeSvg('circle',{'class':'graph-trail-dot',r:Math.max(2.4,5.4-i*.65),cx:300,cy:80});
    motionGroup.appendChild(circle);
    trail.push(circle);
  }
  const movingDot=makeSvg('circle',{'class':'graph-motion-dot',r:7,cx:300,cy:80});
  motionGroup.appendChild(movingDot);
  svg.appendChild(motionGroup);

  const centreSvg=graph.querySelector('.map-centre svg');
  if(centreSvg&&!centreSvg.querySelector('.brain-sparks')){
    centreSvg.insertAdjacentHTML('beforeend','<g class="brain-sparks" aria-hidden="true"><path d="M20 20 L12 14"></path><path d="M18 34 L8 34"></path><path d="M21 49 L12 56"></path><circle class="brain-neuron" cx="40" cy="25" r="2.2"></circle><circle class="brain-neuron" cx="47" cy="38" r="2"></circle><circle class="brain-neuron" cx="39" cy="50" r="1.8"></circle></g>');
  }

  let manualUntil=0;
  let hideTimer=0;
  const triggers=Array.from(graph.querySelectorAll('.graph-trigger'));

  function renderTooltip(key,manual=false){
    const message=messages[key];
    if(!message)return;
    if(!manual&&Date.now()<manualUntil)return;
    window.clearTimeout(hideTimer);
    if(manual)manualUntil=Date.now()+3200;
    graph.dataset.activeNode=key;
    graph.dataset.tooltipVisible='true';
    explainer.innerHTML=`<strong>${message.title}</strong><span>${message.body}</span>`;
    triggers.forEach(trigger=>trigger.setAttribute('aria-pressed',String(trigger.dataset.graphKey===key)));
    anchorEls.forEach((anchor,anchorKey)=>anchor.classList.toggle('is-active',anchorKey===key));
  }

  function hideTooltip(delay=0){
    window.clearTimeout(hideTimer);
    hideTimer=window.setTimeout(()=>{
      if(Date.now()<manualUntil)return;
      graph.dataset.tooltipVisible='false';
      anchorEls.forEach(anchor=>anchor.classList.remove('is-active'));
      triggers.forEach(trigger=>trigger.setAttribute('aria-pressed','false'));
    },delay);
  }

  triggers.forEach(trigger=>{
    const key=trigger.dataset.graphKey;
    const message=messages[key];
    if(message)trigger.setAttribute('aria-label',`${message.title}: ${message.body}`);
    trigger.addEventListener('mouseenter',()=>renderTooltip(key,true));
    trigger.addEventListener('focus',()=>renderTooltip(key,true));
    trigger.addEventListener('click',()=>renderTooltip(key,true));
    trigger.addEventListener('mouseleave',()=>hideTooltip(420));
    trigger.addEventListener('blur',()=>hideTooltip(420));
  });

  const outer=Array.from(svg.querySelectorAll('.triangle-edge'));
  const inner=Array.from(svg.querySelectorAll('.centre-link'));
  if(outer.length<3||inner.length<3)return;

  const routes=[
    {path:outer[0],reverse:false,arrive:'people'},
    {path:outer[1],reverse:false,arrive:'technology'},
    {path:outer[2],reverse:false,arrive:'growth'},
    {path:inner[0],reverse:true,arrive:'centre'},
    {path:inner[1],reverse:false,arrive:'people'},
    {path:inner[1],reverse:true,arrive:'centre'},
    {path:inner[2],reverse:false,arrive:'technology'},
    {path:inner[2],reverse:true,arrive:'centre'},
    {path:inner[0],reverse:false,arrive:'growth'}
  ];

  const history=[];
  function placeMotion(point){
    movingDot.setAttribute('cx',point.x);
    movingDot.setAttribute('cy',point.y);
    history.unshift({x:point.x,y:point.y});
    if(history.length>55)history.length=55;
    const offsets=[4,8,13,19,26];
    trail.forEach((circle,index)=>{
      const past=history[Math.min(offsets[index],history.length-1)]||point;
      circle.setAttribute('cx',past.x);
      circle.setAttribute('cy',past.y);
    });
  }

  function wait(ms){return new Promise(resolve=>window.setTimeout(resolve,ms));}
  function animatePath(route){
    const length=route.path.getTotalLength();
    const duration=Math.max(900,length*4.4);
    return new Promise(resolve=>{
      let start=null;
      function frame(now){
        if(start===null)start=now;
        const progress=Math.min(1,(now-start)/duration);
        const distance=route.reverse?length*(1-progress):length*progress;
        placeMotion(route.path.getPointAtLength(distance));
        if(progress<1)requestAnimationFrame(frame);else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){
    motionGroup.style.display='none';
    return;
  }

  (async function runSignal(){
    placeMotion({x:300,y:80});
    await wait(650);
    while(document.documentElement.contains(graph)){
      for(const route of routes){
        hideTooltip();
        await animatePath(route);
        renderTooltip(route.arrive,false);
        await wait(route.arrive==='centre'?620:1100);
        hideTooltip();
        await wait(140);
      }
    }
  })();
})();
