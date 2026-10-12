// Rota agendada (vercel.json > crons, todo dia às 8h de Brasília): chama a função whatch-avisos do Supabase, que manda os
// avisos por e-mail. Só age no projeto do Whatch (WHATCH_CRON=1; o mochilão usa o mesmo repositório e ignora) e só quando
// quem chama é o agendador da Vercel (CRON_SECRET, que a Vercel manda sozinha no cabeçalho).
export default async function handler(req, res) {
  if (process.env.WHATCH_CRON !== '1') return res.status(200).json({ ok: true, pulou: 'não é o projeto do Whatch' });
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ ok: false });
  try {
    const r = await fetch('https://irawlnmcinqkxzgczmrb.supabase.co/functions/v1/whatch-avisos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    console.log('avisos', JSON.stringify(j));
    return res.status(r.ok ? 200 : 502).json(j);
  } catch (e) {
    console.error('avisos', e && e.message);
    return res.status(502).json({ ok: false });
  }
}
