/**
 * Public API of the items feature: catalog data, the item UI (bar, target
 * modal, toasts), the full-screen effect overlays and the hook that drives
 * the transient malus state.
 */
export { ITEM_DEFS, itemDef, isSelfCast } from './catalog';
export { ItemCard } from './ItemCard';
export { ItemBar } from './ItemBar';
export { ItemTargetModal } from './ItemTargetModal';
export { ItemNotification } from './ItemNotification';
export { useItemEffects } from './useItemEffects';
export * from './effects';
