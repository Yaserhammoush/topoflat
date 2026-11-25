const FALAK_COLOR = {
    mer: '#d5d5d5', ven: '#f0e2a0', mar: '#e07048',
    jup: '#e2b56a', sat: '#ecd7a4', ura: '#86dde0', nep: '#6d86f0'
};
var falakOn = false;
let falakPlanets = false;
let falakStars = false;
let falakCons = false;
let falakConsMode = 0;
let falakPlanetOn = { mer: true, ven: true, mar: true, jup: true, sat: true, ura: true, nep: true };
let falakSelectedPlanet = null;
let falakSelectedStar = null;
let falakHitStars = [];
let falakHitPlanets = [];

function falakSunRa() {
    const d0 = ((sunDayCounter % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
    const N = Math.floor(d0) + 1;
    const sunLam = ((360 / 365) * (N - 81) + 360) % 360;
    return equatorialFromEcliptic(sunLam, 0).ra;
}
function falakSub(ra, dec) {
    const sunRa = falakSunRa();
    let d = ra - sunRa;
    d = ((d + 180) % 360 + 360) % 360 - 180;
    let lon = sunLon + d;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { lat: dec, lon: lon };
}
function falakDays() {
    const inp = document.getElementById('azim-date-input');
    let year = 2026;
    if (inp && inp.value && inp.value.length >= 4) {
        const y = parseInt(inp.value.slice(0, 4), 10);
        if (y > 1000) year = y;
    }
    const d0 = ((sunDayCounter % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
    return (year - 2000) * 365.25 + d0 - 0.5;
}
function falakKepler(el, days) {
    const cy = days / 36525;
    const a = el.a + (el.da || 0) * cy;
    const e = Math.min(0.95, el.e + (el.de || 0) * cy);
    const I = (el.i + (el.di || 0) * cy) * Math.PI / 180;
    const L = (el.L + (el.dL || 0) * cy) * Math.PI / 180;
    const P = (el.W + (el.dW || 0) * cy) * Math.PI / 180;
    const N = (el.N + (el.dN || 0) * cy) * Math.PI / 180;
    let M = L - P;
    M = Math.atan2(Math.sin(M), Math.cos(M));
    let E = M;
    for (let k = 0; k < 8; k++) E = M + e * Math.sin(E);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const w = P - N;
    const vw = v + w;
    return {
        x: r * (Math.cos(N) * Math.cos(vw) - Math.sin(N) * Math.sin(vw) * Math.cos(I)),
        y: r * (Math.sin(N) * Math.cos(vw) + Math.cos(N) * Math.sin(vw) * Math.cos(I)),
        z: r * Math.sin(vw) * Math.sin(I),
        r: r
    };
}
function falakEq(x, y, z) {
    const eps = 23.439291 * Math.PI / 180;
    const xe = x;
    const ye = y * Math.cos(eps) - z * Math.sin(eps);
    const ze = y * Math.sin(eps) + z * Math.cos(eps);
    let ra = Math.atan2(ye, xe) * 180 / Math.PI;
    ra = ((ra % 360) + 360) % 360;
    const dec = Math.atan2(ze, Math.hypot(xe, ye)) * 180 / Math.PI;
    return { ra: ra, dec: dec };
}
let _falakEarthEl = null;
function falakEarthEl() {
    if (_falakEarthEl) return _falakEarthEl;
    _falakEarthEl = { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, W: 102.93768193, N: 0.0, da: 0.00000562, de: -0.00004392, di: -0.01294668, dL: 35999.37244981, dW: 0.32327364, dN: 0.0 };
    return _falakEarthEl;
}
function falakPlanetNow(p) {
    const days = falakDays();
    const earth = falakKepler(falakEarthEl(), days);
    const body = falakKepler(p.el, days);
    const eq = falakEq(body.x - earth.x, body.y - earth.y, body.z - earth.z);
    const sub = falakSub(eq.ra, eq.dec);
    const dist = Math.hypot(body.x - earth.x, body.y - earth.y, body.z - earth.z);
    return { ra: eq.ra, dec: eq.dec, lat: sub.lat, lon: sub.lon, au: dist, r: body.r };
}
function falakProject(lat, lon, w, h) {
    if (typeof geoToAzimuthalSun === 'function') return geoToAzimuthalSun(lat, lon, w, h);
    return geoToAzimuthal(lat, lon, w, h);
}
function falakBvName(bv) {
    if (bv < 0) return 'أزرق — حار';
    if (bv < 0.3) return 'أبيض مائل للأزرق';
    if (bv < 0.6) return 'أبيض';
    if (bv < 0.8) return 'أصفر — شبيه الشمس';
    if (bv < 1.4) return 'برتقالي';
    return 'أحمر — بارد';
}
function fmtH(deg) {
    const h = ((deg / 15) % 24 + 24) % 24;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return hh + 'س ' + mm + 'د';
}
const FALAK_STAR_AR = {
    Sirius: 'الشعرى اليمانية', Canopus: 'سهيل', Arcturus: 'السماك الرامح', Vega: 'النسر الواقع',
    Capella: 'العيوق', Rigel: 'رجل الجوزاء', Procyon: 'الشعرى الشامية', Achernar: 'آخر النهر',
    Betelgeuse: 'إبط الجوزاء', Hadar: 'حضار', Altair: 'النسر الطائر', Acrux: 'ألفا الصليب',
    Aldebaran: 'الدبران', Spica: 'السماك الأعزل', Antares: 'قلب العقرب', Pollux: 'رأس التوأم المؤخر',
    Fomalhaut: 'فم الحوت', Deneb: 'ذنب الدجاجة', Castor: 'رأس التوأم المقدم', Polaris: 'الجدي',
    Regulus: 'قلب الأسد', Adhara: 'العذارى', Bellatrix: 'المرزم', Alnilam: 'النظام', Alnitak: 'النطاق',
    Dubhe: 'الدبة', Alioth: 'الجون', Alkaid: 'القائد', Merak: 'المراق', Mizar: 'المئزر', Alcor: 'السها',
    Kochab: 'كوكب', Pherkad: 'الفرقد', Mirfak: 'المرفق', Algol: 'رأس الغول', Hamal: 'الحمل',
    Alpheratz: 'سرة الفرس', Denebola: 'الصرفة', Alphard: 'الفرد', Mintaka: 'المنطقة', Saiph: 'السيف',
    Elnath: 'النطح', Alhena: 'الهنعة', Naos: 'سهيل الحضار', Peacock: 'الطاووس', Atria: 'رأس المثلث',
    Alnair: 'النير', Nunki: 'النونكي', KausAustralis: 'القوس الجنوبي', Shaula: 'الشولة',
    'Kaus Australis': 'القوس الجنوبي', Rasalhague: 'رأس الحواء', Enif: 'أنف الفرس',
    Scheat: 'سعد الذابح', Markab: 'مركب الفرس', Aljanah: 'الجناح', Sadr: 'الصدر',
    Albireo: 'المنقار', Eltanin: 'التنين', Rastaban: 'رأس الثعبان', Thuban: 'الثعبان',
    Unukalhai: 'عنق الحية', Zubenelgenubi: 'الزبانى الجنوبي', Zubeneschamali: 'الزبانى الشمالي',
    Menkent: 'منكب قنطورس', 'Rigil Kentaurus': 'رجل قنطورس', Toliman: 'وزن قنطورس',
    Mimosa: 'الميموزا', Gacrux: 'غاما الصليب', Miaplacidus: 'ميا', Avior: 'أفيور',
    Menkalinan: 'منكب ذي الأعنة', Algieba: 'الجبهة', Algenib: 'الجنب', Mirach: 'المرزق',
    Almach: 'عناق الأرض', Caph: 'الكف', Shedar: 'الصدر', Ruchbah: 'الركبة',
    Diphda: 'الضفدع', Ankaa: 'العنقاء', Dschubba: 'الجبهة', Sabik: 'السابق',
    Rasalgethi: 'رأس الجاثي', Kornephoros: 'كورنيفوروس', Cursa: 'الكرسي',
    Alcyone: 'الثريا', Atlas: 'أطلس', Electra: 'إلكترا', Maia: 'مايا',
    Vindemiatrix: 'العذارى', Porrima: 'العواء', Gienah: 'الجناح', Algorab: 'الغراب',
    Kraz: 'الكراز', Alderamin: 'ذراع الأيمن', Alfirk: 'الفرقد', Sadalsuud: 'سعد السعود',
    Sadalmelik: 'سعد الملك', Dabih: 'الذابح', Nashira: 'سعد ناشرة', DenebAlgedi: 'ذنب الجدي',
    'Deneb Algedi': 'ذنب الجدي', Fawaris: 'الفوارس', Altais: 'الأرنب', Grumium: 'الخطم'
};
function falakPlainName(s) {
    return String(s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '');
}
function falakStarLabel(s) {
    if (!s) return '';
    const en = s[5] || '';
    if (en && FALAK_STAR_AR[en]) return FALAK_STAR_AR[en];
    if (en) return en;
    return 'HIP ' + s[0];
}
let falakNowStamp = 0;
function falakWriteNow(force) {
    const el = document.getElementById('falak-now');
    if (!el) return;
    const t = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (!force && t - falakNowStamp < 350) return;
    falakNowStamp = t;
    let html = '';
    if (falakSelectedPlanet && typeof FALAK_PLANETS !== 'undefined') {
        const p = FALAK_PLANETS.filter(function (x) { return x.id === falakSelectedPlanet; })[0];
        if (p) {
            const now = falakPlanetNow(p);
            html += '<div style="font-size:0.72rem;color:#cbd5e1;line-height:1.55;padding:6px;border:1px solid #3a506b;border-radius:6px;margin:4px 0 8px;">';
            html += '<b style="color:#ffe566">' + falakPlainName(p.ar) + '</b> ' + (p.sym || '') + '<br>';
            html += 'تعامد: ' + now.lat.toFixed(2) + '° ، ' + now.lon.toFixed(2) + '°<br>';
            html += 'المطلع: ' + fmtH(now.ra) + '<br>الميل: ' + now.dec.toFixed(2) + '°<br>';
            html += 'البعد عن الأرض: ' + now.au.toFixed(3) + ' و.ف.<br>';
            html += 'نصف المحور: ' + p.el.a.toFixed(3) + ' و.ف.';
            html += '</div>';
        }
    }
    if (falakSelectedStar) {
        const s = falakSelectedStar;
        const sub = falakSub(s[1], s[2]);
        html += '<div class="flight-title" style="margin:8px 0 6px;">النجم</div>';
        html += '<div style="display:flex;gap:8px;align-items:flex-start;font-size:0.72rem;color:#cbd5e1;line-height:1.55;padding:6px;border:1px solid #3a506b;border-radius:6px;">';
        html += '<canvas width="36" height="36" id="falak-star-icon" style="width:36px;height:36px;flex:0 0 36px;"></canvas>';
        html += '<div><b style="color:#ffe566">' + falakStarLabel(s) + '</b>';
        if (s[5] && FALAK_STAR_AR[s[5]]) html += '<br><span style="color:#94a3b8">' + s[5] + '</span>';
        html += '<br>HIP ' + s[0];
        html += '<br>القدر: ' + s[3].toFixed(2);
        html += '<br>اللون b−v: ' + s[4] + ' — ' + falakBvName(s[4]);
        html += '<br>المطلع: ' + fmtH(s[1]) + '<br>الميل: ' + s[2].toFixed(2) + '°';
        html += '<br>تعامد: ' + sub.lat.toFixed(2) + '° ، ' + sub.lon.toFixed(2) + '°';
        html += '</div></div>';
    }
    if (el.innerHTML !== html) el.innerHTML = html;
    const sc = document.getElementById('falak-star-icon');
    if (sc && falakSelectedStar) falakPaintStarIcon(sc, falakSelectedStar);
}
function toggleFalak() {
    falakOn = !falakOn;
    const menu = document.getElementById('falak-menu');
    const btn = document.getElementById('btn-falak');
    if (falakOn) {
        falakPlanets = true;
        if (menu) menu.style.display = 'block';
        if (btn) { btn.classList.add('open'); btn.textContent = 'فلك ▲'; }
        if (typeof ensureSunLoop === 'function') ensureSunLoop();
    } else {
        falakPlanets = falakStars = falakCons = false;
        falakConsMode = 0;
        falakSelectedStar = null;
        if (menu) menu.style.display = 'none';
        if (btn) { btn.classList.remove('open'); btn.textContent = 'فلك'; }
    }
    falakSyncTabs();
    falakRenderSide();
    if (typeof drawAzimuthal === 'function') drawAzimuthal();
    if (typeof updateAzim3D === 'function') updateAzim3D();
}
function falakLayersOn() {
    falakOn = !!(falakPlanets || falakStars || falakCons);
}
function toggleFalakLayer(which) {
    if (which === 'planets') falakPlanets = !falakPlanets;
    if (which === 'stars') { falakStars = !falakStars; if (!falakStars) falakSelectedStar = null; }
    if (which === 'cons') {
        falakConsMode = (falakConsMode + 1) % 3;
        falakCons = falakConsMode > 0;
    }
    falakLayersOn();
    falakSyncTabs();
    falakRenderSide();
    if (typeof ensureSunLoop === 'function') ensureSunLoop();
    if (typeof drawAzimuthal === 'function') drawAzimuthal();
    if (typeof updateAzim3D === 'function') updateAzim3D();
}
function falakSyncTabs() {
    const map = { planets: falakPlanets, stars: falakStars, cons: falakCons };
    Object.keys(map).forEach(function (k) {
        const b = document.getElementById('falak-tab-' + k);
        if (b) b.classList.toggle('active', !!map[k]);
    });
}
function falakSetPlanet(id, on) {
    falakPlanetOn[id] = on;
    if (on) falakPlanets = true;
    falakLayersOn();
    falakSyncTabs();
    falakRenderPlanets();
    falakRenderSide();
    if (typeof drawAzimuthal === 'function') drawAzimuthal();
    if (typeof updateAzim3D === 'function') updateAzim3D();
}
function falakSelectPlanet(id) {
    falakSelectedPlanet = falakSelectedPlanet === id ? null : id;
    falakRenderPlanets();
    falakRenderSide();
    if (typeof drawAzimuthal === 'function') drawAzimuthal();
    if (typeof updateAzim3D === 'function') updateAzim3D();
}
function falakRenderPlanets() {
    const box = document.getElementById('planet-drop');
    if (!box || typeof FALAK_PLANETS === 'undefined') return;
    let html = '<div class="planet-grid">';
    FALAK_PLANETS.forEach(function (p) {
        const on = falakPlanetOn[p.id] !== false;
        const sel = falakSelectedPlanet === p.id;
        const name = falakPlainName(p.ar);
        html += '<div class="planet-card' + (sel ? ' sel' : '') + (on ? '' : ' off') + '">';
        html += '<button type="button" class="planet-tog" title="' + (on ? 'إخفاء' : 'إظهار') + '" onclick="falakSetPlanet(\'' + p.id + '\',' + (!on) + ')"><img src="astro/planets/' + (on ? 'toggle-on.png' : 'toggle-off.png') + '" alt=""></button>';
        html += '<button type="button" class="planet-name" onclick="falakSelectPlanet(\'' + p.id + '\')"><img class="planet-ico' + (p.id === 'sat' ? ' sat' : '') + '" src="astro/planets/' + p.id + '.png" alt=""><span>' + name + '</span></button>';
        html += '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
}
function togglePlanetMenu(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const box = document.getElementById('planet-drop');
    const btn = document.getElementById('btn-planet-menu');
    if (!box) return;
    const open = box.style.display !== 'block';
    box.style.display = open ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', open);
    if (open) falakRenderPlanets();
}
function toggleStarSearch(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const box = document.getElementById('star-search-box');
    const btn = document.getElementById('btn-star-search');
    if (!box) return;
    const open = box.style.display !== 'block';
    box.style.display = open ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', open);
    if (open) {
        const inp = document.getElementById('star-search-input');
        if (inp) inp.focus();
    }
}
let falakSearchHits = [];
function falakStarSearchInput(q) {
    const box = document.getElementById('star-search-hits');
    if (!box) return;
    q = String(q || '').trim();
    falakSearchHits = falakFindStars(q);
    if (!q) { box.innerHTML = ''; return; }
    if (!falakSearchHits.length) {
        box.innerHTML = '<div style="color:#94a3b8;font-size:0.72rem;margin-top:4px;">لا يوجد نجم بهذا الاسم</div>';
        return;
    }
    box.innerHTML = falakSearchHits.map(function (s, i) {
        return '<button type="button" onclick="falakFocusStar(falakSearchHits[' + i + '])">' + falakStarLabel(s) + (s[5] ? ' · ' + s[5] : '') + ' · HIP ' + s[0] + '</button>';
    }).join('');
}
function falakFindStars(q) {
    const query = String(q || '').trim().toLowerCase();
    if (!query || query.length < 1) return [];
    const list = falakSkyStars();
    const hits = [];
    const hipQ = /^\d+$/.test(query);
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const en = s[5] ? String(s[5]).toLowerCase() : '';
        const ar = (s[5] && FALAK_STAR_AR[s[5]]) ? FALAK_STAR_AR[s[5]] : '';
        const hip = String(s[0]);
        let score = 0;
        if (hipQ && hip === query) score = 100;
        else if (!hipQ && ar && ar === query) score = 90;
        else if (!hipQ && en && en === query) score = 80;
        else if (!hipQ && ar && ar.indexOf(query) !== -1) score = 60;
        else if (!hipQ && en && en.indexOf(query) !== -1) score = 50;
        else if (!hipQ && ('hip ' + hip).indexOf(query) !== -1) score = 40;
        if (!score) continue;
        hits.push({ s: s, score: score, mag: s[3] });
    }
    hits.sort(function (a, b) { return b.score - a.score || a.mag - b.mag; });
    return hits.slice(0, 8).map(function (h) { return h.s; });
}
function falakStarSearchGo() {
    if (!falakSearchHits.length) {
        const inp = document.getElementById('star-search-input');
        falakStarSearchInput(inp ? inp.value : '');
    }
    if (falakSearchHits.length) falakFocusStar(falakSearchHits[0]);
}
function falakFocusStar(s) {
    if (!s) return;
    falakSelectedStar = s;
    if (!falakStars) falakStars = true;
    falakLayersOn();
    falakSyncTabs();
    falakRenderSide();
    if (typeof gleason3DMode !== 'undefined' && gleason3DMode && typeof toggleGleason3D === 'function') toggleGleason3D();
    const sub = falakSub(s[1], s[2]);
    if (typeof azimCanvas !== 'undefined' && azimCanvas) {
        if (!azimCanvas.width && typeof resizeAzimCanvas === 'function') resizeAzimCanvas();
        const w = azimCanvas.width, h = azimCanvas.height;
        if (w && h && typeof azimZoom !== 'undefined') {
            azimZoom = 3;
            azimOffsetX = 0;
            azimOffsetY = 0;
            const p = falakProject(sub.lat, sub.lon, w, h);
            if (p && isFinite(p.x)) {
                azimOffsetX = w / 2 - p.x;
                azimOffsetY = h / 2 - p.y;
            }
            if (typeof azimNeedsFullRedraw !== 'undefined') azimNeedsFullRedraw = true;
        }
    }
    if (typeof drawAzimuthal === 'function') drawAzimuthal();
    if (typeof updateAzim3D === 'function') updateAzim3D();
}
function falakRenderSide() {
    const box = document.getElementById('falak-side');
    if (!box) return;
    const show = !!(falakSelectedStar || falakSelectedPlanet);
    box.style.display = show ? 'block' : 'none';
    if (!show) return;
    let html = '<div id="falak-now"></div>';
    box.innerHTML = html;
    falakWriteNow(true);
}
function falakPaintIcon(c, id) {
    const g = c.getContext('2d');
    const col = FALAK_COLOR[id] || '#fff';
    g.clearRect(0, 0, 22, 22);
    g.beginPath();
    g.arc(11, 11, 8, 0, Math.PI * 2);
    g.fillStyle = col;
    g.fill();
    if (id === 'jup') {
        g.strokeStyle = 'rgba(120,70,20,0.7)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(4, 9); g.lineTo(18, 9); g.moveTo(4, 13); g.lineTo(18, 13); g.stroke();
    }
    if (id === 'sat') {
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(11, 11, 10, 3.2, -0.4, 0, Math.PI * 2); g.stroke();
    }
    if (id === 'mar') {
        g.fillStyle = '#fff';
        g.fillRect(16, 4, 2, 2);
    }
}
function falakPaintStarIcon(c, s) {
    const g = c.getContext('2d');
    const bv = s[4];
    const col = bv < 0.3 ? '#cfe4ff' : (bv > 1.2 ? '#ffd0a8' : '#fff6df');
    g.clearRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2;
    g.save();
    g.translate(cx, cy);
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const r = i % 2 === 0 ? 14 : 5;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.restore();
}
function falakRing(ctx, dec, w, h, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let pen = false;
    for (let lon = -180; lon <= 180; lon += 4) {
        const p = falakProject(dec, lon, w, h);
        if (!p || !isFinite(p.x)) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
        else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
}
var falakImgCache = {};
function falakPlanetImg(id) {
    if (falakImgCache[id]) return falakImgCache[id];
    const im = new Image();
    im.onload = function () {
        if (typeof drawAzimuthal === 'function') drawAzimuthal();
        if (typeof updateAzim3D === 'function') updateAzim3D();
    };
    im.src = 'astro/planets/' + id + '.png';
    falakImgCache[id] = im;
    return im;
}
const FALAK_ZODIAC_SIGNS = ['ari', 'tau', 'gem', 'cnc', 'leo', 'vir', 'lib', 'sco', 'sgr', 'cap', 'aqr', 'psc'];
const FALAK_ZODIAC_ID = { ari: 'Ari', tau: 'Tau', gem: 'Gem', cnc: 'Cnc', leo: 'Leo', vir: 'Vir', lib: 'Lib', sco: 'Sco', sgr: 'Sgr', cap: 'Cap', aqr: 'Aqr', psc: 'Psc' };
function falakZodiacImg(key) {
    if (!falakZodiacImg.cache) falakZodiacImg.cache = {};
    if (falakZodiacImg.cache[key]) return falakZodiacImg.cache[key];
    const im = new Image();
    im.onload = function () {
        if (typeof drawAzimuthal === 'function') drawAzimuthal();
        if (typeof updateAzim3D === 'function') updateAzim3D();
    };
    im.src = 'astro/zodiac/' + key + '.png?v=art';
    falakZodiacImg.cache[key] = im;
    return im;
}
function falakConsCenter(id) {
    if (typeof FALAK_CONS === 'undefined') return null;
    const c = FALAK_CONS.filter(function (x) { return x.id === id; })[0];
    if (!c) return null;
    let x = 0, y = 0, z = 0, n = 0;
    c.lines.forEach(function (seg) {
        seg.forEach(function (pt) {
            const ra = pt[0] * Math.PI / 180, dec = pt[1] * Math.PI / 180;
            const cd = Math.cos(dec);
            x += cd * Math.cos(ra);
            y += cd * Math.sin(ra);
            z += Math.sin(dec);
            n++;
        });
    });
    if (!n) return null;
    const ra = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const dec = Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI;
    const sub = falakSub(ra, dec);
    sub.ra = ra;
    sub.dec = dec;
    return sub;
}
function falakConsCoverDeg(id) {
    if (typeof FALAK_CONS === 'undefined') return 18;
    const c = FALAK_CONS.filter(function (x) { return x.id === id; })[0];
    const cen = falakConsCenter(id);
    if (!c || !cen) return 18;
    let maxRa = 4, maxDec = 4;
    const cdec = Math.cos(cen.dec * Math.PI / 180);
    c.lines.forEach(function (seg) {
        seg.forEach(function (pt) {
            let dra = pt[0] - cen.ra;
            while (dra > 180) dra -= 360;
            while (dra < -180) dra += 360;
            dra *= cdec;
            const ddec = pt[1] - cen.dec;
            if (Math.abs(dra) > maxRa) maxRa = Math.abs(dra);
            if (Math.abs(ddec) > maxDec) maxDec = Math.abs(ddec);
        });
    });
    return Math.max(10, Math.min(36, Math.max(maxRa, maxDec) * 2.35));
}
function drawFalakZodiac2D(ctx, projectLL, w, h) {
    if (falakConsMode !== 2 || !ctx || !projectLL) return;
    FALAK_ZODIAC_SIGNS.forEach(function (key) {
        const im = falakZodiacImg(key);
        if (!im.complete || !im.naturalWidth) return;
        const sub = falakConsCenter(FALAK_ZODIAC_ID[key]);
        if (!sub) return;
        const p = projectLL(sub.lat, sub.lon);
        const northSub = falakSub(sub.ra, Math.min(89, sub.dec + 4));
        const north = northSub && projectLL(northSub.lat, northSub.lon);
        if (!p || !north || !isFinite(p.x) || !isFinite(north.x)) return;
        if (p.x < -160 || p.y < -160 || p.x > w + 160 || p.y > h + 160) return;
        const step = Math.hypot(north.x - p.x, north.y - p.y) / 4;
        if (!isFinite(step) || step < 0.2 || step > h * 0.25) return;
        const cover = falakConsCoverDeg(FALAK_ZODIAC_ID[key]);
        const height = Math.max(42, Math.min(h * 0.38, step * cover));
        const aspect = im.naturalWidth / Math.max(1, im.naturalHeight);
        const width = height * aspect;
        const ang = Math.atan2(north.y - p.y, north.x - p.x);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang + Math.PI / 2);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22;
        ctx.drawImage(im, -width * 0.56, -height * 0.56, width * 1.12, height * 1.12);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(im, -width / 2, -height / 2, width, height);
        ctx.restore();
    });
}
function drawFalakOnObsDome(ctx, pos, skyDot, center, Rpx) {
    if (!falakOn || !ctx || !pos || !skyDot || typeof observerAltAz !== 'function') return;
    function sky(lat, lon) {
        const aa = observerAltAz(pos.lat, pos.lon, lat, lon);
        if (!aa || aa.alt < -0.012) return null;
        return skyDot(aa.alt, aa.az);
    }
    const names = (typeof azimZoom === 'number' ? azimZoom : 1) >= 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, Rpx, 0, Math.PI * 2);
    ctx.clip();
    if (falakConsMode === 2 && typeof FALAK_ZODIAC_SIGNS !== 'undefined') {
        FALAK_ZODIAC_SIGNS.forEach(function (key) {
            const im = falakZodiacImg(key);
            if (!im.complete || !im.naturalWidth) return;
            const sub = falakConsCenter(FALAK_ZODIAC_ID[key]);
            if (!sub) return;
            const p = sky(sub.lat, sub.lon);
            const northSub = falakSub(sub.ra, Math.min(88, sub.dec + 4));
            const north = northSub && sky(northSub.lat, northSub.lon);
            if (!p || !north) return;
            const cover = falakConsCoverDeg(FALAK_ZODIAC_ID[key]);
            const height = Math.max(28, Rpx * Math.min(0.42, cover / 70));
            const aspect = im.naturalWidth / Math.max(1, im.naturalHeight);
            const width = height * aspect;
            const ang = Math.atan2(north.y - p.y, north.x - p.x);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(ang + Math.PI / 2);
            ctx.globalAlpha = 0.92;
            ctx.drawImage(im, -width / 2, -height / 2, width, height);
            ctx.restore();
        });
    }
    if (falakCons && typeof FALAK_CONS !== 'undefined') {
        ctx.strokeStyle = 'rgba(186,220,255,0.92)';
        ctx.lineWidth = Math.max(1, Rpx * 0.007);
        ctx.fillStyle = 'rgba(214,228,255,0.95)';
        ctx.font = '11px Tajawal, sans-serif';
        ctx.textAlign = 'center';
        FALAK_CONS.forEach(function (c) {
            let sx = 0, sy = 0, n = 0;
            c.lines.forEach(function (seg) {
                ctx.beginPath();
                let pen = false;
                for (let i = 0; i < seg.length; i++) {
                    const sub = falakSub(seg[i][0], seg[i][1]);
                    const p = sky(sub.lat, sub.lon);
                    if (!p) { pen = false; continue; }
                    if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
                    else ctx.lineTo(p.x, p.y);
                    sx += p.x; sy += p.y; n++;
                }
                ctx.stroke();
            });
            if (names && n > 0) ctx.fillText(c.ar, sx / n, sy / n);
        });
    }
    if (falakStars && typeof FALAK_STARS !== 'undefined') {
        const list = (typeof falakSkyStars === 'function') ? falakSkyStars() : FALAK_STARS;
        const lim = names ? 5.2 : 3.6;
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s[3] > lim) continue;
            const sub = falakSub(s[1], s[2]);
            const p = sky(sub.lat, sub.lon);
            if (!p) continue;
            const rad = Math.max(1.1, (4.8 - s[3]) * 0.7);
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
            ctx.fillStyle = s[4] < 0.3 ? '#d6e6ff' : (s[4] > 1.2 ? '#ffd0a8' : '#fff6df');
            ctx.fill();
            if (names && s[5] && s[3] < 2.2) {
                ctx.fillStyle = 'rgba(255,246,220,0.9)';
                ctx.font = '10px Tajawal, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(falakStarLabel(s), p.x + rad + 2, p.y - 2);
            }
        }
    }
    if (falakPlanets && typeof FALAK_PLANETS !== 'undefined') {
        FALAK_PLANETS.forEach(function (p) {
            if (falakPlanetOn[p.id] === false) return;
            const now = falakPlanetNow(p);
            const pt = sky(now.lat, now.lon);
            if (!pt) return;
            const im = falakPlanetImg(p.id);
            const ready = im.complete && im.naturalWidth > 0;
            const r = Math.max(5, Rpx * (p.id === 'sat' ? 0.045 : 0.028));
            ctx.save();
            if (ready && p.id !== 'sat') {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(im, pt.x - r, pt.y - r, r * 2, r * 2);
            } else if (ready) {
                const dh = r * 2;
                const dw = dh * (im.naturalWidth / im.naturalHeight);
                ctx.drawImage(im, pt.x - dw * 0.5, pt.y - dh * 0.5, dw, dh);
            } else {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fillStyle = FALAK_COLOR[p.id] || '#fff';
                ctx.fill();
            }
            ctx.restore();
            if (names) {
                ctx.fillStyle = '#fff';
                ctx.font = '11px Tajawal, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(falakPlainName(p.ar), pt.x, pt.y + r + 11);
            }
        });
    }
    ctx.restore();
}
function drawFalakOnAzim(w, h) {
    if (!falakOn || typeof azimCtx === 'undefined' || (typeof gleason3DMode !== 'undefined' && gleason3DMode)) return;
    if (typeof FALAK_PLANETS === 'undefined') return;
    falakHitStars = [];
    falakHitPlanets = [];
    const ctx = azimCtx;
    function underDome(p) {
        return !!(p && typeof realBodyInsideObsDome === 'function' && realBodyInsideObsDome(p, w, h));
    }
    if (falakCons && typeof FALAK_CONS !== 'undefined') {
        ctx.save();
        ctx.strokeStyle = 'rgba(140,190,255,0.72)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(186,214,255,0.9)';
        ctx.font = '11px Tajawal, sans-serif';
        ctx.textAlign = 'center';
        FALAK_CONS.forEach(function (c) {
            let sx = 0, sy = 0, n = 0;
            c.lines.forEach(function (seg) {
                ctx.beginPath();
                let pen = false;
                let prev = null;
                for (let i = 0; i < seg.length; i++) {
                    const sub = falakSub(seg[i][0], seg[i][1]);
                    const p = falakProject(sub.lat, sub.lon, w, h);
                    if (!p || !isFinite(p.x) || underDome(p)) { pen = false; prev = null; continue; }
                    if (prev) {
                        const jump = Math.abs(sub.lon - prev.lon);
                        if (jump > 40 && jump < 320) { pen = false; }
                    }
                    if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
                    else ctx.lineTo(p.x, p.y);
                    prev = sub;
                    sx += p.x; sy += p.y; n++;
                }
                ctx.stroke();
            });
            if (n > 0 && azimZoom >= 1.4) ctx.fillText(c.ar, sx / n, sy / n);
        });
        ctx.restore();
    }
    if (falakStars && typeof FALAK_STARS !== 'undefined') {
        const z = Math.sqrt(Math.min(typeof azimZoom === 'number' ? azimZoom : 1, 6));
        FALAK_STARS.forEach(function (s) {
            const sub = falakSub(s[1], s[2]);
            const p = falakProject(sub.lat, sub.lon, w, h);
            if (!p || !isFinite(p.x) || underDome(p)) return;
            const rad = Math.max(0.7, (5.1 - s[3]) * 0.85) * (0.65 + 0.35 * z);
            const bv = s[4];
            const hot = bv < 0.3;
            const cool = bv > 1.2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
            ctx.fillStyle = hot ? '#cfe4ff' : (cool ? '#ffd0a8' : '#fff6df');
            ctx.fill();
            falakHitStars.push({ x: p.x, y: p.y, r: Math.max(7, rad + 4), s: s });
            if (s[5] && s[3] < 1.6 && azimZoom >= 1.6) {
                ctx.fillStyle = 'rgba(255,246,220,0.85)';
                ctx.font = '10px Tajawal, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(falakStarLabel(s), p.x + rad + 2, p.y - 2);
            }
        });
        if (falakSelectedStar) {
            const sub = falakSub(falakSelectedStar[1], falakSelectedStar[2]);
            const p = falakProject(sub.lat, sub.lon, w, h);
            if (p && isFinite(p.x)) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffe566';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }
        }
    }
    if (falakPlanets) {
        FALAK_PLANETS.forEach(function (p) {
            if (falakPlanetOn[p.id] === false) return;
            const now = falakPlanetNow(p);
            const col = FALAK_COLOR[p.id];
            falakRing(ctx, now.dec, w, h, col);
            const pt = falakProject(now.lat, now.lon, w, h);
            if (!pt || !isFinite(pt.x) || underDome(pt)) return;
            const sel = falakSelectedPlanet === p.id;
            const im = falakPlanetImg(p.id);
            const ready = im.complete && im.naturalWidth > 0;
            let half = sel ? 13 : 9;
            if (ready) {
                let dw, dh;
                if (p.id === 'sat') {
                    dh = sel ? 28 : 20;
                    dw = dh * (im.naturalWidth / im.naturalHeight);
                } else {
                    dw = dh = 18;
                }
                half = Math.max(dw, dh) * 0.5;
                ctx.save();
                if (p.id !== 'sat') {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, dw * 0.5, 0, Math.PI * 2);
                    ctx.clip();
                }
                ctx.drawImage(im, pt.x - dw * 0.5, pt.y - dh * 0.5, dw, dh);
                ctx.restore();
                if (sel) {
                    ctx.beginPath();
                    if (p.id === 'sat') ctx.ellipse(pt.x, pt.y, dw * 0.5 + 2, dh * 0.5 + 2, 0, 0, Math.PI * 2);
                    else ctx.arc(pt.x, pt.y, dw * 0.5 + 2, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ffe566';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            } else {
                const r = sel ? 8 : 5.5;
                half = r;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fillStyle = col;
                ctx.fill();
                ctx.lineWidth = sel ? 2 : 1;
                ctx.strokeStyle = sel ? '#ffe566' : 'rgba(255,255,255,0.7)';
                ctx.stroke();
            }
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px Tajawal, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(falakPlainName(p.ar), pt.x, pt.y + half + 12);
            falakHitPlanets.push({ x: pt.x, y: pt.y, r: Math.max(14, half + 4), id: p.id });
        });
    }
    drawFalakZodiac2D(ctx, function (lat, lon) {
        const p = falakProject(lat, lon, w, h);
        if (underDome(p)) return null;
        return p;
    }, w, h);
    falakWriteNow(false);
}
function falakPickAt(x, y) {
    if (!falakOn) return false;
    let best = null;
    let bestD = 1e9;
    if (falakPlanets) {
        falakHitPlanets.forEach(function (h) {
            const d = Math.hypot(x - h.x, y - h.y);
            if (d < h.r && d < bestD) { bestD = d; best = { kind: 'p', id: h.id }; }
        });
    }
    if (falakStars) {
        falakHitStars.forEach(function (h) {
            const d = Math.hypot(x - h.x, y - h.y);
            if (d < h.r && d < bestD) { bestD = d; best = { kind: 's', s: h.s }; }
        });
    }
    if (!best) return false;
    if (best.kind === 'p') falakSelectPlanet(best.id);
    else {
        falakSelectedStar = best.s;
        falakRenderSide();
        if (typeof drawAzimuthal === 'function') drawAzimuthal();
        if (typeof updateAzim3D === 'function') updateAzim3D();
    }
    return true;
}

let falak3dGroup = null;
let falak3dStars = null;
let falak3dCons = null;
let falak3dOrbits = null;
let falak3dZodiac = null;
let falak3dPlanets = null;
let falak3dPick = [];
let falak3dLabelKey = '';

function falakDomeAt(lat, lon, lift) {
    const g = gleasonLatLonTo3D(lat, lon);
    let y = capShellY(g.x, g.z);
    if (!isFinite(y)) y = 0.05;
    const n = falakCapNormal(g.x, y, g.z);
    const L = lift == null ? 0.025 : lift;
    return {
        x: g.x + n.x * L, y: y + n.y * L, z: g.z + n.z * L,
        nx: n.x, ny: n.y, nz: n.z, lat: lat, lon: lon
    };
}
function falakDomeFront(p) {
    const cam = azim3dCamera.position;
    return (cam.x - p.x) * p.nx + (cam.y - p.y) * p.ny + (cam.z - p.z) * p.nz > 0.02;
}
function falakObserverCam() {
    return !!(typeof observer3DReadyCam !== 'undefined' && observer3DReadyCam
        && typeof observerDomeOn !== 'undefined' && observerDomeOn
        && typeof gleason3DMode !== 'undefined' && gleason3DMode
        && typeof observer3DPos !== 'undefined' && observer3DPos
        && typeof observerSkyPoint === 'function' && typeof observerAltAz === 'function');
}
function falakObsPoint(lat, lon) {
    if (!observer3DPos) return null;
    const aa = observerAltAz(observer3DPos.lat, observer3DPos.lon, lat, lon);
    if (!aa || aa.alt < -0.012) return null;
    const p = observerSkyPoint(observer3DPos, lat, lon);
    if (!p || !isFinite(p.x)) return null;
    p.lat = lat;
    p.lon = lon;
    p.alt = aa.alt;
    p.nx = 0; p.ny = 1; p.nz = 0;
    return p;
}
const FALAK_BODY_KM = { mer: 2440, ven: 6052, mar: 3389, jup: 69911, sat: 58232, ura: 25362, nep: 24622 };
function falakPlanetAngR(id, au) {
    const rk = FALAK_BODY_KM[id] || 6000;
    const dist = Math.max(0.15, au || 1) * 149597870.7;
    return Math.atan(rk / dist);
}
function falakFovDeg() {
    if (typeof observerFov === 'number' && isFinite(observerFov)) return observerFov;
    if (typeof azim3dCamera !== 'undefined' && azim3dCamera && azim3dCamera.fov) return azim3dCamera.fov;
    return 78;
}
function falakSkyStars() {
    if (typeof FALAK_STARS_SKY !== 'undefined' && FALAK_STARS_SKY.length) return FALAK_STARS_SKY;
    return (typeof FALAK_STARS !== 'undefined') ? FALAK_STARS : [];
}
function falakMagLimit(fov) {
    const f = (typeof fov === 'number') ? fov : 78;
    return Math.min(8.05, 6.2 + Math.max(0, 78 - f) * 0.04);
}
function falakStarPixels(mag, fov) {
    const boost = Math.pow(78 / Math.max(0.8, fov || 78), 0.7);
    return Math.max(1.05, (7.2 - mag) * 0.55) * boost;
}
function drawFalakInObserver(ctx, project, w, h, fovDeg) {
    if (!falakOn || !ctx || !project || typeof observer3DPos === 'undefined' || !observer3DPos) return;
    const fov = Math.max(0.8, fovDeg || falakFovDeg());
    const boost = 78 / fov;
    const pos = observer3DPos;
    if (falakCons && typeof FALAK_CONS !== 'undefined') {
        ctx.save();
        ctx.strokeStyle = 'rgba(170,205,255,0.78)';
        ctx.lineWidth = Math.max(1, 1.15 * Math.min(boost, 2.2));
        ctx.fillStyle = 'rgba(214,228,255,0.92)';
        ctx.font = '12px Tajawal, sans-serif';
        ctx.textAlign = 'center';
        FALAK_CONS.forEach(function (c) {
            let sx = 0, sy = 0, n = 0;
            c.lines.forEach(function (seg) {
                ctx.beginPath();
                let pen = false;
                for (let i = 0; i < seg.length; i++) {
                    const sub = falakSub(seg[i][0], seg[i][1]);
                    const aa = observerAltAz(pos.lat, pos.lon, sub.lat, sub.lon);
                    if (!aa || aa.alt < -0.012) { pen = false; continue; }
                    const p = project(aa.alt, aa.az);
                    if (!p) { pen = false; continue; }
                    if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
                    else ctx.lineTo(p.x, p.y);
                    sx += p.x; sy += p.y; n++;
                }
                ctx.stroke();
            });
            if (n > 2 && fov <= 52) ctx.fillText(c.ar, sx / n, sy / n);
        });
        ctx.restore();
    }
    if (falakStars) {
        const sky = falakSkyStars();
        const lim = falakMagLimit(fov);
        for (let i = 0; i < sky.length; i++) {
            const s = sky[i];
            if (s[3] > lim) continue;
            const rad0 = falakStarPixels(s[3], fov);
            const focusPx = (typeof obsFocusPx === 'function') ? obsFocusPx('s', s) : 0;
            const rad = focusPx || rad0;
            const sub = falakSub(s[1], s[2]);
            const aa = observerAltAz(pos.lat, pos.lon, sub.lat, sub.lon);
            if (!aa || aa.alt < -0.012) continue;
            const p = project(aa.alt, aa.az);
            if (!p || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) continue;
            const bv = s[4];
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
            ctx.fillStyle = bv < 0.3 ? '#d6e6ff' : (bv > 1.2 ? '#ffd0a8' : '#fff6df');
            ctx.fill();
            if (falakSelectedStar && falakSelectedStar[0] === s[0]) {
                ctx.strokeStyle = '#ffe566';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (s[5] && s[3] < 1.8 && fov <= 36) {
                ctx.fillStyle = 'rgba(255,246,220,0.9)';
                ctx.font = '11px Tajawal, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(falakStarLabel(s), p.x + rad + 2, p.y - 2);
            }
        }
    }
    if (falakPlanets && typeof FALAK_PLANETS !== 'undefined') {
        const tanV = Math.tan((fov * Math.PI / 180) / 2);
        let marsRpx = 3.4;
        const marsP = FALAK_PLANETS.filter(function (x) { return x.id === 'mar'; })[0];
        if (marsP) {
            const mn = falakPlanetNow(marsP);
            marsRpx = Math.max((h / 2) * Math.tan(falakPlanetAngR('mar', mn.au)) / tanV, 3.4);
        }
        FALAK_PLANETS.forEach(function (p) {
            if (falakPlanetOn[p.id] === false) return;
            const now = falakPlanetNow(p);
            const aa = observerAltAz(pos.lat, pos.lon, now.lat, now.lon);
            if (!aa || aa.alt < -0.012) return;
            const pt = project(aa.alt, aa.az);
            if (!pt || pt.x < -40 || pt.x > w + 40 || pt.y < -40 || pt.y > h + 40) return;
            const trueR = (h / 2) * Math.tan(falakPlanetAngR(p.id, now.au)) / tanV;
            const r0 = p.id === 'sat' ? Math.max(trueR * 2.25, 3.4) : marsRpx;
            const focusPx = (typeof obsFocusPx === 'function') ? obsFocusPx('p', p.id) : 0;
            const r = focusPx || r0;
            const im = falakPlanetImg(p.id);
            const ready = im.complete && im.naturalWidth > 0;
            ctx.save();
            if (ready && p.id !== 'sat') {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(im, pt.x - r, pt.y - r, r * 2, r * 2);
            } else if (ready) {
                const dh = r * 2;
                const dw = dh * (im.naturalWidth / im.naturalHeight);
                ctx.drawImage(im, pt.x - dw * 0.5, pt.y - dh * 0.5, dw, dh);
            } else {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fillStyle = FALAK_COLOR[p.id] || '#fff';
                ctx.fill();
            }
            ctx.restore();
            if (falakSelectedPlanet === p.id) {
                ctx.strokeStyle = '#ffe566';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r + 4, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (fov <= 46) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '11px Tajawal, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(falakPlainName(p.ar), pt.x, pt.y + r + 12);
            }
        });
    }
    ctx.save();
    const horizonY = (project && typeof project.horizonY === 'number') ? project.horizonY : h * 0.62;
    ctx.beginPath();
    ctx.rect(-400, -400, w + 800, Math.max(0, horizonY) + 400);
    ctx.clip();
    drawFalakZodiac2D(ctx, function (lat, lon) {
        const aa = observerAltAz(pos.lat, pos.lon, lat, lon);
        if (!aa || aa.alt < -0.62) return null;
        return project(aa.alt, aa.az);
    }, w, h);
    ctx.restore();
}
function falakRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function falakStarRgb(bv) {
    if (bv < 0.3) return [0.81, 0.89, 1];
    if (bv > 1.2) return [1, 0.82, 0.66];
    return [1, 0.965, 0.87];
}
function falakMakeSprite(text, fill) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    g.font = 'bold 34px Tajawal, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(4,10,24,0.85)';
    g.strokeText(text, 128, 34);
    g.fillStyle = fill || '#fff6df';
    g.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: true
    }));
    sp.renderOrder = 14;
    sp.userData.tex = tex;
    return sp;
}
function falakSpriteScale(sp, pxW, pxH) {
    if (typeof azim3dPxWorld !== 'function') {
        sp.scale.set(1.2, 0.3, 1);
        return;
    }
    sp.scale.set(azim3dPxWorld(pxW), azim3dPxWorld(pxH), 1);
}
function falakSpriteScaleDist(sp, pxW, pxH, dist) {
    const h = (typeof azim3dRenderer !== 'undefined' && azim3dRenderer && azim3dRenderer.domElement && azim3dRenderer.domElement.clientHeight) || 800;
    const fov = ((typeof azim3dCamera !== 'undefined' && azim3dCamera && azim3dCamera.fov) || 78) * Math.PI / 180;
    const d = Math.max(0.05, dist || 1);
    const s = pxW * (2 * Math.tan(fov / 2) * d) / Math.max(200, h);
    sp.scale.set(s, s * (pxH / Math.max(1, pxW)), 1);
}
function falakDiskMaterial(tex) {
    return new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, uSel: { value: 0 } },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        vertexShader: [
            'varying vec3 vN;',
            'varying float vFloorY;',
            'void main(){',
            '  vN = normalize(normalMatrix * normal);',
            '  vFloorY = (modelMatrix * vec4(position, 1.0)).y;',
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'precision mediump float;',
            'uniform sampler2D map;',
            'uniform float uSel;',
            'varying vec3 vN;',
            'varying float vFloorY;',
            'void main(){',
            '  if (vFloorY < -0.002) discard;',
            '  vec3 n = normalize(vN);',
            '  if (n.z < 0.02) discard;',
            '  vec2 uv = vec2(n.x * 0.5 + 0.5, n.y * 0.5 + 0.5);',
            '  vec4 c = texture2D(map, uv);',
            '  if (c.a < 0.15) discard;',
            '  float rim = smoothstep(0.22, 0.0, n.z);',
            '  vec3 rgb = mix(c.rgb, vec3(1.0, 0.90, 0.40), rim * uSel);',
            '  gl_FragColor = vec4(rgb, 1.0);',
            '}'
        ].join('\n')
    });
}
function falakPlanetTexture(id) {
    const im = falakPlanetImg(id);
    const tex = new THREE.Texture(im);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = !!im.complete;
    const kick = function () { tex.needsUpdate = true; };
    if (im.complete && im.naturalWidth) kick();
    else im.addEventListener('load', kick);
    return tex;
}
function falakEnsure3D() {
    if (falak3dGroup) return;
    falak3dGroup = new THREE.Group();
    falak3dGroup.name = 'falak3d';
    const starGeo = new THREE.BufferGeometry();
    const n = (function () {
        const a = (typeof FALAK_STARS !== 'undefined') ? FALAK_STARS.length : 0;
        const b = (typeof FALAK_STARS_SKY !== 'undefined') ? FALAK_STARS_SKY.length : 0;
        return Math.max(a, b, 1);
    })();
    starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    const starMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        vertexShader: [
            'attribute float aSize;',
            'attribute vec3 color;',
            'varying vec3 vColor;',
            'varying float vFloorY;',
            'void main(){',
            '  vColor = color;',
            '  vFloorY = (modelMatrix * vec4(position, 1.0)).y;',
            '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
            '  gl_Position = projectionMatrix * mv;',
            '  gl_PointSize = aSize * (72.0 / max(1.0, -mv.z));',
            '}'
        ].join('\n'),
        fragmentShader: [
            'precision mediump float;',
            'varying vec3 vColor;',
            'varying float vFloorY;',
            'void main(){',
            '  if (vFloorY < -0.002) discard;',
            '  vec2 p = gl_PointCoord - vec2(0.5);',
            '  float d = length(p);',
            '  if (d > 0.5) discard;',
            '  float a = smoothstep(0.5, 0.12, d);',
            '  gl_FragColor = vec4(vColor, a);',
            '}'
        ].join('\n')
    });
    falak3dStars = new THREE.Points(starGeo, starMat);
    falak3dStars.renderOrder = 9;
    falak3dStars.frustumCulled = false;
    falak3dGroup.add(falak3dStars);
    const lineMat = function () {
        return new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false
        });
    };
    falak3dCons = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat());
    falak3dCons.renderOrder = 8;
    falak3dCons.frustumCulled = false;
    falak3dGroup.add(falak3dCons);
    falak3dOrbits = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat());
    falak3dOrbits.renderOrder = 8;
    falak3dOrbits.frustumCulled = false;
    falak3dGroup.add(falak3dOrbits);
    falak3dZodiac = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat());
    falak3dZodiac.renderOrder = 8;
    falak3dZodiac.frustumCulled = false;
    falak3dGroup.add(falak3dZodiac);
    falak3dPlanets = {};
    if (typeof FALAK_PLANETS !== 'undefined') {
        FALAK_PLANETS.forEach(function (p) {
            const tex = falakPlanetTexture(p.id);
            let mesh;
            if (p.id === 'sat') {
                const im = falakPlanetImg(p.id);
                mesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(1, 1),
                    new THREE.MeshBasicMaterial({
                        map: tex, transparent: true, depthTest: true, depthWrite: false,
                        side: THREE.DoubleSide, alphaTest: 0.12
                    })
                );
                mesh.userData.billboard = true;
                mesh.userData.aspect = (im.naturalWidth && im.naturalHeight) ? (im.naturalWidth / im.naturalHeight) : (409 / 248);
                im.addEventListener('load', function () {
                    if (im.naturalHeight) mesh.userData.aspect = im.naturalWidth / im.naturalHeight;
                    tex.needsUpdate = true;
                });
            } else {
                mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), falakDiskMaterial(tex));
            }
            mesh.renderOrder = 11;
            mesh.frustumCulled = false;
            const label = falakMakeSprite(falakPlainName(p.ar), '#ffffff');
            falak3dGroup.add(mesh);
            falak3dGroup.add(label);
            falak3dPlanets[p.id] = { mesh: mesh, label: label };
        });
    }
    falak3dGroup.userData.starLabel = falakMakeSprite('', '#ffe566');
    falak3dGroup.userData.starLabel.visible = false;
    falak3dGroup.add(falak3dGroup.userData.starLabel);
    falak3dGroup.userData.consLabels = {};
    azim3dScene.add(falak3dGroup);
}
function falakSetLineGeo(line, xyz, rgb) {
    const n = (xyz.length / 3) | 0;
    const g = line.geometry;
    let pos = g.getAttribute('position');
    let col = g.getAttribute('color');
    if (!pos || pos.count < n) {
        const cap = Math.max(n, pos ? pos.count * 2 : 512);
        pos = new THREE.BufferAttribute(new Float32Array(cap * 3), 3);
        col = new THREE.BufferAttribute(new Float32Array(cap * 3), 3);
        if (THREE.DynamicDrawUsage) {
            pos.setUsage(THREE.DynamicDrawUsage);
            col.setUsage(THREE.DynamicDrawUsage);
        }
        g.setAttribute('position', pos);
        g.setAttribute('color', col);
    }
    if (n) {
        pos.array.set(xyz);
        col.array.set(rgb);
        pos.needsUpdate = true;
        col.needsUpdate = true;
        pos.updateRange.offset = 0;
        pos.updateRange.count = n * 3;
        col.updateRange.offset = 0;
        col.updateRange.count = n * 3;
    }
    g.setDrawRange(0, n);
    if (n) g.computeBoundingSphere();
}
function falakPushSeg(xyz, rgb, a, b, col, steps) {
    const n = Math.max(1, steps || 1);
    const eye = falakObserverCam();
    let prev = null;
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        let dlon = b.lon - a.lon;
        if (dlon > 180) dlon -= 360;
        if (dlon < -180) dlon += 360;
        const lat = a.lat + (b.lat - a.lat) * t;
        let lon = a.lon + dlon * t;
        lon = ((lon + 180) % 360 + 360) % 360 - 180;
        const p = eye ? falakObsPoint(lat, lon) : falakDomeAt(lat, lon, 0.03);
        const front = p && (eye ? true : falakDomeFront(p));
        if (prev && front) {
            xyz.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
            rgb.push(col[0], col[1], col[2], col[0], col[1], col[2]);
        }
        prev = front ? p : null;
    }
}
function syncFalak3D(domeOn) {
    if (typeof THREE === 'undefined' || typeof azim3dScene === 'undefined' || !azim3dScene) return;
    const eye = falakObserverCam();
    const shell = !!(falakOn && gleason3DMode && typeof observerDomeOn !== 'undefined' && observerDomeOn && observer3DPos && !eye);
    if (!falakOn || (!domeOn && !eye) || !gleason3DMode) {
        if (falak3dGroup) falak3dGroup.visible = false;
        const eyeBag = falak3dGroup && falak3dGroup.userData.zodiacEye;
        if (eyeBag && !shell) Object.keys(eyeBag).forEach(function (k) { eyeBag[k].visible = false; });
        syncFalakObsShell(shell);
        return;
    }
    if (typeof gleasonLatLonTo3D !== 'function' || typeof capShellY !== 'function' || typeof falakCapNormal !== 'function') return;
    falakEnsure3D();
    falak3dGroup.visible = true;
    if (falak3dStars && falak3dStars.material) falak3dStars.material.depthTest = !eye;
    if (falak3dCons && falak3dCons.material) falak3dCons.material.depthTest = !eye;
    if (falak3dStars) falak3dStars.renderOrder = eye ? 12 : 9;
    if (falak3dCons) falak3dCons.renderOrder = eye ? 11 : 8;
    falak3dPick = [];
    falakWriteNow(false);
    const showStars = !!(falakStars && typeof FALAK_STARS !== 'undefined');
    falak3dStars.visible = showStars;
    if (showStars) {
        const pos = falak3dStars.geometry.getAttribute('position');
        const col = falak3dStars.geometry.getAttribute('color');
        const sz = falak3dStars.geometry.getAttribute('aSize');
        const pa = pos.array, ca = col.array, sa = sz.array;
        const list = eye ? falakSkyStars() : FALAK_STARS;
        const lim = eye ? falakMagLimit(falakFovDeg()) : 99;
        for (let i = 0; i < sa.length; i++) {
            const s = i < list.length ? list[i] : null;
            const o = i * 3;
            if (!s || (eye && s[3] > lim)) {
                pa[o] = 0; pa[o + 1] = -20; pa[o + 2] = 0;
                sa[i] = 0;
                continue;
            }
            const sub = falakSub(s[1], s[2]);
            const p = eye ? falakObsPoint(sub.lat, sub.lon) : falakDomeAt(sub.lat, sub.lon, 0.04);
            const front = p && (eye ? true : falakDomeFront(p));
            if (!front) {
                pa[o] = 0; pa[o + 1] = -20; pa[o + 2] = 0;
                sa[i] = 0;
                continue;
            }
            pa[o] = p.x; pa[o + 1] = p.y; pa[o + 2] = p.z;
            const rgb = falakStarRgb(s[4]);
            const sel = falakSelectedStar && falakSelectedStar[0] === s[0];
            ca[o] = sel ? 1 : rgb[0];
            ca[o + 1] = sel ? 0.9 : rgb[1];
            ca[o + 2] = sel ? 0.4 : rgb[2];
            if (eye) {
                const dist = Math.max(0.2, Math.hypot(p.x - observer3DPos.x, p.y - observer3DPos.y, p.z - observer3DPos.z));
                const pix0 = falakStarPixels(s[3], falakFovDeg()) * (sel ? 1.5 : 1);
                const focusPx = (typeof obsFocusPx === 'function') ? obsFocusPx('s', s) : 0;
                const pix = focusPx || pix0;
                sa[i] = pix * dist / 72;
            } else {
                sa[i] = Math.max(0.58, (5.15 - s[3]) * 0.58) * (sel ? 1.7 : 1);
            }
            if (!eye || s[3] <= 4.4 || s[5] || sel) falak3dPick.push({ kind: 's', s: s, x: p.x, y: p.y, z: p.z, lim: 11 });
        }
        pos.needsUpdate = true;
        col.needsUpdate = true;
        sz.needsUpdate = true;
        falak3dStars.geometry.computeBoundingSphere();
    }
    const starLabel = falak3dGroup.userData.starLabel;
    if (starLabel) {
        if (showStars && falakSelectedStar) {
            const s = falakSelectedStar;
            const sub = falakSub(s[1], s[2]);
            const p = eye ? falakObsPoint(sub.lat, sub.lon) : falakDomeAt(sub.lat, sub.lon, 0.12);
            const key = 's' + s[0];
            if (falak3dLabelKey !== key) {
                falak3dLabelKey = key;
                const g = starLabel.userData.tex.image.getContext('2d');
                g.clearRect(0, 0, 256, 64);
                g.font = 'bold 34px Tajawal, sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.lineWidth = 6;
                g.strokeStyle = 'rgba(4,10,24,0.85)';
                g.strokeText(falakStarLabel(s), 128, 34);
                g.fillStyle = '#ffe566';
                g.fillText(falakStarLabel(s), 128, 34);
                starLabel.userData.tex.needsUpdate = true;
            }
            if (!p) {
                starLabel.visible = false;
            } else {
                starLabel.visible = eye || falakDomeFront(p);
                if (eye) {
                    starLabel.position.set(p.x, p.y + 0.02, p.z);
                    const dist = Math.hypot(p.x - observer3DPos.x, p.y - observer3DPos.y, p.z - observer3DPos.z);
                    falakSpriteScaleDist(starLabel, 43, 11, dist);
                } else {
                    starLabel.position.set(p.x + p.nx * 0.12, p.y + p.ny * 0.12, p.z + p.nz * 0.12);
                    falakSpriteScale(starLabel, 43, 11);
                }
            }
        } else starLabel.visible = false;
    }
    const cxyz = [];
    const crgb = [];
    const showCons = !!(falakCons && typeof FALAK_CONS !== 'undefined');
    falak3dCons.visible = showCons;
    const consLabels = falak3dGroup.userData.consLabels;
    const near = (typeof azim3dDist === 'number' ? azim3dDist : 22) < 18;
    if (showCons) {
        const col = [0.62, 0.8, 1];
        FALAK_CONS.forEach(function (c) {
            let sx = 0, sy = 0, sz = 0, sn = 0;
            c.lines.forEach(function (seg) {
                let prev = null;
                for (let i = 0; i < seg.length; i++) {
                    const sub = falakSub(seg[i][0], seg[i][1]);
                    if (prev) {
                        const jump = Math.abs(sub.lon - prev.lon);
                        if (!(jump > 40 && jump < 320)) {
                            const chord = Math.hypot(
                                (sub.lat - prev.lat),
                                Math.min(jump, 360 - jump) * Math.cos(sub.lat * Math.PI / 180)
                            );
                            falakPushSeg(cxyz, crgb, prev, sub, col, Math.max(1, Math.ceil(chord / 6)));
                        }
                    }
                    const p = eye ? falakObsPoint(sub.lat, sub.lon) : falakDomeAt(sub.lat, sub.lon, 0.03);
                    if (p && (eye || falakDomeFront(p))) { sx += p.x; sy += p.y; sz += p.z; sn++; }
                    prev = sub;
                }
            });
            let lab = consLabels[c.id];
            if ((eye ? falakFovDeg() <= 52 : near) && sn > 0) {
                if (!lab) {
                    lab = falakMakeSprite(c.ar, '#dbeafe');
                    consLabels[c.id] = lab;
                    falak3dGroup.add(lab);
                }
                lab.visible = true;
                lab.position.set(sx / sn, sy / sn, sz / sn);
                if (eye) {
                    const dist = Math.hypot(sx / sn - observer3DPos.x, sy / sn - observer3DPos.y, sz / sn - observer3DPos.z);
                    falakSpriteScaleDist(lab, 33, 9, dist);
                } else falakSpriteScale(lab, 33, 9);
            } else if (lab) lab.visible = false;
        });
    } else {
        Object.keys(consLabels).forEach(function (id) { consLabels[id].visible = false; });
    }
    falakSetLineGeo(falak3dCons, cxyz, crgb);
    const oxyz = [];
    const orgb = [];
    const showPlanets = !!(falakPlanets && typeof FALAK_PLANETS !== 'undefined');
    falak3dOrbits.visible = showPlanets && !eye;
    if (falak3dPlanets) {
        Object.keys(falak3dPlanets).forEach(function (id) {
            falak3dPlanets[id].mesh.visible = false;
            falak3dPlanets[id].label.visible = false;
        });
    }
    if (showPlanets) {
        let marsAu = 1.52;
        const marsP = FALAK_PLANETS.filter(function (x) { return x.id === 'mar'; })[0];
        if (marsP) marsAu = falakPlanetNow(marsP).au;
        FALAK_PLANETS.forEach(function (p) {
            if (falakPlanetOn[p.id] === false) return;
            const now = falakPlanetNow(p);
            const col = falakRgb(FALAK_COLOR[p.id] || '#ffffff');
            const sel = falakSelectedPlanet === p.id;
            if (!eye) {
            let prev = null;
            for (let lon = -180; lon <= 180; lon += 4) {
                const cur = { lat: now.dec, lon: lon };
                if (prev) falakPushSeg(oxyz, orgb, prev, cur, col, 1);
                prev = cur;
            }
            }
            const body = eye ? falakObsPoint(now.lat, now.lon) : falakDomeAt(now.lat, now.lon, 0);
            const slot = falak3dPlanets[p.id];
            if (!slot || !body) return;
            const front = eye || falakDomeFront(body);
            let r = p.id === 'sat' ? (sel ? 0.12 : 0.078) : 0.078;
            let eyeDist = 1;
            if (eye) {
                eyeDist = Math.max(0.05, Math.hypot(body.x - observer3DPos.x, body.y - observer3DPos.y, body.z - observer3DPos.z));
                const fov = falakFovDeg() * Math.PI / 180;
                const hPx = (typeof azimCanvas !== 'undefined' && azimCanvas && azimCanvas.clientHeight) || 800;
                const trueR = eyeDist * Math.tan(falakPlanetAngR(p.id, now.au));
                const marsR = eyeDist * Math.tan(falakPlanetAngR('mar', marsAu));
                const minR = 0.5 * 4.2 * (2 * Math.tan(fov / 2) * eyeDist / Math.max(200, hPx));
                r = p.id === 'sat' ? Math.max(trueR * 2.25, minR) : Math.max(marsR, minR);
                const focusPx = (typeof obsFocusPx === 'function') ? obsFocusPx('p', p.id) : 0;
                if (focusPx) {
                    const hh = (typeof azimCanvas !== 'undefined' && azimCanvas && (azimCanvas.clientHeight || azimCanvas.height)) || 800;
                    const ang = Math.atan((focusPx / (hh / 2)) * Math.tan(fov / 2));
                    r = eyeDist * Math.tan(Math.max(1e-5, ang));
                }
            }
            slot.mesh.visible = front;
            slot.label.visible = front && (!eye || falakFovDeg() <= 46);
            if (!front) return;
            const bill = !!slot.mesh.userData.billboard;
            let half = r;
            if (eye) {
                slot.mesh.position.set(body.x, body.y, body.z);
                if (bill) {
                    const aspect = slot.mesh.userData.aspect || (409 / 248);
                    const hh = r * 2;
                    const ww = hh * aspect;
                    half = Math.max(ww, hh) * 0.5;
                    slot.mesh.scale.set(1, 1, 1);
                    if (azim3dCamera) slot.mesh.lookAt(azim3dCamera.position);
                    slot.mesh.scale.set(ww, hh, 1);
                } else {
                    slot.mesh.scale.setScalar(r);
                    half = r;
                    if (slot.mesh.material.uniforms && slot.mesh.material.uniforms.uSel) {
                        slot.mesh.material.uniforms.uSel.value = sel ? 1 : 0;
                    }
                }
                slot.label.position.set(body.x, body.y, body.z);
                falakSpriteScaleDist(slot.label, sel ? 56 : 44, sel ? 14 : 11, eyeDist);
            } else if (bill) {
                const aspect = slot.mesh.userData.aspect || (409 / 248);
                const h = r * 2.55;
                const w = h * aspect;
                half = Math.max(w, h) * 0.5;
                slot.mesh.scale.set(1, 1, 1);
                slot.mesh.position.set(body.x + body.nx * half, body.y + body.ny * half, body.z + body.nz * half);
                if (azim3dCamera) slot.mesh.lookAt(azim3dCamera.position);
                slot.mesh.scale.set(w, h, 1);
            } else {
                slot.mesh.scale.setScalar(r);
                slot.mesh.position.set(body.x + body.nx * r, body.y + body.ny * r, body.z + body.nz * r);
                if (slot.mesh.material.uniforms && slot.mesh.material.uniforms.uSel) {
                    slot.mesh.material.uniforms.uSel.value = sel ? 1 : 0;
                }
            }
            if (!eye) {
                slot.label.position.set(body.x + body.nx * (half + 0.11), body.y + body.ny * (half + 0.11), body.z + body.nz * (half + 0.11));
                falakSpriteScale(slot.label, sel ? 62.5 : 50, sel ? 16.25 : 12.5);
            }
            falak3dPick.push({ kind: 'p', id: p.id, x: slot.mesh.position.x, y: slot.mesh.position.y, z: slot.mesh.position.z, lim: bill ? 36 : 26 });
        });
    }
    falakSetLineGeo(falak3dOrbits, oxyz, orgb);
    if (falak3dZodiac) falak3dZodiac.visible = false;
    const oldLabs = falak3dGroup && falak3dGroup.userData.zodiacLabels;
    if (oldLabs) oldLabs.forEach(function (sp) { sp.visible = false; });
    if (falak3dGroup && typeof THREE !== 'undefined') {
        const showZ = falakConsMode === 2;
        if (typeof azim3dRenderer !== 'undefined' && azim3dRenderer) azim3dRenderer.localClippingEnabled = true;
        if (!falak3dGroup.userData.zodiacMeshes) falak3dGroup.userData.zodiacMeshes = {};
        if (!falak3dGroup.userData.horizonClip) {
            falak3dGroup.userData.horizonClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.012);
        }
        const bag = falak3dGroup.userData.zodiacMeshes;
        const oldSprites = falak3dGroup.userData.zodiacSprites;
        if (oldSprites) {
            Object.keys(oldSprites).forEach(function (k) {
                const s = oldSprites[k];
                if (s && s.parent) s.parent.remove(s);
            });
            falak3dGroup.userData.zodiacSprites = null;
        }
        FALAK_ZODIAC_SIGNS.forEach(function (key) {
            let mesh = bag[key];
            if (!mesh) {
                const im = falakZodiacImg(key);
                const tex = new THREE.Texture(im);
                tex.needsUpdate = true;
                if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                im.addEventListener('load', function () { tex.needsUpdate = true; if (typeof updateAzim3D === 'function') updateAzim3D(); });
                mesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(1, 1),
                    new THREE.MeshBasicMaterial({
                        map: tex, transparent: true, depthWrite: false, side: THREE.FrontSide,
                        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
                    })
                );
                mesh.renderOrder = 14;
                mesh.frustumCulled = false;
                falak3dGroup.add(mesh);
                bag[key] = mesh;
            }
            const sub = falakConsCenter(FALAK_ZODIAC_ID[key]);
            const cover = sub ? falakConsCoverDeg(FALAK_ZODIAC_ID[key]) : 16;
            let at = null;
            let north = null;
            let above = true;
            if (sub && eye) {
                at = falakObsPaintPoint(sub.lat, sub.lon);
                const subN = falakSub(sub.ra, Math.min(88, sub.dec + 3));
                north = subN && falakObsPaintPoint(subN.lat, subN.lon);
                const minAlt = -(cover * 0.55) * Math.PI / 180;
                above = !!(at && at.alt > minAlt);
                if (mesh) mesh.visible = false;
                const patch = falakEnsureZodiacEye(key);
                patch.visible = !!(showZ && at && north && above);
                if (!patch.visible) return;
                const im = falakZodiacImg(key);
                const aspect = (im.naturalWidth && im.naturalHeight) ? (im.naturalWidth / im.naturalHeight) : 1;
                falakLayZodiacOnDome(patch, at, north, cover, aspect);
                return;
            }
            const eyeBag = falak3dGroup.userData.zodiacEye;
            if (eyeBag && eyeBag[key]) eyeBag[key].visible = false;
            if (sub) {
                at = falakDomeAt(sub.lat, sub.lon, 0.045);
                const subN = falakSub(sub.ra, Math.min(88, sub.dec + 3));
                north = subN && falakDomeAt(subN.lat, subN.lon, 0.045);
            }
            mesh.visible = !!(showZ && at && north && above);
            if (!mesh.visible) return;
            mesh.position.set(at.x, at.y, at.z);
            if (mesh.material) {
                mesh.material.depthTest = !eye;
                mesh.material.clippingPlanes = eye ? [falak3dGroup.userData.horizonClip] : null;
                mesh.material.needsUpdate = true;
            }
            falakOrientPainting(mesh, at, north, !eye);
            let height = 0.35;
            const distN = Math.hypot(north.x - at.x, north.y - at.y, north.z - at.z);
            if (distN > 1e-4 && distN < 3.5) height = Math.max(0.06, distN / 3 * cover);
            const im = falakZodiacImg(key);
            const aspect = (im.naturalWidth && im.naturalHeight) ? (im.naturalWidth / im.naturalHeight) : 1;
            mesh.scale.set(height * aspect, height, 1);
        });
    }
    syncFalakObsShell(shell);
}
function falakShellPoint(lat, lon) {
    if (!observer3DPos || typeof observerSkyPointRaw !== 'function') return null;
    const raw = observerSkyPointRaw(observer3DPos, lat, lon);
    if (!raw || raw.alt < -0.012) return null;
    const domeR = (typeof azim3dObsDome !== 'undefined' && azim3dObsDome && azim3dObsDome.userData && azim3dObsDome.userData.R) || 0;
    const len = Math.hypot(raw.nx, raw.ny, raw.nz) || 1;
    const R = domeR > 0 ? domeR * 1.012 : Math.hypot(raw.x - observer3DPos.x, raw.y, raw.z - observer3DPos.z);
    const y = raw.ny / len * R;
    if (y < -0.002) return null;
    return {
        x: observer3DPos.x + raw.nx / len * R,
        y: Math.max(0.02, y),
        z: observer3DPos.z + raw.nz / len * R
    };
}
function syncFalakObsShell(on) {
    if (typeof THREE === 'undefined' || typeof azim3dScene === 'undefined' || !azim3dScene) return;
    if (!syncFalakObsShell.group) {
        const g = new THREE.Group();
        g.name = 'falakObsShell';
        const n = Math.max((typeof falakSkyStars === 'function' ? falakSkyStars().length : 1), 1);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
        const stars = new THREE.Points(geo, new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, depthTest: false,
            vertexShader: [
                'attribute float aSize;',
                'attribute vec3 color;',
                'varying vec3 vColor;',
                'void main(){',
                '  vColor = color;',
                '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
                '  gl_Position = projectionMatrix * mv;',
                '  gl_PointSize = aSize * (72.0 / max(1.0, -mv.z));',
                '}'
            ].join('\n'),
            fragmentShader: [
                'precision mediump float;',
                'varying vec3 vColor;',
                'void main(){',
                '  vec2 p = gl_PointCoord - vec2(0.5);',
                '  if (length(p) > 0.5) discard;',
                '  gl_FragColor = vec4(vColor, smoothstep(0.5, 0.12, length(p)));',
                '}'
            ].join('\n')
        }));
        stars.renderOrder = 15;
        stars.frustumCulled = false;
        g.add(stars);
        const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false
        }));
        lines.renderOrder = 14;
        lines.frustumCulled = false;
        g.add(lines);
        g.userData.stars = stars;
        g.userData.lines = lines;
        g.userData.planets = {};
        azim3dScene.add(g);
        syncFalakObsShell.group = g;
    }
    const g = syncFalakObsShell.group;
    if (!on) { g.visible = false; return; }
    g.visible = true;
    const stars = g.userData.stars;
    const showStars = !!(falakStars && typeof FALAK_STARS !== 'undefined');
    stars.visible = showStars;
    if (showStars) {
        const pos = stars.geometry.getAttribute('position');
        const col = stars.geometry.getAttribute('color');
        const sz = stars.geometry.getAttribute('aSize');
        const pa = pos.array, ca = col.array, sa = sz.array;
        const list = falakSkyStars();
        const lim = 4.4;
        for (let i = 0; i < sa.length; i++) {
            const s = i < list.length ? list[i] : null;
            const o = i * 3;
            const sub = s && falakSub(s[1], s[2]);
            const p = (s && s[3] <= lim) ? falakShellPoint(sub.lat, sub.lon) : null;
            if (!p) { pa[o] = 0; pa[o + 1] = -20; pa[o + 2] = 0; sa[i] = 0; continue; }
            pa[o] = p.x; pa[o + 1] = p.y; pa[o + 2] = p.z;
            const rgb = falakStarRgb(s[4]);
            ca[o] = rgb[0]; ca[o + 1] = rgb[1]; ca[o + 2] = rgb[2];
            sa[i] = Math.max(0.28, (4.6 - s[3]) * 0.16);
        }
        pos.needsUpdate = true; col.needsUpdate = true; sz.needsUpdate = true;
    }
    const xyz = [], rgb = [];
    const lines = g.userData.lines;
    lines.visible = !!(falakCons && typeof FALAK_CONS !== 'undefined');
    if (lines.visible) {
        const col = [0.72, 0.86, 1];
        FALAK_CONS.forEach(function (c) {
            c.lines.forEach(function (seg) {
                let prev = null;
                for (let i = 0; i < seg.length; i++) {
                    const sub = falakSub(seg[i][0], seg[i][1]);
                    const p = falakShellPoint(sub.lat, sub.lon);
                    if (prev && p) {
                        xyz.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
                        rgb.push(col[0], col[1], col[2], col[0], col[1], col[2]);
                    }
                    prev = p;
                }
            });
        });
    }
    falakSetLineGeo(lines, xyz, rgb);
    if (!g.userData.planetsReady && typeof FALAK_PLANETS !== 'undefined') {
        FALAK_PLANETS.forEach(function (p) {
            const tex = falakPlanetTexture(p.id);
            let mesh;
            if (p.id === 'sat') {
                mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
                    map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.12
                }));
                mesh.userData.billboard = true;
            } else {
                mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), falakDiskMaterial(tex));
                mesh.material.depthTest = false;
            }
            mesh.renderOrder = 16;
            mesh.frustumCulled = false;
            mesh.visible = false;
            g.add(mesh);
            g.userData.planets[p.id] = mesh;
        });
        g.userData.planetsReady = true;
    }
    Object.keys(g.userData.planets).forEach(function (id) { g.userData.planets[id].visible = false; });
    if (falakPlanets && typeof FALAK_PLANETS !== 'undefined') {
        const domeR = (azim3dObsDome && azim3dObsDome.userData && azim3dObsDome.userData.R) || 3;
        FALAK_PLANETS.forEach(function (p) {
            if (falakPlanetOn[p.id] === false) return;
            const now = falakPlanetNow(p);
            const body = falakShellPoint(now.lat, now.lon);
            const mesh = g.userData.planets[p.id];
            if (!body || !mesh) return;
            const r = (p.id === 'sat' ? 0.055 : 0.034) * domeR;
            mesh.visible = true;
            mesh.position.set(body.x, body.y, body.z);
            if (mesh.userData.billboard) {
                const aspect = 409 / 248;
                if (azim3dCamera) mesh.lookAt(azim3dCamera.position);
                mesh.scale.set(r * 2 * aspect, r * 2, 1);
            } else mesh.scale.setScalar(r);
        });
    }
    if (typeof FALAK_ZODIAC_SIGNS !== 'undefined') {
        if (!falak3dGroup) {
            falakEnsure3D();
            if (falak3dGroup) falak3dGroup.visible = false;
        }
        if (falak3dGroup) {
        const showZ = falakConsMode === 2;
        FALAK_ZODIAC_SIGNS.forEach(function (key) {
            const patch = falakEnsureZodiacEye(key);
            if (patch.material) patch.material.side = THREE.DoubleSide;
            const sub = falakConsCenter(FALAK_ZODIAC_ID[key]);
            if (!showZ || !sub) { patch.visible = false; return; }
            const at = falakObsPaintPoint(sub.lat, sub.lon);
            const subN = falakSub(sub.ra, Math.min(88, sub.dec + 3));
            const north = subN && falakObsPaintPoint(subN.lat, subN.lon);
            const cover = falakConsCoverDeg(FALAK_ZODIAC_ID[key]);
            patch.visible = !!(at && north && at.alt > -0.2);
            if (!patch.visible) return;
            const im = falakZodiacImg(key);
            const aspect = (im.naturalWidth && im.naturalHeight) ? (im.naturalWidth / im.naturalHeight) : 1;
            falakLayZodiacOnDome(patch, at, north, cover, aspect);
        });
        }
    }
}
function falakObsPaintPoint(lat, lon) {
    if (!observer3DPos || typeof observerSkyPointRaw !== 'function') return null;
    const p = observerSkyPointRaw(observer3DPos, lat, lon);
    if (!p || !isFinite(p.nx)) return null;
    const domeR = (typeof azim3dObsDome !== 'undefined' && azim3dObsDome && azim3dObsDome.userData && azim3dObsDome.userData.R)
        ? azim3dObsDome.userData.R
        : Math.hypot(p.x - observer3DPos.x, p.y, p.z - observer3DPos.z);
    const R = domeR * 0.996;
    return {
        x: observer3DPos.x + p.nx * R,
        y: p.ny * R,
        z: observer3DPos.z + p.nz * R,
        nx: p.nx, ny: p.ny, nz: p.nz,
        alt: p.alt, cx: observer3DPos.x, cz: observer3DPos.z, R: R
    };
}
function falakEnsureZodiacEye(key) {
    if (!falak3dGroup.userData.zodiacEye) falak3dGroup.userData.zodiacEye = {};
    const bag = falak3dGroup.userData.zodiacEye;
    let mesh = bag[key];
    const dome = (typeof azim3dObsDome !== 'undefined' && azim3dObsDome) ? azim3dObsDome : null;
    if (mesh && dome && mesh.parent !== dome) {
        if (mesh.parent) mesh.parent.remove(mesh);
        dome.add(mesh);
    }
    if (mesh) return mesh;
    const im = falakZodiacImg(key);
    const tex = new THREE.Texture(im);
    tex.needsUpdate = true;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    im.addEventListener('load', function () {
        tex.needsUpdate = true;
        if (typeof updateAzim3D === 'function') updateAzim3D();
    });
    const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthTest: false, depthWrite: false,
        side: THREE.BackSide
    });
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 14, 14), mat);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    mesh.visible = false;
    (dome || falak3dGroup).add(mesh);
    bag[key] = mesh;
    return mesh;
}
function falakLayZodiacOnDome(mesh, at, north, coverDeg, aspect) {
    const g = falakLayZodiacOnDome;
    if (!g.x) {
        g.x = new THREE.Vector3();
        g.y = new THREE.Vector3();
        g.z = new THREE.Vector3();
        g.up = new THREE.Vector3();
    }
    g.z.set(at.nx, at.ny, at.nz);
    if (g.z.lengthSq() < 1e-8) return;
    g.z.normalize();
    g.y.set(north.nx - at.nx, north.ny - at.ny, north.nz - at.nz);
    g.y.addScaledVector(g.z, -g.y.dot(g.z));
    if (g.y.lengthSq() < 1e-8) {
        g.up.set(Math.abs(g.z.y) > 0.9 ? 1 : 0, Math.abs(g.z.y) > 0.9 ? 0 : 1, 0);
        g.y.crossVectors(g.up, g.z);
    }
    g.y.normalize();
    g.x.crossVectors(g.y, g.z).normalize();
    const halfH = Math.max(0.05, (coverDeg * Math.PI / 180) * 0.5);
    const halfW = halfH * Math.max(0.35, aspect);
    const dome = (typeof azim3dObsDome !== 'undefined' && azim3dObsDome && mesh.parent === azim3dObsDome) ? azim3dObsDome : null;
    const ox = dome ? 0 : at.cx;
    const oy = 0;
    const oz = dome ? 0 : at.cz;
    const R = at.R;
    const pos = mesh.geometry.attributes.position;
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        const ax = (0.5 - uv.getX(i)) * 2 * halfW;
        const ay = (uv.getY(i) - 0.5) * 2 * halfH;
        const cay = Math.cos(ay), say = Math.sin(ay);
        const cax = Math.cos(ax), sax = Math.sin(ax);
        let dx = g.z.x * cay * cax + g.x.x * cay * sax + g.y.x * say;
        let dy = g.z.y * cay * cax + g.x.y * cay * sax + g.y.y * say;
        let dz = g.z.z * cay * cax + g.x.z * cay * sax + g.y.z * say;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
        pos.setXYZ(i, ox + dx * R, oy + dy * R, oz + dz * R);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.quaternion.identity();
    if (mesh.material && falak3dGroup.userData.horizonClip) {
        mesh.material.clippingPlanes = [falak3dGroup.userData.horizonClip];
    }
}
function falakOrientPainting(mesh, at, north, faceOut) {
    const g = falakOrientPainting;
    if (!g.x) {
        g.x = new THREE.Vector3();
        g.y = new THREE.Vector3();
        g.z = new THREE.Vector3();
        g.up = new THREE.Vector3();
        g.m = new THREE.Matrix4();
    }
    g.z.set(at.nx || 0, at.ny || 1, at.nz || 0);
    if (g.z.lengthSq() < 1e-8) g.z.set(0, 1, 0);
    g.z.normalize();
    if (!faceOut) g.z.negate();
    g.y.set(north.x - at.x, north.y - at.y, north.z - at.z);
    g.y.addScaledVector(g.z, -g.y.dot(g.z));
    if (g.y.lengthSq() < 1e-6) {
        g.up.set(Math.abs(g.z.y) > 0.9 ? 1 : 0, Math.abs(g.z.y) > 0.9 ? 0 : 1, 0);
        g.y.crossVectors(g.up, g.z);
    }
    g.y.normalize();
    g.x.crossVectors(g.y, g.z).normalize();
    g.m.makeBasis(g.x, g.y, g.z);
    mesh.quaternion.setFromRotationMatrix(g.m);
}
function falakPick3D(e) {
    if (!falakOn || !gleason3DMode || !falak3dGroup || !falak3dGroup.visible) return false;
    if (!azim3dCamera || !azim3dRenderer || !falak3dPick.length) return false;
    const rect = azim3dRenderer.domElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const v = falakPick3D._v || (falakPick3D._v = new THREE.Vector3());
    let best = null;
    let bestD = 1e9;
    for (let i = 0; i < falak3dPick.length; i++) {
        const h = falak3dPick[i];
        v.set(h.x, h.y, h.z).project(azim3dCamera);
        if (v.z < -1 || v.z > 1) continue;
        const px = (v.x * 0.5 + 0.5) * rect.width;
        const py = (-v.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(px - mx, py - my);
        if (d <= h.lim && d < bestD) { bestD = d; best = h; }
    }
    if (!best) return false;
    if (best.kind === 'p') falakSelectPlanet(best.id);
    else {
        falakSelectedStar = best.s;
        falak3dLabelKey = '';
        falakRenderSide();
        if (typeof drawAzimuthal === 'function') drawAzimuthal();
        if (typeof updateAzim3D === 'function') updateAzim3D();
    }
    return true;
}

