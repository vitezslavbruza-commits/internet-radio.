const audio = document.getElementById('audio');
const list = document.getElementById('station-list');
const search = document.getElementById('search');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const title = document.getElementById('now-title');
const country = document.getElementById('now-country');
const statusText = document.getElementById('player-status');
let stations = [];
let current = null;
let filter = 'all';
let favorites = JSON.parse(localStorage.getItem('radiowave-favorites') || '[]');

const fallback = [
  {name:'Český rozhlas Radiožurnál',country:'Czechia',url:'https://rozhlas.stream/radiozurnal vysilani',favicon:''},
  {name:'Český rozhlas Dvojka',country:'Czechia',url:'https://rozhlas.stream/dvojka',favicon:''},
  {name:'Český rozhlas Vltava',country:'Czechia',url:'https://rozhlas.stream/vltava',favicon:''},
  {name:'Český rozhlas Plus',country:'Czechia',url:'https://rozhlas.stream/plus',favicon:''}
];

function normalize(s){return {...s, id:s.stationuuid || `${s.name}|${s.url}`, url_resolved:s.url_resolved || s.url, country:s.country || 'Neznámá země'};}
async function loadStations(){
  list.innerHTML='<div class="loading">Načítám stanice z katalogu…</div>';
  try{
    const endpoints=[
      'https://de1.api.radio-browser.info/json/stations/search?countrycode=CZ&limit=70&order=clickcount&reverse=true&hidebroken=true',
      'https://de1.api.radio-browser.info/json/stations/search?limit=90&order=clickcount&reverse=true&hidebroken=true'
    ];
    const results=await Promise.all(endpoints.map(u=>fetch(u).then(r=>{if(!r.ok)throw Error('Network');return r.json();})));
    const combined=[...results[0],...results[1]];
    const seen=new Set();
    stations=combined.map(normalize).filter(s=>s.name&&s.url_resolved&&!seen.has(s.url_resolved)&&seen.add(s.url_resolved));
    if(!stations.length) throw Error('No stations');
  }catch(e){
    stations=fallback.map(normalize);
    statusText.textContent='Katalog se nepodařilo načíst. Zobrazuji základní seznam.';
  }
  render();
}
function render(){
  const q=search.value.trim().toLowerCase();
  const shown=stations.filter(s=>{
    const isCzech=s.country==='Czechia'||s.countrycode==='CZ';
    const matchFilter=filter==='all'||(filter==='czech'&&isCzech)||(filter==='world'&&!isCzech)||(filter==='favorites'&&favorites.includes(s.id));
    return matchFilter&&(`${s.name} ${s.country} ${s.tags||''}`).toLowerCase().includes(q);
  });
  list.innerHTML='';
  if(!shown.length){list.innerHTML='<div class="empty">Žádné stanice jsem nenašel.</div>';return;}
  shown.forEach(s=>{
    const item=document.createElement('article');item.className='station';
    const logo=document.createElement('div');logo.className='station-logo';logo.textContent=(s.name||'R').trim().charAt(0).toUpperCase();
    const info=document.createElement('div');info.className='station-info';
    const name=document.createElement('strong');name.textContent=s.name;
    const meta=document.createElement('small');meta.textContent=s.country+(s.codec?' · '+s.codec:'');
    info.append(name,meta);
    const fav=document.createElement('button');fav.className='favorite'+(favorites.includes(s.id)?' selected':'');fav.textContent='♥';fav.title='Přidat/odebrat oblíbené';
    fav.addEventListener('click',()=>{favorites=favorites.includes(s.id)?favorites.filter(x=>x!==s.id):[...favorites,s.id];localStorage.setItem('radiowave-favorites',JSON.stringify(favorites));render();});
    const play=document.createElement('button');play.className='station-play';play.textContent='▶';play.title='Přehrát stanici';play.addEventListener('click',()=>playStation(s));
    item.append(logo,info,fav,play);list.append(item);
  });
}
async function playStation(s){
  current=s;title.textContent=s.name;country.textContent=s.country||'Internetová stanice';
  audio.src=s.url_resolved||s.url;audio.volume=Number(document.getElementById('volume').value);
  playBtn.disabled=false;stopBtn.disabled=false;playBtn.textContent='Ⅱ';statusText.textContent='Připojuji se ke streamu…';
  try{await audio.play();statusText.textContent='Přehrává se';}
  catch(e){playBtn.textContent='▶';statusText.textContent='Přehrávání se nepodařilo spustit. Zkus jinou stanici.';}
  if('mediaSession' in navigator){
    navigator.mediaSession.metadata=new MediaMetadata({title:s.name,artist:s.country||'RadioWave',album:'Internetové rádio'});
    navigator.mediaSession.setActionHandler('play',()=>audio.play());
    navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
  }
}
playBtn.addEventListener('click',async()=>{if(audio.paused){try{await audio.play();}catch(e){statusText.textContent='Stream není dostupný.';}}else audio.pause();});
audio.addEventListener('play',()=>{playBtn.textContent='Ⅱ';statusText.textContent='Přehrává se';});
audio.addEventListener('pause',()=>{playBtn.textContent='▶';if(current)statusText.textContent='Pozastaveno';});
audio.addEventListener('error',()=>{statusText.textContent='Tato stanice momentálně nefunguje nebo blokuje přehrávání.';playBtn.textContent='▶';});
stopBtn.addEventListener('click',()=>{audio.pause();audio.removeAttribute('src');audio.load();current=null;title.textContent='Vyber si stanici';country.textContent='Internetové rádio na jednom místě';statusText.textContent='Zastaveno';playBtn.disabled=true;stopBtn.disabled=true;});
document.getElementById('volume').addEventListener('input',e=>audio.volume=Number(e.target.value));
search.addEventListener('input',render);
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));render();}));
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
loadStations();
