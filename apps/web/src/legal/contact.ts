// The address a data request is sent to.
//
// One constant rather than a line in each catalogue: a privacy policy that
// named one address in English and another in French would be two policies.
// `legal.test.tsx` holds both documents to this value and asserts that no `@`
// appears in either catalogue, so the day this changes it is one edit and the
// tests say whether it reached every page that promises it.
//
// **It was a placeholder until 2026-09-11**, and step J.3 stayed 🔶 the whole
// time it was: `privacy@wikifake.invalid`, on the `.invalid` TLD RFC 2606
// reserves precisely so that a stand-in cannot quietly be somebody's real
// inbox. A policy that cannot be replied to fails the obligation it exists to
// meet, which is why the step was not ticked for having been written.
//
// What this address owes whoever writes to it: an answer within a month, which
// is the GDPR's window and not a courtesy.
export const LEGAL_CONTACT = 'admin.wikifake@gmail.com';
