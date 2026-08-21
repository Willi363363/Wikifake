/**
 * Asserts that the rendered markup still contains the things a player needs.
 *
 * React's SSR splits adjacent text nodes with `<!-- -->` comments, so the
 * markup is stripped of them before matching.
 */
import { renderLobby, renderRevealed, renderRound } from '../.smoke/smoke-entry.js';

const clean = (html) => html.replace(/<!-- -->/g, '');

/** `[nom, motif, doitCorrespondre]` — le 3e élément vaut true par défaut. */
const SUITES = [
  ['Lobby', renderLobby, [
    ['titre du jeu', /WikiFake/],
    ['onglet Solo', />Solo</],
    ['onglet Héberger', />Héberger</],
    ['onglet Rejoindre', />Rejoindre</],
    ['champ sujet', /Sujet Wikipédia/],
    ['limite de temps', /Limite de temps/],
    ['bouton de lancement', /Lancer en Solo/],
  ]],
  ['Partie', renderRound, [
    ['titre de l’article', /Tour Eiffel/],
    ['barre du haut', /Wikifake/],
    ['chrono initial', /05:00/],
    ['bouton Submit', />Submit</],
    ['bouton Intel', />Intel</],
    ['corps de l’article', /tour de fer puddlé/],
    ['tokens cliquables', /data-token-id="p0"/],
    // La solution ne doit PAS être dans le DOM pendant la manche.
    ['aucun token saboté révélé', /data-fake-id="F\d/, false],
    ['aucune explication en clair', /En réalité/, false],
    ['sommaire', /Contents/],
    ['classement flottant', /Ranking/],
    ['pied de page', /Intelligence System/],
    ['signalement', /Signaler une erreur factuelle/],
    ['réglages joueur', /aria-label="Réglages"/],
    // L'état de jeu ne doit plus être pilotable depuis un panneau de réglages.
    ['aucun sélecteur d’écran', />Debrief</, false],
    ['aucun panneau de maquettage', /twk-panel/, false],
    ['étiquette de manche réelle', /A2-F1K9/, false],
    ['étiquette SOLO', /SOLO/],
  ]],
  ['Partie révélée', renderRevealed, [
    ['tokens sabotés identifiés', /data-fake-id="F1"/],
    ['deuxième faux identifié', /data-fake-id="F2"/],
  ]],
];

let failures = 0;
for (const [suite, render, checks] of SUITES) {
  console.log(`\n${suite}`);
  const html = clean(render());
  for (const [name, pattern, shouldMatch = true] of checks) {
    const passed = pattern.test(html) === shouldMatch;
    if (!passed) failures += 1;
    console.log(`  ${passed ? '✓' : '✗'} ${name}`);
  }
}

console.log(failures === 0 ? '\nSmoke test OK' : `\n${failures} échec(s)`);
process.exit(failures === 0 ? 0 : 1);
