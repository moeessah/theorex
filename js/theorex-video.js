/* Video homepage hero only. */
const heroVid=document.querySelector('.hero-media-inline video');
if(heroVid){
  let reverseFrame=0,lastT=null;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loadHeroVideo=()=>{
    if(heroVid.src)return true;
    const src=heroVid.dataset.src;
    if(!src)return false;
    heroVid.src=src;heroVid.load();return true;
  };
  const reverseStep=now=>{
    if(reduce){reverseFrame=0;lastT=null;return;}
    if(lastT===null)lastT=now;
    const dt=Math.min((now-lastT)/1000,.05);lastT=now;
    heroVid.currentTime=Math.max(0,heroVid.currentTime-dt);
    if(heroVid.currentTime<=0.03){lastT=null;heroVid.currentTime=0;heroVid.play().catch(()=>{});reverseFrame=0;}
    else reverseFrame=requestAnimationFrame(reverseStep);
  };
  heroVid.addEventListener('ended',()=>{
    if(reduce)return;
    heroVid.pause();lastT=null;cancelAnimationFrame(reverseFrame);reverseFrame=requestAnimationFrame(reverseStep);
  });
  if(loadHeroVideo()&&!reduce)heroVid.play().catch(()=>{});
}
