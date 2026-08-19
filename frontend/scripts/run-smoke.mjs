/**
 * Asserts that the rendered markup still contains the things a player needs.
 *
 * React's SSR splits adjacent text nodes with `<!-- -->` comments, so the
 * markup is stripped of them before matching.
 */
import { renderLobby, renderRound } from '../.smoke/smoke-entry.js';

const clean = (html) => html.replace(/<!-- -->/g, '');

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
    ['token saboté', /data-fake-id="F1"/],
    ['sommaire', /Contents/],
    ['classement flottant', /Ranking/],
    ['pied de page', /Intelligence System/],
    ['signalement', /Signaler une erreur factuelle/],
  ]],
];

let failures = 0;
for (const [suite, render, checks] of SUITES) {
  console.log(`\n${suite}`);
  const html = clean(render());
  for (const [name, pattern] of checks) {
    const passed = pattern.test(html);
    if (!passed) failures += 1;
    console.log(`  ${passed ? '✓' : '✗'} ${name}`);
  }
}

console.log(failures === 0 ? '\nSmoke test OK' : `\n${failures} échec(s)`);
process.exit(failures === 0 ? 0 : 1);
