/* glass motion: one transform, one element, one animation loop. Dragging never competes with CSS animation.
   Self-contained: this file is loaded as its own <script> tag, so it does not rely on any variable
   declared inside theorex-shared.js (that file's `reduce` is private to its own closure).
   Hit-testing: every .glass is pointer-events:none, so by default a click or a text-selection drag passes
   straight through its transparent padding. A delegated pointerdown on the document checks an alpha map to
   decide whether the gesture is "grab the glass" or "let it hit whatever is underneath". Opaque-until-proven-
   transparent: while a piece's alpha map is still loading (or can't be read), it's treated as grabbable
   everywhere, so dragging never silently breaks - it only gets more precise once the sample is ready. */
(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const glassPieces=[...document.querySelectorAll('.glass-field .glass')];
if(glassPieces.length&&!reduce){
  const motion={active:null,pointerId:null,lastTime:performance.now()};
  const dragLayer=document.createElement('div');dragLayer.className='glass-drag-layer';document.body.appendChild(dragLayer);
  // origin point for every piece's idle drift, so the whole page's ambient motion ramps in on one shared clock
  // rather than each piece starting mid-cycle
  const idleMotionStart=performance.now()+500;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const easeOutQuint=t=>1-Math.pow(1-t,5);
  // low threshold on purpose: this is photographic glass, not a flat cutout, so its visible edges and
  // core fade smoothly rather than snapping from opaque to empty. Grabbing needs to follow that faint
  // glass all the way to where it's actually gone, or clicks fall through to the text/page underneath.
  const ALPHA_THRESHOLD=2;
  const ALPHA_SAMPLE=200;

  const alphaCache=new Map(); // src -> {data,w,h} | 'unavailable' | null(pending)
  const primeAlpha=src=>{
    if(!src||alphaCache.has(src))return;
    alphaCache.set(src,null);
    const img=new Image();
    img.onload=()=>{
      try{
        const w=ALPHA_SAMPLE,h=Math.max(1,Math.round(w*img.naturalHeight/img.naturalWidth))||w;
        const c=document.createElement('canvas');
        c.width=w;c.height=h;
        const ctx=c.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0,w,h);
        alphaCache.set(src,{data:ctx.getImageData(0,0,w,h).data,w,h});
      }catch(err){
        alphaCache.set(src,'unavailable'); // e.g. blocked by a cross-origin/file:// canvas restriction
      }
    };
    img.onerror=()=>alphaCache.set(src,'unavailable');
    img.src=src;
  };
  const isOpaqueAt=(piece,u,v)=>{
    const img=piece.querySelector('img');
    if(!img)return true;
    const src=img.currentSrc||img.src;
    const entry=alphaCache.get(src);
    if(!entry||entry==='unavailable')return true;
    const x=clamp(Math.floor(u*entry.w),0,entry.w-1);
    const y=clamp(Math.floor(v*entry.h),0,entry.h-1);
    return entry.data[(y*entry.w+x)*4+3]>ALPHA_THRESHOLD;
  };
  // the drag layer is position:fixed (viewport space), but the piece is meant to stay anchored to a point
  // on the page. If the user scrolls while dragging or while the release glide is still running, we have to
  // subtract however far the page has moved since the drag began, or the piece just hangs in place on screen
  // - visibly "sticky" - until the glide finishes and it's reparented back into normal document flow.
  const applyDragPosition=(piece,state)=>{
    const dx=window.scrollX-state.scrollX;
    const dy=window.scrollY-state.scrollY;
    piece.style.setProperty('--drag-left',`${state.originCenterX+state.x-dx}px`);
    piece.style.setProperty('--drag-top',`${state.originCenterY+state.y-dy}px`);
    piece.style.setProperty('--drag-r',`${state.baseR+state.r}deg`);
  };
  const localPoint=(piece,clientX,clientY)=>{
    const r=piece.getBoundingClientRect();
    if(r.width<=0||r.height<=0)return null;
    if(clientX<r.left||clientX>r.right||clientY<r.top||clientY>r.bottom)return null;
    return{u:(clientX-r.left)/r.width,v:(clientY-r.top)/r.height};
  };

  glassPieces.forEach((piece,index)=>{
    piece._glass={
      x:0,y:0,r:0,
      // the piece's authored --r (e.g. a 27deg or 34deg tilt set in its inline style) is a *static* rotation,
      // separate from the small animated sway r/motion-r drives. The idle/CSS transform adds them together
      // (rotate(var(--r) + var(--motion-r))), but .is-dragging switches to a single rotate(var(--drag-r)) - so
      // without baseR folded in here, any piece with a non-zero authored tilt would snap flat the instant it's grabbed.
      baseR:parseFloat(getComputedStyle(piece).getPropertyValue('--r'))||0,
      targetX:0,targetY:0,
      startX:0,startY:0,startR:0,
      returnStart:0,returnDuration:0,
      phase:index*1.73,
      seed:1+(index%5)*.17
    };
    const img=piece.querySelector('img');
    if(img)primeAlpha(img.currentSrc||img.src);
  });

  // highest z-index first, so overlapping pieces (rare) resolve to the one actually drawn on top
  const hitOrder=[...glassPieces].sort((a,b)=>
    (parseFloat(getComputedStyle(b).zIndex)||0)-(parseFloat(getComputedStyle(a).zIndex)||0));

  const startDrag=(piece,e)=>{
    const state=piece._glass;
    const field=piece.closest('.glass-field');
    if(!field)return;
    const bounds=piece.getBoundingClientRect();
    state.originField=field;
    state.originNext=piece.nextSibling;
    state.originCenterX=bounds.left+bounds.width/2;
    state.originCenterY=bounds.top+bounds.height/2;
    state.pointerOffsetX=e.clientX-state.originCenterX;
    state.pointerOffsetY=e.clientY-state.originCenterY;
    dragLayer.appendChild(piece);
    piece.classList.add('is-dragging');
    motion.active=piece;
    motion.pointerId=e.pointerId;
    state.targetX=state.x;
    state.targetY=state.y;
    state.targetR=state.r;
    state.scrollX=window.scrollX;
    state.scrollY=window.scrollY;
    piece.classList.add('is-grabbed');
    applyDragPosition(piece,state);
    document.body.classList.add('glass-dragging');
    piece.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    for(const piece of hitOrder){
      const pt=localPoint(piece,e.clientX,e.clientY);
      if(!pt)continue;
      if(!isOpaqueAt(piece,pt.u,pt.v))continue;
      startDrag(piece,e);
      return;
    }
  },true);

  // cursor affordance only - gating the actual drag happens above, at pointerdown time
  let hoverRaf=0;
  document.addEventListener('pointermove',e=>{
    if(motion.active||hoverRaf)return;
    hoverRaf=requestAnimationFrame(()=>{
      hoverRaf=0;
      const hit=hitOrder.some(piece=>{
        const pt=localPoint(piece,e.clientX,e.clientY);
        return pt&&isOpaqueAt(piece,pt.u,pt.v);
      });
      document.body.classList.toggle('glass-hover',hit);
    });
  });

  glassPieces.forEach(piece=>{
    piece.addEventListener('pointermove',e=>{
      if(motion.active!==piece||e.pointerId!==motion.pointerId)return;
      const state=piece._glass;
      state.targetX=e.clientX-state.pointerOffsetX-state.originCenterX;
      state.targetY=e.clientY-state.pointerOffsetY-state.originCenterY;
      state.targetR=clamp(state.targetX/Math.max(piece.getBoundingClientRect().width,1)*3.5,-5,5);
    });

    const release=()=>{
      if(motion.active!==piece)return;
      const state=piece._glass;
      motion.active=null;
      motion.pointerId=null;
      state.startX=state.x;
      state.startY=state.y;
      state.startR=state.r;
      state.returnStart=performance.now();
      const distance=Math.hypot(state.startX,state.startY);
      // twice the previous settle time, so the return reads as unhurried rather than snapping back
      state.returnDuration=clamp(2200+distance*2.3,2200,4400);
      state.targetX=state.targetY=state.targetR=0;
      // stays in the fixed drag layer (still position:fixed, still un-clipped) for the whole glide home -
      // only reparented back into its section's glass-field once it's actually settled, so it never gets
      // clipped by that field's overflow:hidden mid-flight
      piece.classList.remove('is-grabbed');
      document.body.classList.remove('glass-dragging');
    };

    piece.addEventListener('pointerup',release);
    piece.addEventListener('pointercancel',release);
    piece.addEventListener('lostpointercapture',release);
  });

  const render=now=>{
    motion.lastTime=now;

    glassPieces.forEach(piece=>{
      const state=piece._glass;
      if(motion.active===piece){
        state.x+=(state.targetX-state.x)*0.34;
        state.y+=(state.targetY-state.y)*0.34;
        state.r+=(state.targetR-state.r)*0.28;
        applyDragPosition(piece,state);
      }else if(state.returnStart){
        const t=clamp((now-state.returnStart)/state.returnDuration,0,1);
        const eased=easeOutQuint(t);
        const settle=1-eased;
        const sway=Math.sin(t*Math.PI)*Math.sin(t*Math.PI*.55)*6;
        state.x=state.startX*settle;
        state.y=state.startY*settle;
        state.r=state.startR*settle+sway*(Math.abs(state.startR)>0.01?Math.sign(state.startR):1);
        // still riding the fixed drag layer, so keep its fixed-position vars in sync with the glide
        applyDragPosition(piece,state);
        if(t>=1){
          state.x=state.y=state.r=0;
          state.returnStart=0;
          // only now, safely back at rest, hand it back to its section's glass-field
          if(state.originField){
            state.originField.insertBefore(piece,state.originNext);
            state.originField=null;
            state.originNext=null;
          }
          piece.classList.remove('is-dragging');
          piece.style.removeProperty('--drag-left');
          piece.style.removeProperty('--drag-top');
          piece.style.removeProperty('--drag-r');
        }
      }else{
        const seconds=(now-idleMotionStart)/1000;
        const ramp=Math.max(0,Math.min(1,seconds/1.6)); // eases the drift in over ~1.6s so the page never opens with a pop
        const baseSpeed=parseFloat(getComputedStyle(piece).getPropertyValue('--speed'))||42;
        const speed=state.seed/(baseSpeed*1.5);
        const driftX=parseFloat(getComputedStyle(piece).getPropertyValue('--dx'))||0;
        const driftY=parseFloat(getComputedStyle(piece).getPropertyValue('--dy'))||0;
        const driftR=parseFloat(getComputedStyle(piece).getPropertyValue('--dr'))||0;
        state.x=Math.sin(seconds*speed*2*Math.PI+state.phase)*driftX*.5*ramp;
        state.y=Math.sin(seconds*speed*2*Math.PI+state.phase+1.1)*driftY*.5*ramp;
        state.r=Math.sin(seconds*speed*2*Math.PI+state.phase+.7)*driftR*.5*ramp;
      }
      piece.style.setProperty('--motion-x',`${state.x}px`);
      piece.style.setProperty('--motion-y',`${state.y}px`);
      piece.style.setProperty('--motion-r',`${state.r}deg`);
    });

    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}
})();
