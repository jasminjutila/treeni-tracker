# Treeni Tracker

Henkilökohtainen treenipäiväkirja-PWA. Sama pino kuin Pablo/Ruokasuunnittelija:
**Node + Express + Firestore + PWA Cloud Runissa**, salaisen polun (`/APP_TOKEN/`) takana.
Alue `europe-north1`, projekti `illusian-pitch-processor`.

## Pino
- **Backend:** Node.js + Express (`server.js`), tarjoilee PWA:n ja APIn salaisen polun takana
- **Data:** Google Cloud Firestore
- **Frontend:** staattinen PWA (`public/`) — offline-tuki service workerilla
- **Ajo:** Cloud Run, buildaus pilvessä (`--source=.`)

## Ajaminen paikallisesti
```bash
npm install
echo 'APP_TOKEN=oma-salainen-polku' > .env
node server.js
# Sovellus: http://localhost:8080/<APP_TOKEN>/
```

## Deploy
```bash
./deploy.sh   # lukee APP_TOKENin .env-tiedostosta ja deployaa Cloud Runiin
```

## Suojaus
Ei muuta suojausta kuin salainen polku (`APP_TOKEN`) — henkilökohtainen sovellus.
`.env` (ja siten `APP_TOKEN`) on `.gitignore`ssa eikä päädy versionhallintaan.
