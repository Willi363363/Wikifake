// The address a data request is sent to.
//
// **This is a placeholder, and step J.3 is 🔶 until it is not.** The owner has
// not settled which address to publish, and inventing one is worse than saying
// so: `.invalid` is reserved by RFC 2606 precisely so that a placeholder cannot
// silently be somebody's real inbox.
//
// One constant rather than a line in each catalogue: a privacy policy that
// named one address in English and another in French would be two policies.
// `legal.test.tsx` holds both pages to this value, so replacing it is one edit
// and the tests say whether it reached every page that promises it.
//
// What has to happen: put a real, monitored address here — a person is entitled
// to an answer, and GDPR gives them a month to get one — and tick J.3 in
// `plans/product/10-seo-and-legal.md`.
export const LEGAL_CONTACT = 'privacy@wikifake.invalid';
