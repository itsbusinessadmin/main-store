const B = require('./banks.js');
let pass = 0; const fails = [];
const is = (input, expect, why) => {
  const got = B.match(input);
  const slug = got ? got.slug : null;
  if (slug === expect) { pass++; }
  else fails.push(`  ${JSON.stringify(input).padEnd(34)} expected ${String(expect).padEnd(14)} got ${String(slug).padEnd(14)} ${why || ''}`);
};

// --- the exact thing the user asked for: any casing ---
['BPI','bpi','Bpi','bPI',' BPI '].forEach(s => is(s, 'bpi', 'casing'));
['GCash','gcash','GCASH','gCash','G-Cash','g cash','G Cash'].forEach(s => is(s, 'gcash', 'casing/punct'));
['BDO','bdo','BDO.','bdo!'].forEach(s => is(s, 'bdo', 'casing/punct'));

// --- name embedded in a longer label, as merchants actually type it ---
is('BPI Savings Account', 'bpi');
is('Send to my BDO account', 'bdo');
is('GCash (preferred)', 'gcash');
is('Metrobank - Main branch', 'metrobank');
is('Transfer to Security Bank', 'securitybank');
is('UnionBank / UBP', 'unionbank');

// --- spaced vs squeezed spellings ---
is('China Bank', 'chinabank');
is('chinabank', 'chinabank');
is('East West Bank', 'eastwest');
is('EastWest', 'eastwest');
is('PS Bank', 'psbank');
is('psbank', 'psbank');
is('Sea Bank', 'maribank', 'seabank is maribank now');
is('SeaBank PH', 'maribank');

// --- full legal names ---
is('Bank of the Philippine Islands', 'bpi');
is('Philippine National Bank', 'pnb');
is('Banco de Oro', 'bdo');
is('Rizal Commercial Banking Corporation', 'rcbc');

// --- wallets ---
is('PayMaya', 'maya');
is('Maya', 'maya');
is('ShopeePay', 'shopeepay');
is('GrabPay', 'grabpay');
is('Coins.ph', 'coinsph');
is('PayPal', 'paypal');

// --- the generic, non-brand types ---
is('Cash', 'cash');
is('CASH ON DELIVERY', 'cash');
is('COD', 'cash');
is('QR', 'qr');
is('QR Ph', 'qr');
is('Scan to pay', 'qr');

// --- the traps ---
is('GCash', 'gcash', '"cash" is inside "gcash" - longest match must win');
is('gcash cash', 'gcash', 'both present, brand is longer');
is('Maya', 'maya', 'must not be caught by maybank-style prefixes');
is('Bank transfer', null, 'generic - no specific bank named');
is('Bank', null, 'too generic to guess');
is('', null, 'empty');
is(null, null, 'null');
is(undefined, null, 'undefined');
is('   ', null, 'whitespace only');
is('Direct deposit', null, 'nothing recognisable');
is('Remittance', null, 'nothing recognisable');

// --- shape of the result ---
const bpi = B.match('BPI');
if (bpi.logo !== 'icons/banks/bpi.png') fails.push(`  bpi logo path wrong: ${bpi.logo}`); else pass++;
if (bpi.name !== 'BPI') fails.push(`  bpi display name wrong: ${bpi.name}`); else pass++;
const cash = B.match('Cash');
if (cash.icon !== 'cash' || cash.logo) fails.push(`  cash should be an icon not a logo: ${JSON.stringify(cash)}`); else pass++;

// --- every brand entry must have a logo file on disk (or be an icon) ---
const fs = require('fs');
for (const b of B.brands) {
  if (b.icon) continue;
  const f = `../icons/banks/${b.slug}.png`;
  if (!fs.existsSync(f)) fails.push(`  missing logo file for "${b.slug}"`); else pass++;
}
// --- and every logo file must be claimed by an entry (no orphans) ---
const slugs = new Set(B.brands.map(b => b.slug));
for (const f of fs.readdirSync('../icons/banks')) {
  const slug = f.replace(/\.png$/, '');
  if (!slugs.has(slug)) fails.push(`  orphan logo file with no registry entry: ${f}`); else pass++;
}

console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('\nFAILURES:'); console.log(fails.join('\n')); process.exit(1); }
