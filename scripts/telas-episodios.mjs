// Robô do Telas: busca episódios no TVmaze pelas séries da lista e das acompanhadas,
// gera telas/episodios.json e telas/lancamentos.ics, e manda e-mail via Resend
// quando RESEND_API_KEY e ALERT_EMAIL existem (segredos do repositório — nunca no código).
// Node 20+, sem dependências.

import { readFile, writeFile } from 'node:fs/promises';

const TZ = 'America/Sao_Paulo';
const DIAS_ATRAS = 7;
const DIAS_FRENTE = 365;
const PAUSA_MS = 700; // TVmaze: 20 chamadas a cada 10 s por IP

const lerJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};
const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---------- QUAIS SÉRIES ----------
const dados = await lerJson('telas/dados.json', { series: [], seguidas: [] });
const acompanhando = await lerJson('telas/acompanhando.json', { series: [] });

const alvo = new Map(); // imdb_id -> { titulo, alerta }
for (const s of dados.series || []) {
  if (s.imdb_id && /exib|renov/i.test(s.status || '')) alvo.set(s.imdb_id, { titulo: s.titulo, alerta: false });
}
for (const s of dados.seguidas || []) {
  if (s.imdb_id) alvo.set(s.imdb_id, { titulo: s.titulo || s.titulo_original || '', alerta: true });
}
for (const s of acompanhando.series || []) {
  if (!s.imdb_id) continue;
  const a = alvo.get(s.imdb_id) || { titulo: s.titulo || '' };
  alvo.set(s.imdb_id, { ...a, alerta: true });
}
console.log(`séries a consultar: ${alvo.size} (${[...alvo.values()].filter(a => a.alerta).length} com alerta)`);

// ---------- TVMAZE ----------
async function get(url) {
  for (let t = 0; t < 3; t++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'telas-mochilao/1.0' } });
    if (r.status === 429) { await dormir(3000 * (t + 1)); continue; }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${r.status} em ${url}`);
    return r.json();
  }
  throw new Error(`limite de requisições em ${url}`);
}

const hoje = new Date();
const ini = new Date(hoje.getTime() - DIAS_ATRAS * 864e5);
const fim = new Date(hoje.getTime() + DIAS_FRENTE * 864e5);
const series = [];
const episodios = [];

for (const [imdb, info] of alvo) {
  try {
    const show = await get(`https://api.tvmaze.com/lookup/shows?imdb=${imdb}`);
    await dormir(PAUSA_MS);
    if (!show) { console.log(`sem TVmaze: ${imdb} ${info.titulo}`); continue; }
    const plataforma = show.webChannel?.name || show.network?.name || '';
    series.push({ imdb_id: imdb, tvmaze_id: show.id, nome: show.name, status: show.status, plataforma, alerta: !!info.alerta });
    const eps = await get(`https://api.tvmaze.com/shows/${show.id}/episodes`);
    await dormir(PAUSA_MS);
    for (const e of eps || []) {
      const quando = e.airstamp ? new Date(e.airstamp) : (e.airdate ? new Date(e.airdate + 'T12:00:00Z') : null);
      if (!quando || quando < ini || quando > fim) continue;
      episodios.push({
        imdb_id: imdb, tvmaze_id: e.id, serie: show.name, temporada: e.season, episodio: e.number,
        titulo: e.name || '', data: e.airdate || '', airstamp: e.airstamp || '', plataforma, alerta: !!info.alerta,
      });
    }
  } catch (err) {
    console.log(`erro em ${imdb}: ${err.message}`);
  }
}
episodios.sort((a, b) => (a.airstamp || a.data).localeCompare(b.airstamp || b.data));

// ---------- ARQUIVOS ----------
const geradoEm = hoje.toISOString();
const antigo = await lerJson('telas/episodios.json', null);
const mudou = !antigo || JSON.stringify(antigo.episodios) !== JSON.stringify(episodios) || JSON.stringify(antigo.series) !== JSON.stringify(series);
if (mudou) {
  await writeFile('telas/episodios.json', JSON.stringify({ gerado_em: geradoEm, fonte: 'TVmaze (tvmaze.com)', series, episodios }, null, 1) + '\n');
}

const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsData = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// dobra em 75 octetos (RFC 5545), sem partir caractere acentuado no meio
const dobra = linha => {
  const out = []; let atual = '', bytes = 0;
  for (const ch of linha) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > 75) { out.push(atual); atual = ' '; bytes = 1; }
    atual += ch; bytes += b;
  }
  out.push(atual);
  return out.join('\r\n');
};
const linhas = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//mochilao.madeinbr.app//telas//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  'X-WR-CALNAME:Telas · episódios', `X-WR-TIMEZONE:${TZ}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
];
for (const e of episodios) {
  if (!e.alerta) continue; // o calendário assinável só leva o que ele acompanha
  const nome = `${e.serie} T${e.temporada}E${e.episodio}${e.titulo ? ' · ' + e.titulo : ''}`;
  // DTSTAMP estável: senão o arquivo muda todo dia e gera um deploy à toa
  const carimbo = e.airstamp ? new Date(e.airstamp) : new Date((e.data || '2026-01-01') + 'T00:00:00Z');
  linhas.push('BEGIN:VEVENT', `UID:tvmaze-ep-${e.tvmaze_id}@mochilao.madeinbr.app`, `DTSTAMP:${icsData(carimbo)}`);
  if (e.airstamp) {
    const a = new Date(e.airstamp);
    linhas.push(`DTSTART:${icsData(a)}`, `DTEND:${icsData(new Date(a.getTime() + 3600e3))}`);
  } else {
    const d = e.data.replace(/-/g, '');
    linhas.push(`DTSTART;VALUE=DATE:${d}`);
  }
  linhas.push(`SUMMARY:${icsEsc(nome)}`, `DESCRIPTION:${icsEsc((e.plataforma ? e.plataforma + ' · ' : '') + 'via TVmaze')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(nome)}`, 'TRIGGER:-PT12H', 'END:VALARM', 'END:VEVENT');
}
linhas.push('END:VCALENDAR');
await writeFile('telas/lancamentos.ics', linhas.map(dobra).join('\r\n') + '\r\n');
console.log(`episódios na janela: ${episodios.length}; no calendário assinável: ${episodios.filter(e => e.alerta).length}`);

// ---------- E-MAIL ----------
const KEY = process.env.RESEND_API_KEY, PARA = process.env.ALERT_EMAIL;
if (!KEY || !PARA) { console.log('e-mail desligado (faltam os segredos RESEND_API_KEY e ALERT_EMAIL)'); process.exit(0); }

const diaLocal = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // AAAA-MM-DD
const quandoLocal = e => e.airstamp ? diaLocal(new Date(e.airstamp)) : e.data;
const amanha = diaLocal(new Date(hoje.getTime() + 864e5));
const semanaFim = diaLocal(new Date(hoje.getTime() + 7 * 864e5));
const hojeL = diaLocal(hoje);
const segunda = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(hoje) === 'Mon';
const meus = episodios.filter(e => e.alerta);
const deAmanha = meus.filter(e => quandoLocal(e) === amanha);
const daSemana = segunda ? meus.filter(e => { const q = quandoLocal(e); return q >= hojeL && q < semanaFim; }) : [];
if (!deAmanha.length && !daSemana.length) { console.log('nada pra avisar hoje'); process.exit(0); }

const fmt = e => {
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(e.airstamp ? new Date(e.airstamp) : new Date(e.data + 'T12:00:00'));
  return `<li><b>${e.serie}</b> T${e.temporada}E${e.episodio}${e.titulo ? ' — ' + e.titulo : ''} <span style="color:#666">· ${dia}${e.plataforma ? ' · ' + e.plataforma : ''}</span></li>`;
};
let html = '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5">';
if (deAmanha.length) html += `<h3 style="margin:0 0 8px">Amanhã</h3><ul>${deAmanha.map(fmt).join('')}</ul>`;
if (daSemana.length) html += `<h3 style="margin:16px 0 8px">Esta semana</h3><ul>${daSemana.map(fmt).join('')}</ul>`;
html += '<p style="color:#888;font-size:13px">Calendário completo: <a href="https://mochilao.madeinbr.app/telas#cal">mochilao.madeinbr.app/telas</a></p></div>';
const assunto = deAmanha.length
  ? `Amanhã: ${[...new Set(deAmanha.map(e => e.serie))].join(', ')}`
  : `Sua semana de séries: ${daSemana.length} episódio${daSemana.length > 1 ? 's' : ''}`;

const r = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: 'Telas <onboarding@resend.dev>', to: [PARA], subject: assunto, html }),
});
console.log(r.ok ? 'e-mail enviado' : `falha no e-mail: ${r.status} ${await r.text()}`);
