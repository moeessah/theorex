(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.08});
document.querySelectorAll('.reveal,.reveal-left,.reveal-right').forEach(el=>io.observe(el));

const roleList=document.querySelector('.role-list');
if(roleList){
  const roleItems=[...roleList.querySelectorAll('.role-item')];
  const roleIO=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting){
      roleItems.forEach((item,n)=>setTimeout(()=>item.classList.add('lit'),n*155));
      roleIO.unobserve(e.target);
    }
  }),{threshold:.4});
  roleIO.observe(roleList);
}

/* header contrast + theme */
const header=document.getElementById('siteHeader');
setTimeout(()=>header?.classList.add('in'),reduce?0:420);
let themeIO=null;
const updateThemeControl=()=>{
  const theme=document.documentElement.dataset.theme==='light'?'light':'dark';
  const toggle=document.getElementById('themeToggle');
  if(toggle){
    const light=theme==='light';
    toggle.setAttribute('aria-pressed',String(light));
    toggle.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');
  }
};
const isDarkForHeader=(section)=>{
  const light=document.documentElement.dataset.theme==='light';
  return light ? section.matches('.people,footer') : !section.matches('.signal');
};
const observeHeaderTheme=()=>{
  if(!header)return;
  if(themeIO)themeIO.disconnect();
  const targets=[...document.querySelectorAll('.hero,.shift,.thesis,.signal,.people,footer')];
  themeIO=new IntersectionObserver(entries=>{
    entries.forEach(e=>e.target.dataset.onHeader=e.isIntersecting?'1':'0');
    const dark=targets.some(section=>section.dataset.onHeader==='1' && isDarkForHeader(section));
    header.classList.toggle('on-dark',dark);
  },{rootMargin:'-20px 0px -88% 0px'});
  targets.forEach(section=>themeIO.observe(section));
};
const themeToggle=document.getElementById('themeToggle');
const setTheme=(theme,save=true)=>{
  const next=theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=next;
  if(save){try{localStorage.setItem('theorex-theme',next);}catch(e){}}
  updateThemeControl();
  observeHeaderTheme();
};
updateThemeControl();
if(themeToggle)themeToggle.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='light'?'dark':'light',true));
observeHeaderTheme();

/* programme carousel */
const carousel=document.querySelector('[data-carousel]');
if(carousel){
  const pills=[...carousel.querySelectorAll('.pill')];
  const slides=[...carousel.querySelectorAll('.slide')];
  const playBtn=carousel.querySelector('[data-play]');
  const arrows=[...carousel.querySelectorAll('.carousel-arrow')];
  let active=0,timer=null,playing=false;

  const render=(i,timed)=>{
    active=(i+slides.length)%slides.length;
    pills.forEach((p,n)=>{const isActive=n===active;p.classList.toggle('active',isActive);p.classList.toggle('timed',isActive&&!!timed);p.setAttribute('aria-selected',isActive)});
    slides.forEach((s,n)=>s.classList.toggle('active',n===active));
  };
  const stop=()=>{clearInterval(timer);timer=null;playing=false;playBtn.classList.add('is-paused');playBtn.setAttribute('aria-label','Resume automatic sequence')};
  const start=()=>{if(reduce)return;clearInterval(timer);playing=true;playBtn.classList.remove('is-paused');playBtn.setAttribute('aria-label','Pause automatic sequence');timer=setInterval(()=>render(active+1,true),4200)};

  pills.forEach(p=>{
    const i=+p.dataset.index;
    p.addEventListener('mouseenter',()=>render(i));
    p.addEventListener('click',()=>{render(i);start()});
    p.addEventListener('focus',()=>render(i));
  });
  arrows.forEach(a=>a.addEventListener('click',()=>{render(active+ +a.dataset.dir);start()}));
  playBtn.addEventListener('click',()=>playing?stop():start());

  render(0);
  if(reduce){playBtn.classList.add('is-paused');playBtn.setAttribute('aria-label','Resume automatic sequence');}
  const progIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){start();progIO.unobserve(e.target)}}),{threshold:.4});
  progIO.observe(carousel);
}

/* people portraits - stable loupe: pointerleave clears it once, avoiding pointerout bubbling glitches. */
const peopleRoot=document.querySelector('[data-people-carousel]');
if(peopleRoot){
  peopleRoot.addEventListener('pointermove',e=>{
    const photo=e.target.closest('.people-photo');
    peopleRoot.querySelectorAll('.people-photo.is-loupe').forEach(p=>{if(p!==photo)p.classList.remove('is-loupe')});
    if(!photo)return;
    const r=photo.getBoundingClientRect();
    photo.style.setProperty('--spot-x',Math.max(0,Math.min(r.width,e.clientX-r.left))+'px');
    photo.style.setProperty('--spot-y',Math.max(0,Math.min(r.height,e.clientY-r.top))+'px');
    photo.classList.add('is-loupe');
  });
  peopleRoot.addEventListener('pointerleave',()=>peopleRoot.querySelectorAll('.people-photo.is-loupe').forEach(p=>p.classList.remove('is-loupe')));
}

/* people carousel - loop the cards in both directions without exposing an edge */
const peopleCarousel=peopleRoot;
if(peopleCarousel){
  const track=peopleCarousel.querySelector('.people-track');
  const original=[...track.children];
  const total=original.length;
  const before=document.createDocumentFragment();
  const cloneCard=card=>{
    const clone=card.cloneNode(true);
    clone.setAttribute('aria-hidden','true');
    clone.querySelectorAll('img').forEach(img=>{img.setAttribute('alt','');img.setAttribute('aria-hidden','true');});
    return clone;
  };
  original.forEach(c=>before.appendChild(cloneCard(c)));
  track.insertBefore(before,track.firstChild);
  original.forEach(c=>track.appendChild(cloneCard(c)));

  const pPlay=peopleCarousel.querySelector('[data-play]');
  const pArrows=[...peopleCarousel.querySelectorAll('.carousel-arrow')];
  const pIndex=peopleCarousel.querySelector('.people-index');
  let step=total,pTimer=null;

  const cardStep=()=>{
    const first=track.children[0];
    const gap=parseFloat(getComputedStyle(track).columnGap)||24;
    return first.getBoundingClientRect().width+gap;
  };
  const place=animate=>{
    track.style.transition=animate?'transform .6s var(--ease)':'none';
    track.style.transform=`translateX(-${cardStep()*step}px)`;
  };
  const pRender=dir=>{
    step+=dir;
    place(true);
    const n=((step-total)%total+total)%total;
    if(pIndex)pIndex.textContent=String(n+1).padStart(2,'0')+' / '+String(total).padStart(2,'0');
    if(step>=total*2){setTimeout(()=>{step-=total;place(false)},600)}
    else if(step<total){setTimeout(()=>{step+=total;place(false)},600)}
  };
  const pStop=()=>{clearInterval(pTimer);pTimer=null;pPlay.classList.add('is-paused');pPlay.setAttribute('aria-label','Resume automatic sequence')};
  const pStart=()=>{if(reduce)return;clearInterval(pTimer);pPlay.classList.remove('is-paused');pPlay.setAttribute('aria-label','Pause automatic sequence');pTimer=setInterval(()=>pRender(1),4200)};

  pArrows.forEach(a=>a.addEventListener('click',()=>{pRender(+a.dataset.dir);pStart()}));
  pPlay.addEventListener('click',()=>pTimer?pStop():pStart());
  window.addEventListener('resize',()=>place(false));

  place(false);
  if(pIndex)pIndex.textContent='01 / '+String(total).padStart(2,'0');
  const peopleIO=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting){pStart();}else{pStop();}
  }),{threshold:.2});
  peopleIO.observe(peopleCarousel);
}

const lazyVideos=[...document.querySelectorAll('video[data-src]')].filter(v=>!v.closest('.hero-media-inline'));
if(lazyVideos.length){
  const videoIO=new IntersectionObserver(es=>es.forEach(e=>{
    const video=e.target;
    if(e.isIntersecting){
      if(!video.src){video.src=video.dataset.src;video.load();}
      if(!reduce)video.play().catch(()=>{});
    }else{
      video.pause();
    }
  }),{rootMargin:'240px 0px',threshold:.15});
  lazyVideos.forEach(video=>videoIO.observe(video));
}

const contactForm=document.getElementById('contactForm');
if(contactForm){
  contactForm.addEventListener('submit',e=>{
    e.preventDefault();
    const input=contactForm.querySelector('.pill-contact-input');
    if(!input.checkValidity()){input.reportValidity();return;}
    const email=input.value.trim();
    if(!email)return;
    window.location.href='mailto:hello@theorex.org?subject='+encodeURIComponent('Research problem')+'&body='+encodeURIComponent('I would like to talk about a research problem. My email is '+email+'.');
    input.value='';
  });
}
})();
