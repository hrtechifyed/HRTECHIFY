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
  ensureStylesheet('hrtechify-ptg-motion','assets/ptg-motion.css');
  ensureStylesheet('hrtechify-final-polish','assets/final-polish.css');
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
      name:'HRTechify',
      url:'https://hrtechify.com/',
      logo:'https://hrtechify.com/assets/hrtechify-logo.png',
      sameAs:[linkedinUrl]
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

  const footer=document.querySelector('.site-footer');
  if(footer){
    footer.innerHTML=`<div class="shell simple-footer">
      <a class="footer-wordmark" href="${withRoot('index.html')}">HRTechify</a>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="${withRoot('about.html')}">About</a>
        <a href="${withRoot('privacy.html')}">Privacy</a>
        <a href="${withRoot('contact.html')}">Contact</a>
      </nav>
      <p class="footer-copyright">© 2026 HRTechify. All rights reserved.</p>
    </div>`;
  }

  document.querySelectorAll('.founder-portrait img, img[alt*="Anurag Sinha"]').forEach(img=>{
    img.src=withRoot('assets/founder-anurag-sinha.png');
    img.alt='Anurag Sinha, Founder of HRTechify';
    img.removeAttribute('srcset');
  });

  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const textNodes=[];
  while(walker.nextNode())textNodes.push(walker.currentNode);
  textNodes.forEach(node=>{
    node.nodeValue=node.nodeValue.replace(/GrowWith\s+HR/g,'GrowWithHR').replace(/Growwith\s*HR/g,'GrowWithHR');
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
    let visual=graph.parentElement;
    if(!visual.classList.contains('hero-visual')){
      const wrapper=document.createElement('div');
      wrapper.className='hero-visual reveal';
      graph.parentNode.insertBefore(wrapper,graph);
      wrapper.appendChild(graph);
      graph.classList.remove('reveal');
      visual=wrapper;
    }

    const centre=graph.querySelector('.map-centre');
    const centreSvg=centre&&centre.querySelector('svg');
    if(centreSvg){
      centreSvg.setAttribute('viewBox','0 0 160 90');
      centreSvg.innerHTML=`
        <g class="brain-symbol" aria-hidden="true">
          <path class="brain-outline" d="M42 15c-10-8-24-2-24 10-9 2-12 13-7 20-6 8-1 20 9 22 0 10 12 15 20 9 7 7 19 2 19-8V27c0-9-9-15-17-12Z"></path>
          <path class="brain-fold" d="M31 24c-7 2-9 9-5 14M43 20c7 5 5 14-1 17M24 47c6-5 13-3 16 3M43 43c8 1 11 8 8 14M29 62c7 0 12 4 12 10"></path>
        </g>
        <line class="symbol-divider" x1="78" y1="18" x2="78" y2="72"></line>
        <path class="heart-symbol" aria-hidden="true" d="M116 73 107 65C84 45 88 24 101 20c8-3 14 1 19 8 5-7 11-11 19-8 13 4 17 25-6 45l-9 8-4 4-4-4Z"></path>`;
    }

    if(centre){
      centre.setAttribute('aria-label','Intelligence and empathy: organizations need both to grow.');
    }

    if(!visual.querySelector('.emblem-logic')){
      const logic=document.createElement('div');
      logic.className='emblem-logic';
      logic.innerHTML='<strong>Why this emblem?</strong><p>People and technology reinforce each other. Guided by empathy and intelligence, they create the conditions for meaningful organizational growth. The arrows show that this relationship is continuous and two-way.</p>';
      visual.appendChild(logic);
    }

    const messages={
      people:'People: People drive trust, experience and culture.',
      technology:'Technology: Technology brings structure, speed and intelligence.',
      growth:'Growth: Growth happens when people and technology work together.',
      centre:'Intelligence + Empathy: Organizations need both intelligence and empathy to grow.'
    };
    graph.querySelectorAll('.graph-trigger').forEach(trigger=>{
      const key=trigger.dataset.graphKey;
      if(messages[key])trigger.setAttribute('aria-label',messages[key]);
      trigger.addEventListener('click',()=>{
        graph.querySelectorAll('.graph-trigger').forEach(item=>item.setAttribute('aria-pressed','false'));
        trigger.setAttribute('aria-pressed','true');
        graph.dataset.activeNode=key||'';
      });
    });

    const svg=graph.querySelector('.graph-lines');
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(svg&&!reduced){
      const NS='http://www.w3.org/2000/svg';
      svg.querySelectorAll('.graph-motion-group,.graph-anchor-group').forEach(el=>el.remove());

      const anchors=[['growth',300,80],['people',120,392],['technology',480,392]];
      const anchorGroup=document.createElementNS(NS,'g');
      anchorGroup.setAttribute('class','graph-anchor-group');
      anchorGroup.setAttribute('aria-hidden','true');
      anchors.forEach(([,x,y])=>{
        const ring=document.createElementNS(NS,'circle');
        ring.setAttribute('class','graph-anchor-ring');ring.setAttribute('cx',x);ring.setAttribute('cy',y);ring.setAttribute('r','16');
        const dot=document.createElementNS(NS,'circle');
        dot.setAttribute('class','graph-anchor');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','6');
        anchorGroup.append(ring,dot);
      });
      svg.appendChild(anchorGroup);

      const motionGroup=document.createElementNS(NS,'g');
      motionGroup.setAttribute('class','graph-motion-group');
      motionGroup.setAttribute('aria-hidden','true');
      const trail=[];
      for(let i=0;i<5;i++){
        const c=document.createElementNS(NS,'circle');
        c.setAttribute('class','graph-trail-dot');
        c.setAttribute('r',String(Math.max(2.4,5.4-i*.65)));
        c.setAttribute('cx','300');c.setAttribute('cy','80');
        motionGroup.appendChild(c);trail.push(c);
      }
      const movingDot=document.createElementNS(NS,'circle');
      movingDot.setAttribute('class','graph-motion-dot');movingDot.setAttribute('r','7');movingDot.setAttribute('cx','300');movingDot.setAttribute('cy','80');
      motionGroup.appendChild(movingDot);svg.appendChild(motionGroup);

      const outer=Array.from(svg.querySelectorAll('.triangle-edge'));
      const inner=Array.from(svg.querySelectorAll('.centre-link'));
      const routes=[];
      if(outer.length>=3){
        routes.push({path:outer[0],reverse:false},{path:outer[1],reverse:false},{path:outer[2],reverse:false});
      }
      if(inner.length>=3){
        routes.push({path:inner[0],reverse:true},{path:inner[1],reverse:false},{path:inner[1],reverse:true},{path:inner[2],reverse:false},{path:inner[2],reverse:true},{path:inner[0],reverse:false});
      }

      if(routes.length&&typeof routes[0].path.getTotalLength==='function'){
        let routeIndex=0;
        let routeStart=performance.now();
        let history=[];
        const routeDuration=1800;
        const pause=180;
        function draw(ts){
          const route=routes[routeIndex];
          const elapsed=ts-routeStart;
          const raw=Math.max(0,Math.min(1,elapsed/routeDuration));
          const progress=route.reverse?1-raw:raw;
          const len=route.path.getTotalLength();
          const point=route.path.getPointAtLength(len*progress);
          movingDot.setAttribute('cx',point.x);movingDot.setAttribute('cy',point.y);
          history.unshift({x:point.x,y:point.y});
          if(history.length>18)history.pop();
          trail.forEach((dot,i)=>{
            const h=history[Math.min(history.length-1,(i+1)*3)]||point;
            dot.setAttribute('cx',h.x);dot.setAttribute('cy',h.y);
          });
          if(raw>=1){
            routeIndex=(routeIndex+1)%routes.length;
            routeStart=ts+pause;
            history=[];
          }
          requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
      }
    }
  }

  const carousel=document.querySelector('.showcase-carousel');
  if(carousel&&carousel.children.length&&!document.querySelector('.showcase-controls')){
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

  document.querySelectorAll('[data-year]').forEach(el=>el.textContent='2026');

  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reducedMotion&&'IntersectionObserver'in window){
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
