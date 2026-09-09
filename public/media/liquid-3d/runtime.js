import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { createLiquidAtmosphere } from './atmosphere.js';

// Adapted from the user's selected 4189/animation preview. The exported model,
// textures, lid corrections, eye alignment and attention springs are preserved.
export function mountLiquidModel(stage, { onError, prefetchedModel }) {
 const asset = name => new URL(name, import.meta.url).href;
 // The web mesh preserves the eye/lid geometry and both animation clips.
 // The full authoring mesh remains available separately; it costs 48 MB to load.
 const modelName='Liquid-animated-mobile-v2.glb';
 const compressedName=`${modelName}.gz`;
 stage.dataset.modelQuality='web';
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
 renderer.setClearColor(0x000000,0);stage.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),pivot=new THREE.Group();pivot.position.y=-.09;scene.add(pivot);
 // Enlarge only the transparent drawing area. The original rig, framing scale
 // and screen-space route stay fixed while the chin and tilted ears gain room.
 const viewportScale=1.32;
 stage.style.setProperty('--liquid-viewport-scale',String(viewportScale));
 const camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.PI/12)*viewportScale)),1,.01,100);camera.position.z=4.1;
 const pointer=new THREE.Vector2(),look=new THREE.Vector2(),rimBlink={value:0},saved=[],lids=[],eyeBones=[];
 const closedPaint={value:null},paintProjection={value:new THREE.Vector3(.81152,.499926,.499109)};
 const rimPaint={value:null},contourField={value:null};
 const resources=new Set(),bitmaps=new Set(),abort=new AbortController();
 let disposed=false,ready=false,raf=0,previous=performance.now(),elapsed=0,stageVisible=true,dirty=true;
 let renderWidth=0,renderHeight=0,lastScroll=0;
 let model,mixer,clips=[],action,headBone,pointerPosition=null,pointerInside=false,deviceTilt=null;
 let followWeight=0,followWeightVelocity=0,followBlink=null,followBlinkIndex=0,nextFollowBlink=3.9,previousIdleTime=0;
 const cursorHead=new THREE.Vector2(),cursorHeadVelocity=new THREE.Vector2(),lookVelocity=new THREE.Vector2();
 const eyeAnchors=new Map(),idlePose=[];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const rig=stage.closest('[data-liquid-motion-rig]');
 const atmosphere=createLiquidAtmosphere(stage,rig);
 const idleBlinkEvents=[[4.88,.11,.026,.21,1],[8.3,.12,.035,.19,1],[10.49,.14,.055,.17,1],[15.56,.1,.035,.19,1],[18.41,.12,.025,.2,1],[19.76,.105,.018,.19,.82],[24.62,.12,.025,.2,1],[30.25,.11,.028,.22,1]];
 function setContourField(data){const texture=new THREE.DataTexture(new Float32Array(data.values),data.width,2,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;contourField.value=texture;resources.add(texture);}
 function trackResources(object){object.traverse(o=>{
  if(o.geometry)resources.add(o.geometry);if(o.skeleton)resources.add(o.skeleton);
  for(const material of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture){resources.add(value);if(value.source?.data?.close)bitmaps.add(value.source.data);}}
 });}
 function releaseResources(){for(const resource of resources)resource.dispose();resources.clear();for(const bitmap of bitmaps)bitmap.close();bitmaps.clear();}
 function fail(error){if(disposed)return;stage.dataset.ready='false';stage.dataset.error='true';onError(error);}
 function resize(){if(disposed)return;const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);camera.aspect=w/(h*viewportScale);camera.updateProjectionMatrix();dirty=true;wake();}
 function measurePointer(){
  if(deviceTilt&&!reduced.matches){pointer.set(deviceTilt.x,deviceTilt.y);pointerInside=true;return;}
  const wasInside=pointerInside,r=stage.getBoundingClientRect();
  // Screen coordinates are recomputed as the existing scroll rig moves/scales.
  // Keep this layer transparent to clicks and touch scrolling on the site.
  const margin=Math.max(220,Math.min(420,r.width*.75));
  const dx=pointerPosition?pointerPosition.x-(r.left+r.width/2):0,dy=pointerPosition?pointerPosition.y-(r.top+r.height/2):0;
  pointerInside=!!pointerPosition&&!reduced.matches&&r.width>0&&r.height>0&&Math.hypot(dx/(r.width/2+margin),dy/(r.height/2+margin))<=1;
  if(pointerInside)pointer.set(THREE.MathUtils.clamp((pointerPosition.x-r.left)/r.width*2-1,-1,1),THREE.MathUtils.clamp((pointerPosition.y-r.top)/r.height*2-1,-1,1));
  else{pointer.set(0,0);if(wasInside&&ready){action.time=0;previousIdleTime=0;}}
 }
 function tiltChanged(event){
  const input=event.detail;
  deviceTilt=input?.active&&Number.isFinite(input.x)&&Number.isFinite(input.y)?{x:THREE.MathUtils.clamp(input.x,-.65,.65),y:THREE.MathUtils.clamp(input.y,-.65,.65)}:null;
  dirty=true;if(stageVisible)wake();
 }
 function pointerMove(e){if(e.pointerType==='touch')return;pointerPosition={x:e.clientX,y:e.clientY};dirty=true;wake();}
 function pointerLeave(){pointerPosition=null;dirty=true;wake();}
 function wake(){if(!disposed&&!raf){previous=performance.now();raf=requestAnimationFrame(frame);}}
 function invalidate(){dirty=true;wake();}
 function scrollChanged(){lastScroll=performance.now();invalidate();}
 // A responsive scene rebuild can queue both exit and re-entry before delivery.
 // The latest record is authoritative; an earlier exit must not strand the rig.
 const intersection=new IntersectionObserver(entries=>{
  const entry=entries[entries.length-1];
  if(entry){stageVisible=entry.isIntersecting;invalidate();}
 });intersection.observe(stage);
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
 window.addEventListener('pointermove',pointerMove,{passive:true});
 window.addEventListener('astra:device-tilt',tiltChanged);
 document.documentElement.addEventListener('pointerleave',pointerLeave);
 window.addEventListener('blur',pointerLeave);
 window.addEventListener('scroll',scrollChanged,{passive:true});
 document.addEventListener('visibilitychange',invalidate);reduced.addEventListener('change',invalidate);
 renderer.domElement.addEventListener('webglcontextlost',contextLost);
 function contextLost(e){e.preventDefault();fail(new Error('Liquid WebGL context lost'));}
function spring(value,velocity,target,omega,dt){const d=value-target,c=velocity+omega*d,e=Math.exp(-omega*dt);return [target+(d+c*dt)*e,(velocity-omega*c*dt)*e];}
function smooth5(v){const u=THREE.MathUtils.clamp(v,0,1);return u*u*u*(u*(u*6-15)+10);}
function eventBlink(age,event){const [close,hold,opening,peak=1]=event;if(age<0||age>close+hold+opening)return 0;if(age<close)return smooth5(age/close)*peak;if(age<close+hold)return peak;return (1-smooth5((age-close-hold)/opening))*peak;}
function websiteBlink(dt,time){
 if(reduced.matches){followBlink=null;return 0;}
 if(followBlink)followBlink.age+=dt;
 if(followBlink&&followBlink.age>=followBlink.event.slice(0,3).reduce((a,b)=>a+b,0)){
  followBlink=null;nextFollowBlink=elapsed+[3.9,5.2,4.4,6.0][followBlinkIndex++%4];
 }
 if(!followBlink){
  const event=idleBlinkEvents.find(a=>time>=a[0]&&time<a[0]+a[1]+a[2]+a[3]&&(previousIdleTime<a[0]||time<previousIdleTime));
  if(!pointerInside&&event)followBlink={age:time-event[0],event:event.slice(1)};
  else if(pointerInside&&elapsed>=nextFollowBlink)followBlink={age:0,event:[.115,.03,.205,1]};
 }
 previousIdleTime=time;
 return followBlink?eventBlink(followBlink.age,followBlink.event):0;
}
function alignEyeCenters(){
 if(!headBone)return;model.updateMatrixWorld(true);
 for(const bone of eyeBones){const anchor=eyeAnchors.get(bone);if(!anchor)continue;const world=headBone.localToWorld(anchor.clone());bone.position.copy(bone.parent.worldToLocal(world));}
}
function applyWebsiteMotion(dt,time){
 // Blend the exported acting pose with cursor attention. The eye centers
 // are reattached to the current skull transform after the blend.
 cacheClipPose();
 restoreRest();
 const engaged=pointerInside&&!reduced.matches;
 [followWeight,followWeightVelocity]=spring(followWeight,followWeightVelocity,engaged?1:0,9,dt);
 const gx=engaged?pointer.x:0,gy=engaged?-pointer.y:0;
 [look.x,lookVelocity.x]=spring(look.x,lookVelocity.x,gx,25,dt);
 [look.y,lookVelocity.y]=spring(look.y,lookVelocity.y,gy,25,dt);
 [cursorHead.x,cursorHeadVelocity.x]=spring(cursorHead.x,cursorHeadVelocity.x,gx,6.2,dt);
 [cursorHead.y,cursorHeadVelocity.y]=spring(cursorHead.y,cursorHeadVelocity.y,gy,6.2,dt);
 aimEyes(look.x,look.y);
 const w=THREE.MathUtils.clamp(followWeight,0,1);
 for(let i=0;i<saved.length;i++){const o=saved[i].object,p=idlePose[i];o.position.lerpVectors(p.position,o.position,w);o.quaternion.slerp(p.quaternion,1-w);o.scale.lerpVectors(p.scale,o.scale,w);}
 pivot.rotation.set(-cursorHead.y*.10*w,cursorHead.x*.18*w,-cursorHead.x*.018*w);
 return websiteBlink(dt,time);
}

// RGBA32F linear filtering needs OES_texture_float_linear, which iPhone GPUs
// may not expose. Interpolate exact float texels in the shader instead: an
// incomplete filtered texture returns zero bounds and paints over both pupils.
const contourLookupGLSL=`
uniform sampler2D liquidContourField;
vec4 liquidContourBounds(float x){
 float column=clamp((abs(x)-0.043)/0.190,0.0,1.0)*255.0;
 float left=floor(column),row=x>=0.0?0.25:0.75;
 vec4 a=texture2D(liquidContourField,vec2((left+0.5)/256.0,row));
 vec4 b=texture2D(liquidContourField,vec2((min(left+1.0,255.0)+0.5)/256.0,row));
 return mix(a,b,fract(column));
}`;
const contourGLSL=contourLookupGLSL+`
uniform sampler2D liquidRimPaint;
vec4 baselineBounds(vec3 p){
 return liquidContourBounds(p.x);
}
vec4 movingBounds(vec4 original,float x){
 float t=clamp((abs(x)-0.058)/0.161,0.0,1.0);
 float liquidClosedLine=-0.108+0.049*t*t*t;
 float line=liquidClosedLine;
 float hi=mix(original.r,line,liquidBlink),lo=mix(original.g,line,liquidBlink);
 float top=hi+mix(original.b-original.r,0.0016,liquidBlink);
 float bottom=lo-mix(original.g-original.a,0.0012,liquidBlink);
 return vec4(hi,lo,top,bottom);
}
float liquidApertureExterior(vec3 p){
 vec4 b=movingBounds(baselineBounds(p),p.x);
 return max(smoothstep(b.r-0.0003,b.r+0.0003,p.y),1.0-smoothstep(b.g-0.0003,b.g+0.0003,p.y));
}
float liquidContour(vec3 p){
 vec4 original=baselineBounds(p),b=movingBounds(original,p.x);
 float upper=smoothstep(b.r-0.0004,b.r+0.00015,p.y)*(1.0-smoothstep(b.b-0.0003,b.b+0.0003,p.y));
 float lower=(1.0-smoothstep(b.g-0.00015,b.g+0.0004,p.y))*smoothstep(b.a-0.0003,b.a+0.0003,p.y);
 return max(upper,lower)*smoothstep(0.0003,0.003,original.b-original.a);
}
vec3 liquidLiningColour(vec3 p){
 vec4 original=baselineBounds(p),b=movingBounds(original,p.x);
 float y=p.y>=(b.r+b.g)*0.5?original.r+(p.y-b.r)/max(0.0001,b.b-b.r)*(original.b-original.r):original.g-(b.g-p.y)/max(0.0001,b.g-b.a)*(original.g-original.a);
 vec2 uv=vec2(p.x*liquidPaintProjection.x+liquidPaintProjection.y,1.0-(y*liquidPaintProjection.x+liquidPaintProjection.z));
 vec3 rgb=texture2D(liquidRimPaint,uv).rgb;
 float distanceToEdge=min(abs(p.y-b.r),abs(p.y-b.g));
 rgb=mix(min(rgb,vec3(0.025)),rgb,smoothstep(0.0010,0.0022,distanceToEdge));
 return mix(rgb,vec3(0.008,0.009,0.006),smoothstep(0.45,1.0,liquidBlink));
}`;
function lidMaterial(material,upper,drawRim=true,innerSocket=true){material.onBeforeCompile=s=>{
 s.uniforms.liquidRimPaint=rimPaint;s.uniforms.liquidContourField=contourField;s.uniforms.liquidPaintProjection=paintProjection;s.uniforms.liquidClosedPaint=closedPaint;s.uniforms.liquidBlink=rimBlink;
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 liquidLidLocal;').replace('#include <morphtarget_vertex>','#include <morphtarget_vertex>\nliquidLidLocal=transformed;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 liquidLidLocal; uniform vec3 liquidPaintProjection; uniform sampler2D liquidClosedPaint; uniform float liquidBlink;'+contourGLSL).replace('#include <map_fragment>',`vec2 closedUV=vec2(liquidLidLocal.x*liquidPaintProjection.x+liquidPaintProjection.y,1.0-(liquidLidLocal.y*liquidPaintProjection.x+liquidPaintProjection.z));
vec3 cleanColour=texture2D(liquidClosedPaint,closedUV).rgb;
vec3 originalColour=texture2D(liquidRimPaint,closedUV).rgb;
vec4 originalBounds=baselineBounds(liquidLidLocal);
float coverage=smoothstep(originalBounds.a-0.014,originalBounds.a-0.008,liquidLidLocal.y)*(1.0-smoothstep(originalBounds.b+0.004,originalBounds.b+0.009,liquidLidLocal.y))*smoothstep(0.001,0.003,originalBounds.b-originalBounds.a);
vec3 lidColour=mix(originalColour,cleanColour,coverage);
float cavityLining=smoothstep(0.10,0.17,liquidLidLocal.z);
 diffuseColor.rgb=${drawRim?'mix(lidColour,liquidLiningColour(liquidLidLocal),liquidContour(liquidLidLocal))':innerSocket?'mix(lidColour,vec3(0.008,0.009,0.006),cavityLining)':'lidColour'};`);
};material.customProgramCacheKey=()=> 'liquid-opening-boundary-lid-'+drawRim+'-'+innerSocket;}
function eyeApertureMaterial(material){material.onBeforeCompile=s=>{
 s.uniforms.liquidContourField=contourField;s.uniforms.liquidPaintProjection=paintProjection;
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 liquidPaintProjection;'+contourLookupGLSL).replace('#include <map_fragment>',`#include <map_fragment>
 vec2 rest=vec2((vMapUv.x-liquidPaintProjection.y)/liquidPaintProjection.x,((1.0-vMapUv.y)-liquidPaintProjection.z)/liquidPaintProjection.x);
 vec4 a=liquidContourBounds(rest.x);
 // Continue the unobstructed upper iris/pupil colour beneath the lid.
 // A cream upper replacement created a false white outline in neutral.
 float safeY=min(rest.y,a.r-0.0045);
 vec2 safeUV=vec2(vMapUv.x,1.0-(safeY*liquidPaintProjection.x+liquidPaintProjection.z));
 diffuseColor.rgb=texture2D(map,safeUV).rgb;
 float outside=1.0-smoothstep(a.g+0.002,a.g+0.004,rest.y);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.91,0.79,0.39),outside);
 `);
};material.customProgramCacheKey=()=> 'liquid-baseline-iris-on-complete-sphere';}
function restoreClipPose(){for(let i=0;i<saved.length;i++){const o=saved[i].object,p=idlePose[i];o.position.copy(p.position);o.quaternion.copy(p.quaternion);o.scale.copy(p.scale);}}
function cacheClipPose(){for(let i=0;i<saved.length;i++){const o=saved[i].object,p=idlePose[i];p.position.copy(o.position);p.quaternion.copy(o.quaternion);p.scale.copy(o.scale);}}
function restoreRest(){for(const r of saved){r.object.position.copy(r.position);r.object.quaternion.copy(r.quaternion);r.object.scale.copy(r.scale);}}
function readBlink(){return Math.max(0,...lids.map(o=>o.morphTargetInfluences[o.morphTargetDictionary.Blink]||0));}
function setBlink(b){for(const o of lids){o.morphTargetInfluences[o.morphTargetDictionary.Blink]=b;for(let i=1;i<8;i++){const arc=o.morphTargetDictionary[`LidArc${i}`];if(arc!==undefined)o.morphTargetInfluences[arc]=Math.max(0,1-Math.abs(b*8-i));}}}
const qParent=new THREE.Quaternion(),qRest=new THREE.Quaternion(),qCorrection=new THREE.Quaternion(),forward=new THREE.Vector3(),direction=new THREE.Vector3();
function aimEyes(gx,gy){model.updateMatrixWorld(true);for(const bone of eyeBones){const rest=saved.find(r=>r.object===bone);bone.parent.getWorldQuaternion(qParent);qRest.copy(qParent).multiply(rest.quaternion);forward.set(0,1,0).applyQuaternion(qRest);direction.copy(forward).add(new THREE.Vector3(gx*.23,gy*.20,0)).normalize();qCorrection.setFromUnitVectors(forward,direction);bone.quaternion.copy(qParent).invert().multiply(qCorrection).multiply(qRest);}}

 async function fetchModel(name,compressed=false){
  // Retry interrupted downloads once; a transient network failure should not
  // permanently switch a capable browser back to the video.
  for(let attempt=0;attempt<2;attempt++){
   try{
    stage.dataset.loadAttempt=String(attempt+1);
    const response=attempt===0&&prefetchedModel?.url===asset(name)
     ?await prefetchedModel.response
     :await fetch(asset(name),{signal:abort.signal,cache:attempt?'reload':'default',priority:'high'});
    if(!response.ok)throw new Error(`Liquid model unavailable (${response.status})`);
    // Some hosts supply Content-Encoding themselves, which fetch already decodes.
    let received=0;
    const size=Number(response.headers.get('Content-Length'));
    const downloading=response.body.pipeThrough(new TransformStream({transform(chunk,controller){
     received+=chunk.byteLength;
     if(size>0)stage.dataset.loadProgress=String(10+Math.round(Math.min(1,received/size)*65));
     controller.enqueue(chunk);
    }}));
    const stream=compressed&&!response.headers.get('Content-Encoding')?.includes('gzip')
     ?downloading.pipeThrough(new DecompressionStream('gzip')):downloading;
    return await new Response(stream).arrayBuffer();
   }catch(error){if(disposed||error.name==='AbortError'||attempt===1)throw error;}
  }
 }
 async function load(){
  stage.dataset.loadState='fetching';stage.dataset.loadProgress='10';
  let buffer;
  if(typeof DecompressionStream!=='undefined'){
   try{buffer=await fetchModel(compressedName,true);}
   catch(error){if(disposed||error.name==='AbortError')throw error;}
  }
  // The uncompressed web GLB remains a compatibility fallback for older browsers.
  buffer??=await fetchModel(modelName);
  if(disposed)return;
  stage.dataset.loadState='parsing';stage.dataset.loadProgress='78';
  const gltf=await new GLTFLoader().parseAsync(buffer,asset('./'));
  trackResources(gltf.scene);if(disposed){releaseResources();return;}
 model=gltf.scene;clips=gltf.animations;
 model.traverse(o=>{if(o.userData.closed_paint_reference)o.traverse(child=>{if(child.isMesh){child.userData.closed_paint_reference=true;child.userData.upper_lid=o.name.startsWith('upper');}});});
 model.traverse(o=>{
  saved.push({object:o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});idlePose.push({position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});if(o.name==='DEF-head')headBone=o;
  if(/^DEF-eye[._]?[LR]$/.test(o.name))eyeBones.push(o);
  if(o.morphTargetInfluences)lids.push(o);
  if(o.userData.closed_paint_projection)paintProjection.value.fromArray(o.userData.closed_paint_projection);
  if(o.userData.eye_contour_field)setContourField(o.userData.eye_contour_field);
  // The eye texture is byte-identical to eye-rim-reference.png. Reuse it
  // instead of downloading and uploading another 9.8 MB copy.
  if(o.isMesh&&o.userData.eye_aperture_contour){const m=Array.isArray(o.material)?o.material[0]:o.material;rimPaint.value=m.emissiveMap||m.map;}
  if(o.isMesh&&o.userData.closed_paint_reference){const m=Array.isArray(o.material)?o.material[0]:o.material;if(m.emissiveMap||m.map)closedPaint.value=m.emissiveMap||m.map;}
  if(o.isMesh){const convert=m=>{const map=m.emissiveMap||m.map;const color=m.emissiveMap||m.emissive?.getHex()>0?m.emissive:m.color;const result=new THREE.MeshBasicMaterial({map,color:color?.clone()||new THREE.Color(1,1,1),side:m.side,toneMapped:false});if(o.userData.eye_aperture_contour)eyeApertureMaterial(result);if(o.userData.fitted_fur_support||m.userData.fitted_orbit_paint)lidMaterial(result,false,false,!m.userData.socket_root_cover);if(o.userData.closed_paint_reference)lidMaterial(result,o.userData.upper_lid);return atmosphere.apply(result);};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);}
 });
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
 const wrapper=new THREE.Group();wrapper.add(model);wrapper.scale.setScalar(2.25/Math.max(size.x,size.y));wrapper.position.copy(centre).multiplyScalar(-wrapper.scale.x);pivot.add(wrapper);
 model.updateMatrixWorld(true);for(const bone of eyeBones)eyeAnchors.set(bone,headBone.worldToLocal(bone.getWorldPosition(new THREE.Vector3())));mixer=new THREE.AnimationMixer(model);
 const idle=clips.find(clip=>clip.name==='Liquid_Idle');
 if(!idle||!headBone||eyeBones.length!==2||!closedPaint.value||!rimPaint.value||!contourField.value)throw new Error('Liquid rig is incomplete');
 action=mixer.clipAction(idle);action.play();
 cacheClipPose();stage.dataset.clips=clips.map(c=>c.name).join(',');
 stage.dataset.loadState='warming';stage.dataset.loadProgress='90';
 // Compile the real skin/eye shaders behind the loader before the first reveal.
 await renderer.compileAsync(scene,camera);
 if(disposed)return;
 ready=true;
  stage.dataset.revision='natural-motion-round4-framing2-atmosphere1-web7';
 resize();wake();

 trackResources(model);
 }
 function frame(now){
  raf=0;if(disposed||!ready)return;
  const visible=stageVisible&&!document.hidden&&rig?.style.visibility!=='hidden'&&Number(rig?.style.opacity||1)>.001;
  // One hidden frame uploads textures and proves that the interactive rig can
  // render. Afterwards an inactive rig sleeps as before; loader gating cannot
  // deadlock against a mascot whose scroll pose currently has zero opacity.
  if(document.hidden||(!visible&&stage.dataset.ready==='true')){stage.dataset.paused='true';return;}
  // GSAP still updates the outer route on every frame. Rendering at the
  // displayed size avoids shading a full-size canvas for a tiny phone mascot.
  const interval=now-lastScroll<180?1000/15:1000/30;
  if(!reduced.matches&&now-previous<interval){raf=requestAnimationFrame(frame);return;}
  const rect=stage.getBoundingClientRect();
  const width=Math.max(1,Math.min(1024,Math.ceil(rect.width/16)*16));
  const height=Math.max(1,Math.round(width/camera.aspect));
  if(width!==renderWidth||height!==renderHeight){renderer.setSize(width,height,false);renderWidth=width;renderHeight=height;}
  const realDt=Math.min(.1,(now-previous)/1000);previous=now;
  const dt=reduced.matches?0:realDt;elapsed+=dt;measurePointer();
  if(reduced.matches){restoreRest();pivot.rotation.set(0,0,0);look.set(0,0);followWeight=0;setBlink(0);}
  else{restoreClipPose();mixer.update(dt);setBlink(THREE.MathUtils.clamp(applyWebsiteMotion(dt,action.time),0,1));}
  alignEyeCenters();rimBlink.value=readBlink();
  atmosphere.update(realDt,reduced.matches);
  stage.dataset.clipTime=action.time.toFixed(3);stage.dataset.blink=rimBlink.value.toFixed(3);
  stage.dataset.eyeX=look.x.toFixed(3);stage.dataset.eyeY=look.y.toFixed(3);stage.dataset.yaw=pivot.rotation.y.toFixed(3);
  stage.dataset.followWeight=followWeight.toFixed(3);stage.dataset.pointerInside=String(pointerInside);
  stage.dataset.headQuaternion=headBone.quaternion.toArray().map(x=>x.toFixed(5)).join(',');
  stage.dataset.paused=String(reduced.matches);stage.dataset.mode=deviceTilt?'tilt':'follow';
  if(!reduced.matches||dirty){renderer.render(scene,camera);dirty=false;stage.dataset.ready='true';stage.dataset.loadState='ready';stage.dataset.loadProgress='100';}
  if(!reduced.matches)raf=requestAnimationFrame(frame);
 }
 resize();void load().catch(error=>{if(error.name!=='AbortError')fail(error);});
 return {dispose(){
  if(disposed)return;disposed=true;abort.abort();cancelAnimationFrame(raf);
  intersection.disconnect();resizeObserver.disconnect();
  window.removeEventListener('pointermove',pointerMove);document.documentElement.removeEventListener('pointerleave',pointerLeave);
  window.removeEventListener('astra:device-tilt',tiltChanged);
  window.removeEventListener('blur',pointerLeave);window.removeEventListener('scroll',scrollChanged);
  document.removeEventListener('visibilitychange',invalidate);reduced.removeEventListener('change',invalidate);
  renderer.domElement.removeEventListener('webglcontextlost',contextLost);
  mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);
  releaseResources();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
 }};
}
