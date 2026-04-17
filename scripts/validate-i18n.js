const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'translations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));

function getKeys(obj, prefix) {
  prefix = prefix || '';
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys = keys.concat(getKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getKeys(en).sort();
console.log('English base: ' + enKeys.length + ' keys\n---');

const technicalTerms = ['Biozephyra', '3D', 'AI', 'Pro', 'Email', 'SMTP'];
let allGood = true;

for (const file of files) {
  const locale = file.replace('.json', '');
  try {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const data = JSON.parse(raw);
    const localeKeys = getKeys(data).sort();

    const missing = enKeys.filter(k => !localeKeys.includes(k));
    const extra = localeKeys.filter(k => !enKeys.includes(k));

    // Check empty values
    const empties = [];
    function walkEmpty(obj, pfx) {
      pfx = pfx || '';
      for (const k of Object.keys(obj)) {
        const fk = pfx ? pfx + '.' + k : k;
        if (typeof obj[k] === 'string' && obj[k].trim() === '') empties.push(fk);
        else if (typeof obj[k] === 'object' && obj[k] !== null) walkEmpty(obj[k], fk);
      }
    }
    walkEmpty(data);

    // Check untranslated
    const untranslated = [];
    if (locale !== 'en') {
      function walkUntrans(eObj, lObj, pfx) {
        pfx = pfx || '';
        for (const k of Object.keys(eObj)) {
          const fk = pfx ? pfx + '.' + k : k;
          if (typeof eObj[k] === 'string') {
            if (lObj && lObj[k] === eObj[k] && !technicalTerms.includes(eObj[k])) {
              untranslated.push(fk + ' => "' + eObj[k] + '"');
            }
          } else if (typeof eObj[k] === 'object' && eObj[k] !== null && lObj && typeof lObj[k] === 'object') {
            walkUntrans(eObj[k], lObj[k], fk);
          }
        }
      }
      walkUntrans(en, data);
    }

    const issues = [];
    if (missing.length) issues.push('MISSING(' + missing.length + '): ' + missing.join(', '));
    if (extra.length) issues.push('EXTRA(' + extra.length + '): ' + extra.join(', '));
    if (empties.length) issues.push('EMPTY(' + empties.length + '): ' + empties.join(', '));
    if (untranslated.length) issues.push('UNTRANSLATED(' + untranslated.length + '): ' + untranslated.slice(0, 15).join('; '));

    const status = (missing.length || extra.length || empties.length) ? 'ISSUES' : 'OK';
    if (status !== 'OK') allGood = false;

    console.log(locale.toUpperCase() + ' (' + localeKeys.length + ' keys): ' + status);
    for (const iss of issues) console.log('  ' + iss);
  } catch (e) {
    console.log(locale.toUpperCase() + ': PARSE ERROR - ' + e.message);
    allGood = false;
  }
}

console.log('\n---');
console.log(allGood ? 'ALL FILES VALID' : 'SOME FILES HAVE ISSUES');
process.exit(allGood ? 0 : 1);
