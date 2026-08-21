/** Affiche les surcouches plein ecran des effets actifs. */

import { effectOf } from './registry';

function EffectsLayer({ activeIds }) {
  return (
    <>
      {activeIds.map((id) => {
        const Overlay = effectOf(id).overlay;
        return Overlay ? <Overlay key={id} active /> : null;
      })}
    </>
  );
}

export default EffectsLayer;
