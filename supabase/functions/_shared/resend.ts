// Envoi d'email via l'API Resend, partagé par les edge functions qui en ont
// besoin (create-membre-access, send-notification, send-convocation).
// Secret requis : RESEND_API_KEY (supabase secrets set RESEND_API_KEY=...).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
// Resend déconseille "no-reply" (moins de confiance côté filtres antispam,
// qui voient qu'aucun humain ne peut recevoir de signalement) — utilise une
// adresse à laquelle on peut effectivement répondre.
const FROM = 'Amicale La Madeleine <contact@pompiers-lamadeleine.fr>'

export async function envoyerEmail(destinataire: string, sujet: string, corpsHtml: string): Promise<{ ok: boolean; erreur?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: destinataire,
      subject: sujet,
      html: gabaritEmail(sujet, corpsHtml),
    }),
  })

  if (!res.ok) {
    const texte = await res.text()
    return { ok: false, erreur: `Resend ${res.status}: ${texte}` }
  }
  return { ok: true }
}

// Gabarit minimal aux couleurs de l'amicale (brand-ink / brand-brick),
// compatible clients email (styles inline, pas de CSS externe).
function gabaritEmail(titre: string, corpsHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background:#F3ECDC;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3ECDC;padding:24px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FBF7EE;border:1px solid #DCD0B4;">
            <tr>
              <td style="background:#181410;padding:20px 24px;">
                <span style="color:#F3ECDC;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:14px;">
                  Amicale des Sapeurs-Pompiers de La Madeleine
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;color:#181410;font-size:14px;line-height:1.6;word-break:break-word;">
                <h1 style="font-size:20px;margin:0 0 16px;color:#181410;">${titre}</h1>
                ${corpsHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;color:#6b6862;font-size:11px;border-top:1px solid #DCD0B4;">
                Amicale des Sapeurs-Pompiers de La Madeleine — depuis 1847
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
