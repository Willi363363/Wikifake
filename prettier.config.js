// Prettier resolves its configuration by walking up from each file. Without
// this root re-export, only files inside packages/config saw the shared rules
// and everything else was formatted with Prettier's defaults — the opposite of
// the single shared configuration the rules claim.
export { default } from '@wikifake/config/prettier';
