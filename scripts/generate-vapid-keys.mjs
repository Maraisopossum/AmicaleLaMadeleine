import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('\nClés VAPID générées.\n')
console.log('1. Ajoute dans .env (et sur Netlify, variable de build) :')
console.log(`   VITE_VAPID_PUBLIC_KEY=${keys.publicKey}\n`)
console.log('2. Enregistre la clé privée comme secret de la Supabase Edge Function (jamais côté client, jamais commit) :')
console.log(`   supabase secrets set VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`   supabase secrets set VAPID_PUBLIC_KEY=${keys.publicKey}\n`)
