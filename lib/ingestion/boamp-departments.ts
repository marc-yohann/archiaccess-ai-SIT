// Liste explicite et exhaustive des 101 départements français couverts
// par la campagne nationale BOAMP (mission "PASSER BOAMP EN INGESTION
// NATIONALE AUTOMATISÉE", 2026-09-25) — 96 départements métropolitains
// (01 à 95, "20" remplacé par 2A/2B pour la Corse) + 5 DROM (971
// Guadeloupe, 972 Martinique, 973 Guyane, 974 La Réunion, 976 Mayotte).
// Jamais dérivée d'une regex générique (qui admettrait à la fois "20" ET
// "2A"/"2B", un doublon réel) ni de 975 (Saint-Pierre-et-Miquelon, une
// collectivité d'outre-mer, pas un département) — comptage vérifié : 94
// numérotés (01-95 hors 20) + 2A + 2B + 5 DROM = 101.
//
// Ce sont des CODES ADMINISTRATIFS (convention utilisée partout ailleurs
// dans ce projet — stockage, UI, IngestionJob.partition) — jamais le code
// réellement envoyé à l'API BOAMP, qui passe TOUJOURS par
// normalizeDepartmentForBoampQuery() (lib/data-sources/boamp.ts) avant
// d'être utilisé dans une requête.
export const BOAMP_DEPARTMENTS: readonly string[] = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "23", "24", "25", "26", "27", "28", "29",
  "2A", "2B",
  "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
  "60", "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "70", "71", "72", "73", "74", "75", "76", "77", "78", "79",
  "80", "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "90", "91", "92", "93", "94", "95",
  "971", "972", "973", "974", "976",
]

if (BOAMP_DEPARTMENTS.length !== 101) {
  throw new Error(`BOAMP_DEPARTMENTS doit contenir exactement 101 codes, en contient ${BOAMP_DEPARTMENTS.length}.`)
}
