# SeriesTracker

Application web privée de suivi de séries TV et d'animes, hébergée en self-hosted. Usage familial restreint.

---

## Ce que ça fait

- Suivre la progression de tes séries et animes épisode par épisode
- Calendrier des sorties de la semaine / du mois
- Recherche unifiée : base locale d'abord, puis TMDB et AniList en fallback
- Import automatique d'un show avec toutes ses saisons et épisodes
- Lier les saisons d'un anime entre elles (suite, préquelle, spin-off…)
- Page "Sorties" : films en salle, animes de la saison courante, séries en cours
- Page "Diffusion terminée" : shows à rattraper ou à découvrir d'une traite
- Listes partagées entre membres de la famille
- Feed d'activité (qui regarde quoi)
- Notifications push web (VAPID) à 8h pour les nouveaux épisodes
- Paramètres : profil, mot de passe, plateformes de streaming, notifications

---

## Stack

- **Next.js 16** — App Router, Server Components, Server Actions
- **TypeScript** strict
- **Tailwind CSS v4**
- **Prisma 7** + **PostgreSQL**
- **Auth.js v5** — credentials (email + mot de passe), sessions JWT
- **TMDB** pour les séries et films, **AniList** (GraphQL) pour les animes
- **web-push** VAPID pour les notifications push natives
- Hébergé sur un VPS via **Coolify**

---

## Lancer en local

**Prérequis :** Node.js 20+, PostgreSQL (pgAdmin ou autre)

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et remplir les variables d'environnement
cp .env.production .env.local
# → renseigner DATABASE_URL, AUTH_SECRET, TMDB_READ_ACCESS_TOKEN, etc.

# 3. Créer la base et appliquer les migrations
npm run db:migrate

# 4. Créer les comptes initiaux
npm run db:seed <mot-de-passe>

# 5. Lancer le serveur de dev
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

---

## Scripts utiles

| Commande | Rôle |
|----------|------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run db:migrate` | Appliquer les migrations Prisma |
| `npm run db:seed <mdp>` | Créer les comptes initiaux |
| `npm run db:clean` | Vider la base (garde les users) |
| `npm run db:studio` | Interface Prisma Studio |

---

## Déploiement (Coolify)

1. Connecter le repo GitHub dans Coolify
2. Renseigner les variables d'environnement (voir `.env.production` pour la liste complète)
3. Ajouter les deux tâches planifiées :

```bash
# Sync des shows suivis — 3h du matin
0 3 * * * curl -X POST https://ton-domaine.fr/api/cron/sync-shows \
  -H "Authorization: Bearer $CRON_SECRET"

# Envoi des notifications — 8h du matin
0 8 * * * curl -X POST https://ton-domaine.fr/api/cron/send-notifications \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Variables d'environnement

Voir `.env.production` pour la liste complète. Les secrets à ne jamais commiter :

- `AUTH_SECRET` — générer avec `openssl rand -base64 32`
- `DATABASE_URL` — fourni par Coolify
- `VAPID_PRIVATE_KEY` — générer avec `npx web-push generate-vapid-keys`
- `CRON_SECRET` — token aléatoire

---

Usage privé · non distribué
