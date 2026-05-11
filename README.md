# 📺 SeriesTracker

> Application web privée de tracking de séries TV et d'animes pour un usage familial restreint (5 utilisateurs max).
> Inspirée de TV Time, en self-hosted, autonome vis-à-vis des API externes.

---

## 🎯 Objectif

Créer une application web responsive permettant à un petit groupe d'utilisateurs (couple + famille proche) de :

- Suivre la progression de leurs séries TV et animes
- Visualiser un calendrier des sorties (global et personnel)
- Être notifié automatiquement des nouvelles saisons et nouveaux épisodes
- Créer et partager des listes de recommandations
- Voir l'activité de visionnage des autres membres

L'application est **privée** (register fermé / allowlist d'emails), pensée mobile-first, et préparée pour une future extension en application mobile (PWA d'abord, React Native ensuite si besoin).

---

## ✨ Fonctionnalités

### 🔐 Authentification
- Login / Register avec email + mot de passe
- Register fermé après création des comptes initiaux (variable d'env `ALLOW_REGISTRATION` ou allowlist d'emails)
- Sessions sécurisées via Auth.js (NextAuth v5)
- Rate limiting sur les routes d'auth

### 📅 Calendriers
- **Calendrier global** : toutes les sorties séries + animes des prochaines semaines
- **Calendrier personnel** : uniquement les shows que l'utilisateur suit
- Filtres : Séries / Animes / Tout
- Vue mensuelle (grid) + vue liste alternative
- Toggle responsive entre les deux vues

### 🎬 Tracking de shows
- Recherche unifiée (séries TMDB + animes AniList)
- Statuts : `WATCHING`, `COMPLETED`, `PLAN_TO_WATCH`, `DROPPED`, `PAUSED`
- Tracking par épisode (case à cocher, date de visionnage)
- Notes et avis personnels par show
- Page détail avec synopsis, saisons, cast, prochain épisode

### 🔔 Notifications
- Détection automatique des nouvelles saisons des shows suivis
- Notification le jour de sortie d'un nouvel épisode
- Canaux : in-app + web push (VAPID natif, gratuit, sans service externe)
- Préférences par show (activer/désactiver les notifs)

### 📋 Listes partagées
- Création de listes thématiques (ex: "À regarder cet été", "Comédies romantiques")
- Partage avec tous les autres membres
- Drag & drop pour réorganiser
- Indication de qui a ajouté quoi
- Notes possibles sur chaque entrée

### 👫 Activité partenaire / famille
- Voir ce que les autres membres regardent en ce moment
- Feed d'activité (épisodes vus récemment, nouveaux ajouts)

---

## 🏗️ Stack technique

### Frontend & Backend (monorepo Next.js)
- **Next.js 14+** (App Router, Server Components, Server Actions)
- **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui** pour le design system
- **TanStack Query** (React Query) pour le data fetching côté client
- **Zustand** pour le state management léger
- **Zod** pour la validation des schémas (API + forms)
- **React Hook Form** pour les formulaires

### Base de données & ORM
- **PostgreSQL 16+** (déployé via Coolify)
- **Prisma** comme ORM (migrations + types auto-générés)
- Extension `pg_trgm` activée pour la recherche full-text tolérante aux fautes

### Auth
- **Auth.js v5** (NextAuth) avec adapter Prisma
- Provider : Credentials (email/password) avec bcrypt
- Sessions stockées en DB

### Notifications
- **web-push** (npm) pour les notifications push web (VAPID natif, pas de service externe)
- Notifications in-app stockées en DB et affichées dans un centre de notifs

### Cron / Jobs
- **Coolify Scheduled Tasks** déclenchant des routes API protégées par token
- Routes : `/api/cron/sync-shows`, `/api/cron/send-notifications`
- Pas de Redis / BullMQ (overkill pour ce volume)

### Hébergement
- **VPS personnel** + **Coolify** (gestion Docker, reverse proxy Traefik, SSL Let's Encrypt auto)
- Domaine personnel avec sous-domaine dédié

### APIs externes (uniquement en sync, jamais depuis le frontend)
- **TMDB** (The Movie Database) — séries TV
- **AniList** (GraphQL) — animes
- Fallback éventuel : **TVMaze** pour les schedules, **Jikan** pour les animes

### Stockage des images
- **Pas de self-host** des médias : on stocke uniquement les URLs CDN de TMDB/AniList
- Optimisation via le composant `<Image>` de Next.js (cache + WebP/AVIF auto)
- Volume Docker persistant pour le cache Next.js

---

## 🗄️ Modèle de données

### Principe
La base PostgreSQL est la **source de vérité unique**. Le frontend ne tape jamais directement TMDB/AniList — uniquement les jobs de sync le font. Cela garantit la rapidité (~50ms par requête), l'autonomie en cas de panne d'API externe, et le respect des quotas.

### Entités principales

| Modèle | Rôle |
|---|---|
| `User` | Utilisateurs de l'app |
| `Show` | Une série TV ou un anime (clés externes : `tmdbId`, `anilistId`) |
| `Season` | Une saison d'un show |
| `Episode` | Un épisode (avec `airDate` indexé pour les calendriers) |
| `UserShow` | Relation user ↔ show avec statut, rating, préférences notifs |
| `UserEpisode` | Tracking d'un épisode vu par un user |
| `SharedList` | Liste partagée |
| `ListMember` | Membres d'une liste |
| `ListItem` | Entrées dans une liste |
| `Notification` | Notifications in-app |
| `PushSubscription` | Subscriptions push web par device |

Le schéma Prisma complet est dans `prisma/schema.prisma`.

### Énumérations

- `MediaType` : `SERIES`, `ANIME`
- `ShowStatus` : `RETURNING`, `ENDED`, `CANCELED`, `UPCOMING`, `IN_PRODUCTION`
- `WatchStatus` : `WATCHING`, `COMPLETED`, `PLAN_TO_WATCH`, `DROPPED`, `PAUSED`
- `NotifType` : `NEW_EPISODE`, `NEW_SEASON`, `SHOW_RETURNING`, `EPISODE_TOMORROW`

---

## 🔄 Stratégie de synchronisation

### 3 niveaux de priorité

| Priorité | Cible | Fréquence |
|---|---|---|
| **Haute** | Shows suivis par au moins 1 user (`WATCHING`) | Quotidienne (3h du matin) |
| **Moyenne** | Shows présents dans des listes mais non suivis | Hebdomadaire |
| **Basse** | Catalogue général (sorties à venir TMDB `on_the_air` + saison AniList en cours) | Quotidienne ciblée |

### Flow de recherche d'un show

```
1. User tape "Breaking Bad"
2. Backend : SELECT * FROM Show WHERE title ILIKE '%breaking bad%'
3a. Trouvé → retour direct (instantané)
3b. Pas trouvé → fallback API TMDB/AniList → upsert en DB → retour
4. User clique "Ajouter"
5. Sync complète du show (saisons + épisodes) → UserShow créé
6. Le show passe en syncPriority haute
```

### Détection des nouveautés

Au moment du sync quotidien, comparer les saisons/épisodes connus en DB avec ceux retournés par l'API :
- Nouvelle saison détectée → notification `NEW_SEASON` à tous les followers
- Nouvel épisode futur → notification `EPISODE_TOMORROW` la veille de la diffusion
- Show qui passe de `ENDED` à `RETURNING` → notification `SHOW_RETURNING`

---

## 📁 Structure du projet

```
seriestracker/
├── prisma/
│   ├── schema.prisma          # Schéma complet
│   ├── migrations/            # Migrations Prisma
│   └── seed.ts                # Seed pour le dev local
├── src/
│   ├── app/                   # App Router Next.js
│   │   ├── (auth)/            # Routes login / register
│   │   ├── (app)/             # Routes authentifiées
│   │   │   ├── dashboard/
│   │   │   ├── calendar/
│   │   │   ├── show/[id]/
│   │   │   ├── lists/
│   │   │   ├── search/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── shows/
│   │   │   ├── lists/
│   │   │   ├── notifications/
│   │   │   └── cron/
│   │   │       ├── sync-shows/
│   │   │       └── send-notifications/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── shows/             # ShowCard, EpisodeRow, etc.
│   │   ├── calendar/          # CalendarGrid, CalendarList
│   │   ├── lists/
│   │   └── layout/            # Sidebar, BottomNav, Header
│   ├── lib/
│   │   ├── auth.ts            # Config Auth.js
│   │   ├── db.ts              # Client Prisma singleton
│   │   ├── tmdb/              # Client TMDB
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── mappers.ts     # TMDB → modèle interne
│   │   ├── anilist/           # Client AniList GraphQL
│   │   │   ├── client.ts
│   │   │   ├── queries.ts
│   │   │   └── mappers.ts
│   │   ├── sync/              # Logique de synchronisation
│   │   │   ├── sync-show.ts
│   │   │   ├── detect-changes.ts
│   │   │   └── priority-queue.ts
│   │   ├── notifications/
│   │   │   └── push.ts        # Web Push VAPID
│   │   └── utils.ts
│   ├── hooks/                 # Hooks React (useShows, useCalendar, etc.)
│   ├── stores/                # Zustand stores
│   └── types/                 # Types partagés
├── public/
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── Dockerfile
├── docker-entrypoint.sh
└── README.md
```

---

## 🔧 Variables d'environnement

À configurer dans Coolify (ou `.env.local` en dev) :

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/seriestracker"

# Auth.js
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://series.tondomaine.fr"

# Inscriptions
ALLOW_REGISTRATION="false"
ALLOWED_EMAILS="toi@x.com,elle@y.com,frere@x.com"

# APIs externes
TMDB_API_KEY="..."
TMDB_READ_ACCESS_TOKEN="..."
# AniList ne nécessite pas de clé pour les requêtes publiques

# Web Push (générées avec `npx web-push generate-vapid-keys`)
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:toi@x.com"

# Cron
CRON_SECRET="<token aléatoire>"

# Misc
NODE_ENV="production"
```

---

## 🐳 Déploiement (Coolify)

### Dockerfile (multi-stage)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

### Entrypoint avec migration auto

```bash
#!/bin/sh
set -e
npx prisma migrate deploy
exec node server.js
```

### Configuration `next.config.js`

```javascript
module.exports = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 's4.anilist.co' },
    ],
  },
}
```

### Scheduled Tasks Coolify

```bash
# Sync quotidien des shows suivis (3h du matin)
0 3 * * * curl -X POST https://series.tondomaine.fr/api/cron/sync-shows \
  -H "Authorization: Bearer ${CRON_SECRET}"

# Envoi des notifications du jour (8h du matin)
0 8 * * * curl -X POST https://series.tondomaine.fr/api/cron/send-notifications \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

---

## 🚀 Roadmap / Ordre de développement

### Phase 1 — MVP (auth + tracking de base)
- [ ] Setup Next.js + Prisma + PostgreSQL
- [ ] Schéma Prisma complet + première migration
- [ ] Auth.js avec register fermé
- [ ] Layout principal (sidebar desktop / bottom nav mobile)
- [ ] Recherche de shows (TMDB + AniList)
- [ ] Page détail d'un show
- [ ] Ajout / retrait d'un show (UserShow)
- [ ] Tracking d'épisodes individuels

### Phase 2 — Calendriers
- [ ] Vue calendrier mensuelle (grid)
- [ ] Vue calendrier liste
- [ ] Toggle global / personnel
- [ ] Filtres séries / animes
- [ ] Cron de sync des sorties

### Phase 3 — Notifications
- [ ] Système de notifications in-app
- [ ] Détection des nouvelles saisons / épisodes
- [ ] Web Push (VAPID + Service Worker)
- [ ] Préférences de notifs par show

### Phase 4 — Social / Listes
- [ ] Création de listes partagées
- [ ] Drag & drop dans les listes
- [ ] Feed d'activité du partenaire / famille
- [ ] Recommandations entre membres

### Phase 5 — Polish & PWA
- [ ] Manifest PWA + Service Worker
- [ ] Installable sur iOS / Android
- [ ] Optimisations perf (lazy loading, code splitting)
- [ ] Animations & micro-interactions
- [ ] Mode sombre / clair
- [ ] Tests E2E (Playwright)

### Phase 6 — Mobile native (optionnel)
- [ ] Évaluation : PWA suffisante ou React Native nécessaire ?
- [ ] Si RN : extraire la logique métier en package partagé

---

## 🎨 Direction artistique

- **Ambiance** : moderne, cinématographique, élégante
- **Mode** : dark mode par défaut (avec light mode dispo)
- **Palette** :
  - Fond : `#0A0A0F`
  - Accent séries : `#A855F7` (violet)
  - Accent animes : `#FB7185` (corail)
  - Texte principal : `#FAFAFA`
  - Texte secondaire : `#A1A1AA`
- **Typo** : Inter / Geist / Satoshi (sans-serif moderne)
- **Inspirations** : Letterboxd, Apple TV+, Linear, Arc Browser

### Composants clés à designer
- `ShowCard` (poster + titre + statut)
- `EpisodeRow` (numéro + titre + date + checkbox)
- `CalendarDay` (case calendrier avec posters miniatures)
- `UserAvatar` (avec activité récente)
- `EmptyState` (états vides chaleureux)

### Navigation
- **Desktop** : sidebar fixe à gauche
- **Mobile** : bottom tab bar (5 onglets max : Home, Calendar, Search, Lists, Profile)

---

## 🔒 Sécurité

- Mots de passe hashés avec **bcrypt** (cost 12+)
- Sessions JWT signées côté serveur
- Routes API protégées par middleware Next.js
- Routes cron protégées par bearer token (`CRON_SECRET`)
- Rate limiting sur `/api/auth/*` (en mémoire, suffisant pour ce volume)
- Headers de sécurité : CSP, X-Frame-Options, X-Content-Type-Options
- HTTPS forcé via Traefik (Coolify)
- Validation Zod sur **toutes** les entrées utilisateur
- Pas de données sensibles loggées

---

## 🧪 Qualité de code

- ESLint + Prettier configurés
- Pre-commit hook avec **Husky** + **lint-staged**
- Types stricts (TypeScript `strict: true`)
- Tests unitaires sur la logique de sync (Vitest)
- Tests E2E des flows critiques (Playwright) — phase 5

---

## 📊 Estimations

Pour 5 utilisateurs avec ~50 shows suivis au total :

| Métrique | Estimation |
|---|---|
| Taille DB après 1 an | 200-500 MB |
| Appels TMDB / jour | ~100 (largement sous quota de 50/sec) |
| Appels AniList / jour | ~50 (largement sous quota de 90/min) |
| Durée du cron quotidien | 5-15 minutes |
| Temps de réponse moyen | < 50 ms (tout en DB locale) |
| RAM container Next.js | ~200-400 MB |
| RAM container Postgres | ~100-200 MB |

---

## 📚 Ressources utiles

- [TMDB API docs](https://developer.themoviedb.org/docs)
- [AniList GraphQL docs](https://docs.anilist.co/)
- [Auth.js v5](https://authjs.dev/)
- [Prisma docs](https://www.prisma.io/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Coolify docs](https://coolify.io/docs)
- [Web Push (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

---

## 🤝 Notes pour Claude Code

Quelques conventions à respecter pour ce projet :

- **Server Components par défaut**, Client Components uniquement quand nécessaire (`"use client"`)
- **Server Actions** pour les mutations simples, API routes pour les choses publiques (cron, webhooks)
- **Toujours valider** les inputs avec Zod, jamais faire confiance aux données client
- **Prisma client en singleton** (`src/lib/db.ts`) pour éviter les fuites de connexions en dev
- **Mappers explicites** entre les types externes (TMDB / AniList) et les types internes — ne jamais persister les payloads bruts
- **Logs structurés** pour les jobs de sync (durée, count, erreurs) → table `SyncLog`
- **Idempotence** des routes cron : peuvent être relancées sans effets de bord
- **Mobile-first** dans le CSS (Tailwind) : les breakpoints `md:` et `lg:` ajoutent les comportements desktop
- **Pas de `any`** en TypeScript, jamais. Utiliser `unknown` + narrowing si vraiment nécessaire

---

**Auteur** : usage privé familial
**Licence** : privée, non distribuée
