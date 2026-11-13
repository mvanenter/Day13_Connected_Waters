'use strict';
/* Connected Waters — Day 13. All tracing happens in the browser using REC2 HydroID -> NextDownID. */
(() => {
const $ = id => document.getElementById(id);
const outlet = 593451;
const state = {mode:'both', selected:null, upstream:new Set(), downstream:new Set(), data:null, map:null};
const fmt = n => Number(n).toLocaleString('en-NZ');
const lengthFmt = n => `${Number(n).toLocaleString('en-NZ',{minimumFractionDigits:2,maximumFractionDigits:2})} km`;
const showError = msg => {const el=$('error-notice'); el.hidden=false;el.textContent=msg;};
const panel=$('sidebar');
function setMobileOpen(open){
 panel.classList.toggle('is-open',open);
 $('mobile-open').setAttribute('aria-expanded', String(open));
 $('mobile-close').setAttribute('aria-expanded', String(open));
 setTimeout(()=>state.map?.invalidateSize(),240);
}
$('mobile-open').addEventListener('click',()=>setMobileOpen(true));
$('mobile-close').addEventListener('click',()=>setMobileOpen(false));
$('info-btn').addEventListener('click',()=>{$('method-overlay').hidden=false});
$('method-close').addEventListener('click',()=>{$('method-overlay').hidden=true});
$('method-overlay').addEventListener('click',e=>{if(e.target===$('method-overlay'))$('method-overlay').hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('method-overlay').hidden=true});
if(!window.L){showError('Map library could not load. Connect to the internet and reload this page.');return;}
const map=L.map('map',{zoomControl:false,preferCanvas:true,attributionControl:true,zoomSnap:0.25,minZoom:7});
state.map=map;
L.control.zoom({position:'topright'}).addTo(map);
// Community-run OpenStreetMap standard tiles: no API key required.
// See https://operations.osmfoundation.org/policies/tiles/ for usage conditions.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  maxZoom:19
}).addTo(map);
// A non-interactive white casing stays beneath the selected dark reach.
// Separate panes ensure narrow, short reaches stay distinguishable on the OSM map.
const haloPane=map.createPane('selected-halo');
haloPane.style.zIndex=460;
haloPane.style.pointerEvents='none';
const networkPane=map.createPane('network');networkPane.style.zIndex=440;
const markerPane=map.createPane('selected-marker');markerPane.style.zIndex=465;markerPane.style.pointerEvents='none';
const selectionHalo=L.geoJSON(null,{pane:'selected-halo',interactive:false,
 style:{color:'#fff',weight:11,opacity:1,lineCap:'round',lineJoin:'round'}}).addTo(map);
const selectionStroke=L.geoJSON(null,{pane:'selected-halo',interactive:false,
 style:{color:'#273c53',weight:5.5,opacity:1,lineCap:'round',lineJoin:'round'}}).addTo(map);
const selectionDot=L.circleMarker([0,0],{pane:'selected-marker',radius:6,color:'#fff',weight:3,
 fillColor:'#273c53',fillOpacity:1,interactive:false});
const renderer=L.canvas({padding:0.5,pane:'network'});
let featuresById=new Map(), down=new Map(), up=new Map(), displayed=new Map(), geoLayer, extent;
let allLen=0;
function upstreamTrace(id){const found=new Set(),stack=[id];while(stack.length){const cur=stack.pop();for(const parent of up.get(cur)||[]){if(parent!==id&&!found.has(parent)){found.add(parent);stack.push(parent)}}}return found;}
function downstreamTrace(id){const found=new Set(), seen=new Set([id]);let cur=id;while(true){const nxt=down.get(cur);if(nxt===undefined||nxt===-1)break;if(!featuresById.has(nxt)||seen.has(nxt)){console.warn('Invalid/cyclic downstream path at',cur,nxt);break;}seen.add(nxt);found.add(nxt);cur=nxt;}return found;}
function total(ids){let sum=0;for(const id of ids)sum+=Number(featuresById.get(id)?.properties.length_km||0);return sum;}
function styleFor(id){if(id===state.selected)return{color:'#273c53',weight:5.5,opacity:1};if(state.selected!==null){if(state.mode!=='downstream'&&state.upstream.has(id))return{color:'#168c81',weight:3.7,opacity:0.95};if(state.mode!=='upstream'&&state.downstream.has(id))return{color:'#df884b',weight:4.4,opacity:0.96};return{color:'#adbdc0',weight:1.3,opacity:0.26};}return{color:'#4f9b9d',weight:2.1,opacity:0.78};}
function redraw(){
 for(const [id,layer] of displayed)layer.setStyle(styleFor(id));
 selectionHalo.clearLayers();
 selectionStroke.clearLayers();
 if(map.hasLayer(selectionDot))map.removeLayer(selectionDot);
 if(state.selected!==null&&featuresById.has(state.selected)){
   const feature=featuresById.get(state.selected);
   selectionHalo.addData(feature);
   selectionStroke.addData(feature);
   const coords=feature.geometry?.coordinates;
   // The representative point marks the chosen reach at small map scales.
   if(Array.isArray(coords)&&coords.length){
     const coord=coords[Math.floor(coords.length/2)];
     if(Array.isArray(coord)&&coord.length>=2){
       selectionDot.setLatLng([coord[1],coord[0]]).addTo(map);
     }
   }
 }
}
function showMobileSelection(){
 if(window.innerWidth<=700){
  setMobileOpen(true);
  $('selected-section').scrollIntoView({block:'start',behavior:'smooth'});
 }
}
function select(id,{zoom=false}={}){
 if(!featuresById.has(id))return;
 state.selected=id;state.upstream=upstreamTrace(id);state.downstream=downstreamTrace(id);
 redraw();const p=featuresById.get(id).properties;
 $('empty-selection').hidden=true;$('selected-details').hidden=false;$('reset-btn').disabled=false;
 $('selected-name').textContent=`Reach ${fmt(id)}`;
 $('up-count').textContent=fmt(state.upstream.size);$('down-count').textContent=fmt(state.downstream.size);
 $('up-length').textContent=lengthFmt(total(state.upstream));$('down-length').textContent=lengthFmt(total(state.downstream));
 $('stream-order').textContent=p.StreamOrde??'Not supplied';
 $('segment-length').textContent=lengthFmt(p.length_km);
 const area=Number(p.CUM_AREA);$('catchment-area').textContent=Number.isFinite(area)&&area>0?`${fmt(Math.round(area/1e6))} km²`:'Not available';
 $('map-message').textContent=`${fmt(state.upstream.size)} upstream · ${fmt(state.downstream.size)} downstream reaches`;
 if(zoom){map.fitBounds(displayed.get(id).getBounds(),{padding:[65,65],maxZoom:12});}
 $('mobile-open').textContent=`☰  Reach ${fmt(id)} · View trace`;
 showMobileSelection();
}
function reset(){state.selected=null;state.upstream=new Set();state.downstream=new Set();$('empty-selection').hidden=false;$('selected-details').hidden=true;$('reset-btn').disabled=true;$('map-message').textContent='Select a river line to begin tracing';redraw();setMobileOpen(false);$('mobile-open').textContent='☰  River explorer';}
// Clicking unoccupied map space clears a trace. River clicks stop here so
// their selection is not immediately cleared by the map's click listener.
map.on('click', reset);
$('reset-btn').addEventListener('click',reset);
$('outlet-btn').addEventListener('click',()=>select(outlet));
$('display-switch').addEventListener('click',e=>{const btn=e.target.closest('button[data-mode]');if(!btn)return;state.mode=btn.dataset.mode;for(const b of $('display-switch').querySelectorAll('button')){let active=b===btn;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}redraw()});
async function initialize(){
 try{
  const res=await fetch('data/ashley_rakahuri_reaches.geojson',{cache:'no-store'});
  if(!res.ok)throw new Error('River GeoJSON could not be loaded (HTTP '+res.status+')');
  const fc=await res.json();if(fc.type!=='FeatureCollection'||!Array.isArray(fc.features))throw new Error('Not a valid GeoJSON feature collection');
  for(const f of fc.features){const p=f.properties||{},id=Number(p.HydroID),n=Number(p.NextDownID);if(!Number.isInteger(id)||!Number.isInteger(n)||featuresById.has(id))throw new Error('Invalid or duplicate reach ID '+p.HydroID);featuresById.set(id,f);down.set(id,n);allLen+=Number(p.length_km)||0;}
  if(featuresById.size!==2706||down.get(outlet)!==-1)throw new Error('Unexpected river extract — count or outlet mismatch');
  for(const [id,n] of down){if(n!==-1){if(!featuresById.has(n))throw new Error('Broken downstream reference '+id+' → '+n);if(!up.has(n))up.set(n,[]);up.get(n).push(id)}}
  const validated=upstreamTrace(outlet);if(validated.size!==2705)throw new Error('Incomplete upstream network: '+validated.size+' reaches');
  geoLayer=L.geoJSON(fc,{renderer,style:f=>styleFor(Number(f.properties.HydroID)),onEachFeature:(f,layer)=>{
   const id=Number(f.properties.HydroID);displayed.set(id,layer);
   layer.on('click',e=>{L.DomEvent.stopPropagation(e);select(id)});
   layer.on('mouseover',()=>{if(state.selected!==id)layer.setStyle({weight:5,opacity:1})});
   layer.on('mouseout',()=>{layer.setStyle(styleFor(id))});
   layer.bindTooltip(`Reach ${fmt(id)} · order ${f.properties.StreamOrde}`,{sticky:true,direction:'top',opacity:0.96});
  }}).addTo(map);
  extent=geoLayer.getBounds();map.fitBounds(extent,{padding:[30,30],maxZoom:11});
  console.info('Connected Waters verified:',featuresById.size,'reaches,',allLen.toFixed(2),'km');
 }catch(err){console.error(err);showError(`${err.message}. For local testing, serve the folder via http://localhost rather than opening index.html directly.`)}
}
initialize();
})();
