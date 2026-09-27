// Principes du référentiel, communs au PDF et à l'espace projet.

export const PRESENTATION =
  "Ce référentiel décrit la méthode de travail du cabinet Archiaccess pour conduire une mission d'assistance à maîtrise d'ouvrage (AMO), de conduite d'opération ou d'ordonnancement, pilotage et coordination (OPC), quel que soit l'ouvrage : bâtiment, logement, établissement recevant du public, ouvrage d'art, infrastructure linéaire, ferroviaire et métro, réseaux, industriel. Il sert de documentation de méthode et de support d'intégration des collaborateurs ; chacune de ses étapes structure aussi l'espace projet de l'outil Archiaccess SIT."

// `interne` : principe de maintenance de la méthode, montré dans le PDF et
// aux administrateurs du SIT, pas aux collaborateurs.
export const PRINCIPES: { titre: string; texte: string; interne?: boolean }[] = [
  {
    titre: "L'outil prépare, l'ingénieur analyse, le maître d'ouvrage décide",
    texte:
      "Aucun livrable de l'outil n'est une décision. L'AMO conseille et propose ; le conducteur d'opération instruit des projets de décision que le maître d'ouvrage signe. Un AMO qui dirige ou contrôle lui-même les travaux s'expose à être qualifié de constructeur, avec la responsabilité décennale correspondante (Conseil d'État, 21 février 2011, n° 330515 ; 9 mars 2018, n° 406205). Nos process et notre outil ne brouillent jamais cette frontière.",
  },
  {
    titre: "Tout est sourcé sur des textes publics",
    texte:
      "Code de la commande publique, cahiers des clauses administratives générales de 2021, Code civil, Code du travail, Code de l'environnement, formulaires de la Direction des affaires juridiques du ministère de l'Économie, imprimés Cerfa. Les numéros d'articles cités sont revérifiés sur Légifrance à chaque révision du référentiel.",
  },
  {
    titre: "Une méthode propre à Archiaccess",
    interne: true,
    texte:
      "Le référentiel est rédigé par le cabinet, avec ses mots et son découpage. Il ne reproduit aucun ouvrage du commerce ni aucune norme protégée ; ces ouvrages restent des lectures de référence pour les ingénieurs.",
  },
  {
    titre: "Ce qui n'est jamais automatisé est écrit noir sur blanc",
    texte:
      "Pour chaque étape, le référentiel distingue ce que l'outil prépare de ce que l'ingénieur fait lui-même : visites, qualification technique, arbitrages, relation avec le maître d'ouvrage et les entreprises.",
  },
  {
    titre: "Rien n'est validé sans un senior",
    interne: true,
    texte:
      "Chaque étape porte un statut : brouillon, relu par un senior, validé. Les variantes propres aux ouvrages d'art, au ferroviaire et aux infrastructures sont relues par un ingénieur ayant pratiqué ces ouvrages.",
  },
]

export const AXES_INTRO =
  "Une même étape ne se déroule pas de la même façon selon trois axes, fixés dès la création du projet ; l'outil en déduit les variantes applicables. Le statut du maître d'ouvrage détermine les règles de passation et les circuits de décision. Le montage contractuel détermine qui conçoit, qui pilote et qui porte les risques. La typologie d'ouvrage détermine les autorisations, les contrôles et les conditions de réception."
