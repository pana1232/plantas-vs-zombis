"use strict";

/* =========================================================
   1. CONFIGURACIÓN
   ========================================================= */
const CONFIG = {
  // Base de datos en línea (Firebase Realtime Database).
  // Pega aquí la URL de tu base, por ejemplo:
  // "https://mi-proyecto-default-rtdb.firebaseio.com"
  // Si lo dejas vacío, las partidas se guardan solo en este navegador.
  DB_URL: "",

  COLUMNAS: 9,
  FILAS: 5,
  CELDA: 100,
  MARGEN: 40,            // zona protegida (izquierda)
  ENERGIA_INICIAL: 300,
  ENERGIA_ORBE: 25,
  PUNTOS_ENEMIGO: 10,
  PUNTOS_JEFE: 100,
  BONO_OLEADA: 50,
  MAX_RANKING: 20
};

const ANCHO = CONFIG.MARGEN + CONFIG.COLUMNAS * CONFIG.CELDA;
const ALTO = CONFIG.FILAS * CONFIG.CELDA;
const LS_PARTIDAS = "guardianes_partidas";
const LS_NOMBRE = "guardianes_nombre";

/* =========================================================
   2. DATOS DEL JUEGO
   ========================================================= */
const GUARDIANES = {
  lanzasemillas: { emoji: "🌱", nombre: "Lanzasemillas", costo: 50,  vida: 100, tipo: "disparo", cadencia: 1.4, dano: 20,
    descripcion: "Lanzasemillas: dispara pequeñas semillas hacia los enemigos." },
  brasaflor:     { emoji: "🔥", nombre: "Brasaflor",     costo: 100, vida: 100, tipo: "disparo", cadencia: 1.6, dano: 45,
    descripcion: "Brasaflor: lanza proyectiles calientes que causan más daño." },
  vientobrote:   { emoji: "🌀", nombre: "Vientobrote",   costo: 75,  vida: 100, tipo: "viento",  cadencia: 3, dano: 6, empuje: 70, alcance: 320,
    descripcion: "Vientobrote: empuja a los enemigos hacia atrás." },
  rocafuerte:    { emoji: "🪨", nombre: "Rocafuerte",    costo: 125, vida: 900, tipo: "muro",
    descripcion: "Rocafuerte: muy resistente, sirve para bloquear el paso." },
  chispabrote:   { emoji: "⚡", nombre: "Chispabrote",   costo: 150, vida: 100, tipo: "area",    cadencia: 2, dano: 28, radio: 160,
    descripcion: "Chispabrote: ataca a varios enemigos que estén cerca." },
  escarchahoja:  { emoji: "❄️", nombre: "Escarchahoja",  costo: 175, vida: 100, tipo: "hielo",   cadencia: 1.8, dano: 12, duracion: 3,
    descripcion: "Escarchahoja: reduce temporalmente la velocidad de los enemigos." }
};

const ENEMIGOS = {
  corredor:   { emoji: "👾", nombre: "Bicho Corredor",      vida: 60,   vel: 30, dps: 15,  tam: 44 },
  blindado:   { emoji: "🪲", nombre: "Escarabajo Blindado", vida: 260,  vel: 17, dps: 25,  tam: 48, energia: 10 },
  murcielago: { emoji: "🦇", nombre: "Murciélago Oscuro",   vida: 80,   vel: 30, dps: 0,   tam: 42, vuela: true },
  bestia:     { emoji: "🐗", nombre: "Bestia de Carga",     vida: 520,  vel: 22, dps: 60,  tam: 60, energia: 20 },
  devorador:  { emoji: "👹", nombre: "Devorador",           vida: 220,  vel: 24, dps: 170, tam: 52, energia: 15 },
  titan:      { emoji: "🤖", nombre: "Titán Mecánico",      vida: 1000, vel: 14, dps: 90,  tam: 62, energia: 30 },
  jefe:       { emoji: "🤖", nombre: "El Gigante de Acero", vida: 3500, vel: 10, dps: 700, tam: 100, energia: 100 }
};

const NOMBRES_OLEADA = [
  "Enemigos básicos",
  "Enemigos rápidos",
  "Enemigos blindados",
  "Rápidos y blindados",
  "Enemigos especiales",
  "¡Gran cantidad de enemigos!",
  "¡OLEADA FINAL: JEFE!"
];

// Cada plantilla se repite en ciclos de 7 oleadas, cada vez más fuerte
const PLANTILLAS = {
  1: { corredor: 5 },
  2: { corredor: 9 },
  3: { blindado: 4, corredor: 3 },
  4: { corredor: 8, blindado: 5 },
  5: { murcielago: 5, devorador: 3, bestia: 2 },
  6: { corredor: 10, blindado: 6, murcielago: 4, devorador: 3, bestia: 2, titan: 1 },
  7: { jefe: 1, corredor: 6, blindado: 3 }
};

/* =========================================================
   3. ELEMENTOS DEL DOM
   ========================================================= */
const $ = (id) => document.getElementById(id);
const canvas = $("tablero");
const ctx = canvas.getContext("2d");
ctx.textAlign = "center";
ctx.textBaseline = "middle";

/* =========================================================
   4. ESTADO DEL JUEGO
   ========================================================= */
let estado = "inicio";     // inicio | jugando | fin
let pausado = false;
let jugador = "";

let puntos, energia, nivel, derrotados, tiempo;
let guardianes, enemigos, proyectiles, efectos, orbes;
let cola, temporizadorSpawn, descanso, temporizadorOrbe;
let seleccion = null;
let celdaHover = null;
let ultimo = 0;

function reiniciarPartida() {
  puntos = 0;
  energia = CONFIG.ENERGIA_INICIAL;
  nivel = 0;
  derrotados = 0;
  tiempo = 0;
  guardianes = [];
  enemigos = [];
  proyectiles = [];
  efectos = [];
  orbes = [];
  cola = [];
  temporizadorSpawn = 0;
  descanso = 8;
  temporizadorOrbe = 3;
  seleccion = null;
  setPausa(false);
  actualizarAyuda();
}
reiniciarPartida();

/* =========================================================
   5. UTILIDADES
   ========================================================= */
const filaY = (fila) => fila * CONFIG.CELDA + CONFIG.CELDA / 2;
const colX = (col) => CONFIG.MARGEN + col * CONFIG.CELDA + CONFIG.CELDA / 2;
const guardianEn = (fila, col) => guardianes.find((g) => g.fila === fila && g.col === col);

function mezclar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function anunciar(texto) {
  const el = $("anuncio");
  el.textContent = texto;
  el.classList.remove("mostrar");
  void el.offsetWidth;
  el.classList.add("mostrar");
}

function textoFlotante(x, y, texto, color = "#fff") {
  efectos.push({ tipo: "texto", x, y, texto, color, t: 0, dur: 1 });
}

function efectoEmoji(emojiTxt, x, y, tam, dur, crece = true, dx = 0) {
  efectos.push({ tipo: "emoji", emoji: emojiTxt, x, y, tam, dur, crece, dx, t: 0 });
}

/* =========================================================
   6. SONIDO
   ========================================================= */
let audioCtx = null;
let sonidoActivo = true;

function tono(freq, dur = 0.08, tipo = "square", vol = 0.04, desliza = 0) {
  if (!sonidoActivo || !audioCtx) return;
  const ahora = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, ahora);
  if (desliza) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + desliza), ahora + dur);
  g.gain.setValueAtTime(vol, ahora);
  g.gain.exponentialRampToValueAtTime(0.0001, ahora + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(ahora + dur);
}

const SONIDO = {
  disparo:  () => tono(520, 0.07, "square", 0.03, -200),
  fuego:    () => tono(220, 0.12, "sawtooth", 0.04, -100),
  hielo:    () => tono(880, 0.1, "sine", 0.04, -300),
  viento:   () => tono(180, 0.2, "triangle", 0.05, 120),
  rayo:     () => tono(700, 0.15, "sawtooth", 0.04, -500),
  derrota:  () => tono(300, 0.12, "square", 0.04, -200),
  colocar:  () => tono(400, 0.1, "triangle", 0.05, 200),
  energia:  () => tono(900, 0.08, "sine", 0.04, 300),
  jefe:     () => tono(90, 0.5, "sawtooth", 0.07, -30),
  gameover: () => { tono(330, 0.25, "square", 0.06, -150); setTimeout(() => tono(220, 0.4, "square", 0.06, -120), 250); }
};

/* =========================================================
   7. BASE DE DATOS (Firebase Realtime Database o local)
   ========================================================= */
const BD = {
  url() { return CONFIG.DB_URL.replace(/\/+$/, "") + "/partidas.json"; },

  leerLocal() {
    try { return JSON.parse(localStorage.getItem(LS_PARTIDAS)) || []; }
    catch (e) { return []; }
  },

  async guardar(partida) {
    if (!CONFIG.DB_URL) {
      const lista = this.leerLocal();
      lista.push(partida);
      localStorage.setItem(LS_PARTIDAS, JSON.stringify(lista));
      return;
    }
    const r = await fetch(this.url(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partida)
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
  },

  async listar() {
    if (!CONFIG.DB_URL) return this.leerLocal();
    const r = await fetch(this.url());
    if (!r.ok) throw new Error("HTTP " + r.status);
    const datos = await r.json();
    return datos ? Object.values(datos) : [];
  },

  async borrar() {
    if (!CONFIG.DB_URL) { localStorage.removeItem(LS_PARTIDAS); return; }
    const r = await fetch(this.url(), { method: "DELETE" });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }
};

/* =========================================================
   8. PREMIOS
   ========================================================= */
function calcularPremio(p) {
  if (p <= 100) return { corto: "Chocolate", mensaje: "🎁 Ganaste el premio menor: un chocolate" };
  if (p < 200)  return { corto: "Sin premio", mensaje: "❌ No obtuviste premio, intenta conseguir más puntos" };
  if (p < 400)  return { corto: "Palta", mensaje: "🎁 Ganaste el premio intermedio: una palta" };
  return { corto: "Gomitas preparadas", mensaje: "🏆 Ganaste el premio mayor: unas gomitas preparadas" };
}

/* =========================================================
   9. TABLA DE JUGADORES
   ========================================================= */
async function cargarRanking() {
  const estadoEl = $("estadoBD");
  const cuerpo = $("tablaCuerpo");
  estadoEl.textContent = CONFIG.DB_URL
    ? "Cargando partidas…"
    : "⚠️ Modo local: configura DB_URL en script.js para ver las partidas desde otros dispositivos.";

  try {
    const lista = (await BD.listar())
      .map((p) => ({
        nombre: String(p.nombre || "?").slice(0, 15),
        puntos: Number(p.puntos) || 0,
        nivel: Number(p.nivel) || 1,
        premio: String(p.premio || "-"),
        fecha: p.fecha || ""
      }))
      .sort((a, b) => b.puntos - a.puntos || String(a.fecha).localeCompare(String(b.fecha)))
      .slice(0, CONFIG.MAX_RANKING);

    cuerpo.innerHTML = "";
    if (!lista.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "Aún no hay partidas registradas.";
      tr.appendChild(td);
      cuerpo.appendChild(tr);
    }

    lista.forEach((p, i) => {
      const tr = document.createElement("tr");
      const fecha = p.fecha ? new Date(p.fecha).toLocaleString("es") : "-";
      [i + 1, p.nombre, p.puntos, p.nivel, p.premio, fecha].forEach((valor) => {
        const td = document.createElement("td");
        td.textContent = valor;          // textContent evita inyección de HTML
        tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    });

    if (CONFIG.DB_URL) estadoEl.textContent = "🌐 Conectado a la base de datos en línea";
  } catch (err) {
    estadoEl.textContent = "⚠️ No se pudo conectar con la base de datos.";
  }
}

/* =========================================================
   10. SELECTOR DE GUARDIANES
   ========================================================= */
function crearSelector() {
  const cont = $("selector");
  Object.entries(GUARDIANES).forEach(([clave, g]) => {
    const b = document.createElement("button");
    b.className = "guardian-btn";
    b.dataset.clave = clave;
    b.title = g.descripcion;
    b.innerHTML =
      `<span class="g-emoji">${g.emoji}</span>` +
      `<span class="g-nombre">${g.nombre}</span>` +
      `<span class="g-costo">⚡ ${g.costo}</span>`;
    b.addEventListener("click", () => seleccionar(clave));
    cont.appendChild(b);
  });
}

function seleccionar(clave) {
  seleccion = seleccion === clave ? null : clave;
  actualizarAyuda();
}

function actualizarAyuda() {
  $("ayudaGuardian").textContent = seleccion
    ? GUARDIANES[seleccion].descripcion
    : "Elige un guardián y toca una casilla del jardín. Toca las ⚡ para juntar energía.";
}

/* =========================================================
   11. OLEADAS
   ========================================================= */
function construirOleada(n) {
  const k = ((n - 1) % 7) + 1;
  const ciclo = Math.floor((n - 1) / 7);
  const base = PLANTILLAS[k];
  const factor = 1 + 0.3 * ciclo;
  const lista = [];

  for (const [tipo, cantidad] of Object.entries(base)) {
    if (tipo === "jefe") continue;
    const c = Math.round(cantidad * factor);
    for (let i = 0; i < c; i++) lista.push(tipo);
  }
  mezclar(lista);
  if (base.jefe) lista.splice(Math.floor(lista.length / 3), 0, "jefe");
  return lista;
}

function iniciarOleada() {
  nivel++;
  cola = construirOleada(nivel);
  temporizadorSpawn = 2;
  const k = ((nivel - 1) % 7) + 1;
  anunciar(`🌊 Oleada ${nivel}: ${NOMBRES_OLEADA[k - 1]}`);
  if (k === 7) SONIDO.jefe();
}

function gestionarOleadas(dt) {
  if (descanso > 0) {
    descanso -= dt;
    if (descanso <= 0) iniciarOleada();
    return;
  }

  if (cola.length) {
    temporizadorSpawn -= dt;
    if (temporizadorSpawn <= 0) {
      const tipo = cola.shift();
      crearEnemigo(tipo, Math.floor(Math.random() * CONFIG.FILAS), ANCHO + 30);
      const intervalo = Math.max(0.7, 2.8 - 0.12 * nivel);
      temporizadorSpawn = intervalo * (0.7 + Math.random() * 0.6);
    }
  } else if (enemigos.every((e) => e.muerto)) {
    energia += CONFIG.BONO_OLEADA;
    descanso = 6;
    anunciar(`✅ Oleada ${nivel} superada  +${CONFIG.BONO_OLEADA}⚡`);
  }
}

/* =========================================================
   12. ENEMIGOS
   ========================================================= */
function crearEnemigo(tipo, fila, x) {
  const d = ENEMIGOS[tipo];
  const n = Math.max(1, nivel);
  const ciclo = Math.floor((n - 1) / 7);
  let vida = d.vida * (1 + 0.12 * (n - 1));
  if (tipo === "jefe") vida *= 1 + 0.6 * ciclo;
  const velMult = Math.min(1.8, 1 + 0.04 * (n - 1));

  const e = {
    tipo, d, fila, x,
    y: filaY(fila),
    vida, vidaMax: vida,
    vel: d.vel * velMult * (tipo === "jefe" ? 1 : 0.92 + Math.random() * 0.16),
    flash: 0, lentoHasta: 0, cargaHasta: 0,
    tAbil: 0, tCarga: 0, muerto: false
  };
  enemigos.push(e);
  return e;
}

function herir(e, dano) {
  if (e.muerto) return;
  e.vida -= dano;
  e.flash = 0.12;
  if (e.vida <= 0) matar(e);
}

function matar(e) {
  if (e.muerto) return;
  e.muerto = true;
  derrotados++;
  puntos += CONFIG.PUNTOS_ENEMIGO;
  textoFlotante(e.x, e.y - 20, "+" + CONFIG.PUNTOS_ENEMIGO, "#fff59d");

  if (e.tipo === "jefe") {
    puntos += CONFIG.PUNTOS_JEFE;
    textoFlotante(e.x, e.y - 55, "+" + CONFIG.PUNTOS_JEFE + " JEFE", "#ffd54f");
    anunciar("🏆 ¡Derrotaste al Gigante de Acero!");
    SONIDO.jefe();
  }
  if (e.d.energia) {
    energia += e.d.energia;
    textoFlotante(e.x + 25, e.y, "+" + e.d.energia + "⚡", "#ffe082");
  }
  efectoEmoji("💥", e.x, e.y, e.d.tam, 0.4);
  SONIDO.derrota();
}

function actualizarEnemigos(dt) {
  for (const e of enemigos) {
    if (e.muerto) continue;
    if (e.flash > 0) e.flash -= dt;

    // Habilidades del jefe
    if (e.tipo === "jefe") {
      e.tAbil += dt;
      e.tCarga += dt;
      if (e.tAbil >= 9) {
        e.tAbil = 0;
        for (const df of [-1, 1]) {
          const f = Math.min(CONFIG.FILAS - 1, Math.max(0, e.fila + df));
          crearEnemigo("corredor", f, Math.min(ANCHO + 30, e.x + 40));
        }
        textoFlotante(e.x, e.y - 70, "¡REFUERZOS!", "#ff8a80");
      }
      if (e.tCarga >= 14) {
        e.tCarga = 0;
        e.cargaHasta = tiempo + 2;
        textoFlotante(e.x, e.y - 70, "¡CARGA!", "#ff5252");
        SONIDO.jefe();
      }
    }

    let mult = 1;
    if (e.lentoHasta > tiempo) mult *= 0.5;
    if (e.cargaHasta > tiempo) mult *= 3;

    // ¿Hay un guardián bloqueando el paso? (los murciélagos vuelan por encima)
    let bloqueador = null;
    if (!e.d.vuela) {
      for (const g of guardianes) {
        if (g.fila !== e.fila || g.x >= e.x) continue;
        if (e.x - e.d.tam / 2 <= g.x + 34 && (!bloqueador || g.x > bloqueador.x)) bloqueador = g;
      }
    }

    if (bloqueador) {
      bloqueador.vida -= e.d.dps * dt;
      if (bloqueador.vida <= 0) destruirGuardian(bloqueador);
    } else {
      e.x -= e.vel * mult * dt;
    }

    // ¿Llegó a la zona protegida?
    if (e.x - e.d.tam / 2 <= CONFIG.MARGEN) {
      terminarJuego();
      return;
    }
  }
}

/* =========================================================
   13. GUARDIANES Y PROYECTILES
   ========================================================= */
function destruirGuardian(g) {
  guardianes = guardianes.filter((x) => x !== g);
  efectoEmoji("💨", g.x, g.y, 60, 0.5);
}

function hayEnemigoAdelante(g, alcance) {
  return enemigos.some((e) =>
    !e.muerto && e.fila === g.fila && e.x > g.x && e.x < ANCHO - 5 && e.x - g.x <= alcance);
}

function actualizarGuardianes(dt) {
  for (const g of guardianes) {
    const d = GUARDIANES[g.tipo];
    if (d.tipo === "muro") continue;
    g.t -= dt;
    if (g.t > 0) continue;

    if (d.tipo === "disparo" || d.tipo === "hielo") {
      if (hayEnemigoAdelante(g, 99999)) {
        const clase = g.tipo === "brasaflor" ? "fuego" : d.tipo === "hielo" ? "hielo" : "semilla";
        proyectiles.push({ x: g.x + 25, y: g.y, fila: g.fila, vel: 420, dano: d.dano, clase });
        g.t = d.cadencia;
        if (clase === "fuego") SONIDO.fuego(); else if (clase === "hielo") SONIDO.hielo(); else SONIDO.disparo();
      }
    } else if (d.tipo === "viento") {
      if (hayEnemigoAdelante(g, d.alcance)) {
        for (const e of enemigos) {
          if (e.muerto || e.fila !== g.fila || e.x <= g.x || e.x - g.x > d.alcance || e.x >= ANCHO) continue;
          let empuje = d.empuje;
          if (e.tipo === "jefe") empuje *= 0.15;
          else if (e.tipo === "bestia" || e.tipo === "titan") empuje *= 0.5;
          e.x = Math.min(ANCHO + 30, e.x + empuje);
          herir(e, d.dano);
        }
        efectoEmoji("🌀", g.x + 40, g.y, 50, 0.6, false, 420);
        g.t = d.cadencia;
        SONIDO.viento();
      }
    } else if (d.tipo === "area") {
      const objetivos = enemigos.filter((e) =>
        !e.muerto && Math.abs(e.fila - g.fila) <= 1 && e.x > g.x - 30 &&
        Math.abs(e.x - g.x) <= d.radio && e.x < ANCHO);
      if (objetivos.length) {
        efectos.push({ tipo: "rayo", x: g.x, y: g.y, objetivos: objetivos.map((e) => ({ x: e.x, y: e.y })), t: 0, dur: 0.25 });
        objetivos.forEach((e) => herir(e, d.dano));
        g.t = d.cadencia;
        SONIDO.rayo();
      }
    }
  }
}

function actualizarProyectiles(dt) {
  proyectiles = proyectiles.filter((p) => {
    p.x += p.vel * dt;
    if (p.x > ANCHO + 20) return false;

    let objetivo = null;
    for (const e of enemigos) {
      if (e.muerto || e.fila !== p.fila) continue;
      if (Math.abs(e.x - p.x) < e.d.tam / 2 + 6 && (!objetivo || e.x < objetivo.x)) objetivo = e;
    }
    if (!objetivo) return true;

    herir(objetivo, p.dano);
    if (p.clase === "hielo") {
      objetivo.lentoHasta = tiempo + GUARDIANES.escarchahoja.duracion;
      efectoEmoji("❄️", objetivo.x, objetivo.y, 34, 0.35);
    } else if (p.clase === "fuego") {
      efectoEmoji("🔥", objetivo.x, objetivo.y, 36, 0.3);
    }
    return false;
  });
}

/* =========================================================
   14. ENERGÍA (orbes)
   ========================================================= */
function crearOrbe() {
  const col = Math.floor(Math.random() * CONFIG.COLUMNAS);
  const fila = Math.floor(Math.random() * CONFIG.FILAS);
  orbes.push({
    x: colX(col) + (Math.random() * 40 - 20),
    y: filaY(fila) + (Math.random() * 40 - 20),
    vida: 12
  });
}

/* =========================================================
   15. ACTUALIZACIÓN PRINCIPAL
   ========================================================= */
function actualizar(dt) {
  tiempo += dt;

  temporizadorOrbe -= dt;
  if (temporizadorOrbe <= 0) { crearOrbe(); temporizadorOrbe = 4 + Math.random() * 2.5; }
  orbes.forEach((o) => (o.vida -= dt));
  orbes = orbes.filter((o) => o.vida > 0);

  gestionarOleadas(dt);
  actualizarGuardianes(dt);
  actualizarProyectiles(dt);
  actualizarEnemigos(dt);

  efectos.forEach((f) => {
    f.t += dt;
    if (f.tipo === "texto") f.y -= 30 * dt;
    if (f.tipo === "emoji") f.x += f.dx * dt;
  });
  efectos = efectos.filter((f) => f.t < f.dur);
  enemigos = enemigos.filter((e) => !e.muerto);
}

/* =========================================================
   16. DIBUJO
   ========================================================= */
const FUENTE = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function emoji(txt, x, y, tam, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `${tam}px ${FUENTE}`;
  ctx.fillText(txt, x, y);
  ctx.globalAlpha = 1;
}

function barraVida(x, y, ancho, alto, pct, color) {
  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.fillRect(x - ancho / 2, y, ancho, alto);
  ctx.fillStyle = color;
  ctx.fillRect(x - ancho / 2, y, ancho * Math.max(0, pct), alto);
}

function dibujar() {
  ctx.clearRect(0, 0, ANCHO, ALTO);

  // Césped en carriles
  for (let f = 0; f < CONFIG.FILAS; f++) {
    for (let c = 0; c < CONFIG.COLUMNAS; c++) {
      ctx.fillStyle = (f + c) % 2 === 0 ? "#5da844" : "#4f9a3a";
      ctx.fillRect(CONFIG.MARGEN + c * CONFIG.CELDA, f * CONFIG.CELDA, CONFIG.CELDA, CONFIG.CELDA);
    }
  }

  // Zona protegida
  ctx.fillStyle = "#8d5a2b";
  ctx.fillRect(0, 0, CONFIG.MARGEN, ALTO);
  for (let f = 0; f < CONFIG.FILAS; f++) emoji("🏡", CONFIG.MARGEN / 2, filaY(f), 26);

  // Casilla bajo el cursor
  if (celdaHover && seleccion && estado === "jugando" && !guardianEn(celdaHover.fila, celdaHover.col)) {
    ctx.fillStyle = "rgba(255,255,255,.25)";
    ctx.fillRect(CONFIG.MARGEN + celdaHover.col * CONFIG.CELDA, celdaHover.fila * CONFIG.CELDA, CONFIG.CELDA, CONFIG.CELDA);
    emoji(GUARDIANES[seleccion].emoji, colX(celdaHover.col), filaY(celdaHover.fila), 56, 0.5);
  }

  // Guardianes
  for (const g of guardianes) {
    const d = GUARDIANES[g.tipo];
    const bob = Math.sin(tiempo * 3 + g.col) * 2;
    emoji(d.emoji, g.x, g.y + bob, g.tipo === "rocafuerte" ? 64 : 56);
    if (g.vida < g.vidaMax) barraVida(g.x, g.y - 44, 52, 6, g.vida / g.vidaMax, "#76ff03");
  }

  // Enemigos
  for (const e of enemigos) {
    const d = e.d;
    const y = e.y + (d.vuela ? Math.sin(tiempo * 8 + e.x) * 6 : 0);

    if (e.cargaHasta > tiempo) {
      ctx.fillStyle = "rgba(255,40,40,.35)";
      ctx.beginPath(); ctx.arc(e.x, y, d.tam * 0.7, 0, Math.PI * 2); ctx.fill();
    } else if (e.tipo === "jefe") {
      ctx.fillStyle = "rgba(255,0,0,.18)";
      ctx.beginPath(); ctx.arc(e.x, y, d.tam * 0.65, 0, Math.PI * 2); ctx.fill();
    }
    if (e.lentoHasta > tiempo) {
      ctx.fillStyle = "rgba(120,200,255,.4)";
      ctx.beginPath(); ctx.arc(e.x, y, d.tam * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    emoji(d.emoji, e.x, y, d.tam, e.flash > 0 ? 0.55 : 1);
    if (e.lentoHasta > tiempo) emoji("❄️", e.x + d.tam * 0.4, y - d.tam * 0.4, 18);

    if (e.vida < e.vidaMax || e.tipo === "jefe") {
      const color = e.tipo === "jefe" ? "#ff5252" : "#ef5350";
      barraVida(e.x, y - d.tam / 2 - 10, d.tam, e.tipo === "jefe" ? 8 : 5, e.vida / e.vidaMax, color);
    }
  }

  // Proyectiles
  for (const p of proyectiles) {
    ctx.beginPath();
    if (p.clase === "fuego") { ctx.fillStyle = "#ff7a2f"; ctx.shadowColor = "#ff3d00"; ctx.shadowBlur = 12; ctx.arc(p.x, p.y, 9, 0, 7); }
    else if (p.clase === "hielo") { ctx.fillStyle = "#b3e5fc"; ctx.shadowColor = "#4fc3f7"; ctx.shadowBlur = 10; ctx.arc(p.x, p.y, 7, 0, 7); }
    else { ctx.fillStyle = "#c6ff00"; ctx.shadowBlur = 0; ctx.arc(p.x, p.y, 6, 0, 7); }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Orbes de energía
  for (const o of orbes) {
    if (o.vida < 3 && Math.floor(tiempo * 8) % 2 === 0) continue;
    const r = 24 + Math.sin(tiempo * 5) * 3;
    const gr = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, r);
    gr.addColorStop(0, "#fffde7");
    gr.addColorStop(1, "rgba(255,213,79,.25)");
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
    emoji("⚡", o.x, o.y, 22);
  }

  // Efectos
  for (const f of efectos) {
    const p = f.t / f.dur;
    if (f.tipo === "emoji") {
      const tam = f.crece ? f.tam * (0.6 + p * 0.8) : f.tam;
      emoji(f.emoji, f.x, f.y, tam, 1 - p);
    } else if (f.tipo === "texto") {
      ctx.globalAlpha = 1 - p;
      ctx.font = `bold 22px ${FUENTE}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,.7)";
      ctx.strokeText(f.texto, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.texto, f.x, f.y);
      ctx.globalAlpha = 1;
    } else if (f.tipo === "rayo") {
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = "#ffee58";
      ctx.lineWidth = 3;
      for (const o of f.objetivos) {
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo((f.x + o.x) / 2 + (Math.random() * 20 - 10), (f.y + o.y) / 2 + (Math.random() * 20 - 10));
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Cuenta regresiva entre oleadas
  if (estado === "jugando" && descanso > 0) {
    ctx.font = `bold 26px ${FUENTE}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,.7)";
    const t = `Siguiente oleada en ${Math.ceil(descanso)}…`;
    ctx.strokeText(t, ANCHO / 2, 30);
    ctx.fillStyle = "#fff";
    ctx.fillText(t, ANCHO / 2, 30);
  }

  // Pausa
  if (pausado && estado === "jugando") {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0, 0, ANCHO, ALTO);
    emoji("⏸️ PAUSA", ANCHO / 2, ALTO / 2, 56);
  }
}

/* =========================================================
   17. PANEL (HUD)
   ========================================================= */
function actualizarHUD() {
  $("hudNombre").textContent = jugador || "-";
  $("hudPuntos").textContent = puntos;
  $("hudNivel").textContent = Math.max(1, nivel);
  $("hudEnergia").textContent = Math.floor(energia);
  $("hudDerrotados").textContent = derrotados;

  document.querySelectorAll(".guardian-btn").forEach((b) => {
    const clave = b.dataset.clave;
    b.classList.toggle("sin-energia", energia < GUARDIANES[clave].costo);
    b.classList.toggle("activo", seleccion === clave);
  });

  const jefe = enemigos.find((e) => e.tipo === "jefe" && !e.muerto);
  $("jefeBarra").classList.toggle("oculto", !jefe);
  if (jefe) $("jefeVida").style.width = Math.max(0, (jefe.vida / jefe.vidaMax) * 100) + "%";
}

/* =========================================================
   18. FLUJO DEL JUEGO
   ========================================================= */
function setPausa(valor) {
  pausado = valor;
  $("btnPausa").textContent = pausado ? "▶️ Continuar" : "⏸️ Pausa";
}

function comenzar() {
  const nombre = $("inputNombre").value.trim();
  if (!nombre) {
    $("errorNombre").textContent = "Escribe tu nombre para jugar";
    $("inputNombre").focus();
    return;
  }
  $("errorNombre").textContent = "";
  jugador = nombre.slice(0, 15);
  localStorage.setItem(LS_NOMBRE, jugador);

  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sin audio */ }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();

  reiniciarPartida();
  estado = "jugando";
  $("pantallaInicio").classList.add("oculto");
  $("pantallaFin").classList.add("oculto");
  anunciar("🌿 ¡Prepárate, " + jugador + "!");
}

async function terminarJuego() {
  if (estado !== "jugando") return;
  estado = "fin";
  SONIDO.gameover();

  const premio = calcularPremio(puntos);
  const partida = {
    nombre: jugador,
    puntos,
    nivel: Math.max(1, nivel),
    derrotados,
    premio: premio.corto,
    fecha: new Date().toISOString()
  };

  $("finJugador").textContent = partida.nombre;
  $("finPuntos").textContent = partida.puntos;
  $("finDerrotados").textContent = partida.derrotados;
  $("finNivel").textContent = partida.nivel;
  $("finPremio").textContent = premio.mensaje;
  $("finEstado").textContent = "Guardando partida…";
  $("pantallaFin").classList.remove("oculto");

  try {
    await BD.guardar(partida);
    $("finEstado").textContent = "✅ Partida guardada en la tabla de jugadores";
  } catch (err) {
    $("finEstado").textContent = "⚠️ No se pudo guardar la partida en la base de datos";
  }
  cargarRanking();
}

/* =========================================================
   19. EVENTOS
   ========================================================= */
function posicionEvento(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) * canvas.width) / r.width,
    y: ((ev.clientY - r.top) * canvas.height) / r.height
  };
}

canvas.addEventListener("pointerdown", (ev) => {
  if (estado !== "jugando" || pausado) return;
  const p = posicionEvento(ev);

  // 1) ¿Tocó un orbe de energía?
  for (let i = orbes.length - 1; i >= 0; i--) {
    const o = orbes[i];
    if (Math.hypot(o.x - p.x, o.y - p.y) <= 40) {
      energia += CONFIG.ENERGIA_ORBE;
      textoFlotante(o.x, o.y - 10, "+" + CONFIG.ENERGIA_ORBE + "⚡", "#ffe082");
      orbes.splice(i, 1);
      SONIDO.energia();
      return;
    }
  }

  // 2) Colocar guardián
  if (!seleccion) return;
  const col = Math.floor((p.x - CONFIG.MARGEN) / CONFIG.CELDA);
  const fila = Math.floor(p.y / CONFIG.CELDA);
  if (col < 0 || col >= CONFIG.COLUMNAS || fila < 0 || fila >= CONFIG.FILAS) return;

  const d = GUARDIANES[seleccion];
  if (guardianEn(fila, col)) { textoFlotante(colX(col), filaY(fila), "Ocupado", "#ff8a80"); return; }
  if (energia < d.costo)     { textoFlotante(colX(col), filaY(fila), "Sin energía", "#ff8a80"); return; }

  energia -= d.costo;
  guardianes.push({ tipo: seleccion, fila, col, x: colX(col), y: filaY(fila), vida: d.vida, vidaMax: d.vida, t: 0.6 });
  efectoEmoji("✨", colX(col), filaY(fila), 60, 0.4);
  SONIDO.colocar();
});

canvas.addEventListener("pointermove", (ev) => {
  if (ev.pointerType !== "mouse") return;
  const p = posicionEvento(ev);
  const col = Math.floor((p.x - CONFIG.MARGEN) / CONFIG.CELDA);
  const fila = Math.floor(p.y / CONFIG.CELDA);
  celdaHover = (col >= 0 && col < CONFIG.COLUMNAS && fila >= 0 && fila < CONFIG.FILAS) ? { fila, col } : null;
});
canvas.addEventListener("pointerleave", () => (celdaHover = null));

document.addEventListener("keydown", (ev) => {
  if (estado !== "jugando") return;
  if (ev.target.tagName === "INPUT") return;
  const claves = Object.keys(GUARDIANES);
  if (ev.key >= "1" && ev.key <= String(claves.length)) seleccionar(claves[Number(ev.key) - 1]);
  else if (ev.key === "Escape") { seleccion = null; actualizarAyuda(); }
  else if (ev.key.toLowerCase() === "p") setPausa(!pausado);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && estado === "jugando") setPausa(true);
});

$("btnComenzar").addEventListener("click", comenzar);
$("inputNombre").addEventListener("keydown", (ev) => { if (ev.key === "Enter") comenzar(); });
$("btnJugarOtra").addEventListener("click", comenzar);
$("btnCambiarNombre").addEventListener("click", () => {
  $("pantallaFin").classList.add("oculto");
  $("pantallaInicio").classList.remove("oculto");
  $("inputNombre").focus();
});

$("btnPausa").addEventListener("click", () => { if (estado === "jugando") setPausa(!pausado); });
$("btnSonido").addEventListener("click", () => {
  sonidoActivo = !sonidoActivo;
  $("btnSonido").textContent = sonidoActivo ? "🔊 Sonido" : "🔇 Sonido";
});

// Tabla y borrado de historial
$("btnActualizar").addEventListener("click", cargarRanking);
$("btnBorrar").addEventListener("click", () => {
  if (estado === "jugando") setPausa(true);
  $("modalBorrar").classList.remove("oculto");
});
$("btnCancelarBorrar").addEventListener("click", () => $("modalBorrar").classList.add("oculto"));
$("btnConfirmarBorrar").addEventListener("click", async () => {
  try {
    await BD.borrar();
  } catch (err) {
    $("estadoBD").textContent = "⚠️ No se pudo borrar el historial.";
  }
  $("modalBorrar").classList.add("oculto");
  cargarRanking();
});

/* =========================================================
   20. BUCLE PRINCIPAL E INICIO
   ========================================================= */
function bucle(ts) {
  const dt = Math.min(0.05, (ts - ultimo) / 1000 || 0);
  ultimo = ts;
  if (estado === "jugando" && !pausado) actualizar(dt);
  dibujar();
  actualizarHUD();
  requestAnimationFrame(bucle);
}

crearSelector();
$("inputNombre").value = localStorage.getItem(LS_NOMBRE) || "";
cargarRanking();
requestAnimationFrame(bucle);