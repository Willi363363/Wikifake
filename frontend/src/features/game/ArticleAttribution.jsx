/**
 * Attribution de la source, obligatoire et non décorative.
 *
 * Wikipédia est publié sous CC BY-SA : la réutilisation, y compris
 * commerciale, impose de citer l'auteur, de nommer la licence et — c'est le
 * point critique ici — **d'indiquer que le texte a été modifié**. Le jeu
 * altère délibérément des faits ; l'afficher sans le dire serait à la fois une
 * violation de la licence et de la désinformation involontaire.
 *
 * Ce bloc est donc toujours visible, pendant la manche comme après.
 */
import { LICENSE } from '../../config.js';

export function ArticleAttribution({ topic, sourceUrl }) {
  return (
    <aside className="attribution">
      <p className="attribution-warning">
        <strong>Texte volontairement modifié.</strong> Des faits ont été altérés
        pour les besoins du jeu : ce contenu n’est pas une source fiable.
      </p>
      <p className="attribution-credit">
        D’après l’article{' '}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
            « {topic} »
          </a>
        ) : (
          <>« {topic} »</>
        )}{' '}
        de Wikipédia, par ses contributeurs, sous licence{' '}
        <a href={LICENSE.url} target="_blank" rel="noreferrer noopener">
          {LICENSE.name}
        </a>
        . Les modifications sont l’œuvre de WikiFake et sont diffusées sous la
        même licence.
      </p>
    </aside>
  );
}
