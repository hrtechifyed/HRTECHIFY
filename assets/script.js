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
