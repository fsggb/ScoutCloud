# ScoutCloud

Gestionnaire de fichiers FSGGB : https://fsggb.github.io/ScoutCloud/

Les fichiers de chaque utilisateur sont stockés dans le dépôt GitHub **privé** `fsggb/scouthub-data`, via le serveur Apps Script de ScoutHub (`ScoutHub/backend/Code.gs`). Le jeton GitHub ne quitte jamais ce serveur.

- Connexion unique : la session ScoutHub (`localStorage`, même origine `fsggb.github.io`) est réutilisée ; sans session, ScoutCloud renvoie vers ScoutHub puis revient.
- Fonctions : dossiers, import (glisser-déposer compris), aperçu des images et PDF, édition des fichiers texte, téléchargement, renommage, suppression, filtre.
- Limite : 10 Mo par fichier.
- Les applications (ScoutDraft, ScoutCAD, CathIA, ScoutMap, ScoutOffice, ScoutCraft) enregistrent dans ScoutCloud grâce à `ScoutHub/scouthub-client.js`.
