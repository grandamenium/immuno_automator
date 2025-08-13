const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COLOR_TO_RANGE_NM,
  PREFERRED_FLUOR_EMISSIONS,
  mapFluorophoreNameToEmission,
  matchSecondaries,
  unifySerumHosts,
  calcBlockingVolumes,
  calcPrimaryMix,
  calcSecondaryMix
} = require('../logic');

test('mapFluorophoreNameToEmission resolves common names', () => {
  assert.equal(mapFluorophoreNameToEmission('AF647'), 671);
  assert.equal(mapFluorophoreNameToEmission('Alexa Fluor 555'), 565);
  assert.equal(mapFluorophoreNameToEmission('Cy5.5'), 694);
  assert.equal(mapFluorophoreNameToEmission('FITC'), 519);
  assert.equal(mapFluorophoreNameToEmission('Unknown'), null);
});

test('matchSecondaries respects host, IgG wildcard, and color range', () => {
  const primaries = [
    { name: 'Rabbit anti-Reelin', host_species: 'Rabbit', ig_class: 'IgG1' },
    { name: 'Mouse anti-ABC', host_species: 'Mouse', ig_class: 'IgG' }
  ];
  const secondaries = [
    { name: 'Goat anti-Rabbit AF647', target: 'Rabbit', host_species: 'Goat', ig_class: 'IgG', emission_nm: 671, stock_mg_per_ml: 2 },
    { name: 'Donkey anti-Rabbit AF555', target: 'Rabbit', host_species: 'Donkey', ig_class: 'IgG1', emission_nm: 565, stock_mg_per_ml: 1 },
    { name: 'Goat anti-Mouse AF488', target: 'Mouse', host_species: 'Goat', ig_class: 'IgG', emission_nm: 519, stock_mg_per_ml: null },
    { name: 'Goat anti-Mouse AF594', target: 'Mouse', host_species: 'Goat', ig_class: 'IgG2a', emission_nm: 617, stock_mg_per_ml: 1 }
  ];
  const colors = ['far red', 'green'];

  const chosen = matchSecondaries(primaries, secondaries, colors);
  // For Rabbit IgG1 with far-red, both first two are color-suitable? AF555=565 is red not far-red, so only AF647 should match
  assert.equal(chosen[0].name, 'Goat anti-Rabbit AF647');
  // For Mouse IgG with green, AF488 (519) fits range; IgG wildcard is compatible with any IgG*
  assert.equal(chosen[1].name, 'Goat anti-Mouse AF488');
});

test('unifySerumHosts returns single or two hosts, warns if >2', () => {
  const chosen1 = [ { host_species: 'Goat' }, { host_species: 'Goat' } ];
  const res1 = unifySerumHosts(chosen1);
  assert.deepEqual(res1.hosts, ['Goat']);

  const chosen2 = [ { host_species: 'Goat' }, { host_species: 'Donkey' } ];
  const res2 = unifySerumHosts(chosen2);
  assert.deepEqual(new Set(res2.hosts), new Set(['Goat','Donkey']));
  assert.equal(res2.warning, undefined);

  const chosen3 = [ { host_species: 'Goat' }, { host_species: 'Donkey' }, { host_species: 'Sheep' } ];
  const res3 = unifySerumHosts(chosen3);
  assert.equal(res3.hosts.length, 2);
  assert.ok(res3.warning);
});

test('calcBlockingVolumes rounds up and splits serum 5% or 2.5%+2.5%', () => {
  // slides=1 → 300 uL → rounds to 1 mL (1000 uL)
  let r = calcBlockingVolumes(1, ['Goat']);
  assert.equal(r.total_mL, 1);
  assert.equal(r.total_uL, 1000);
  assert.equal(r.serum[0].volume_uL, Math.round(1000 * 0.05));
  assert.equal(r.diluent_uL, 1000 - r.serum[0].volume_uL);

  r = calcBlockingVolumes(2, ['Goat','Donkey']);
  assert.equal(r.total_mL, 1); // 600 uL → 1 mL
  const sTotal = r.serum.reduce((a,b)=>a+b.volume_uL,0);
  assert.equal(sTotal, Math.round(1000 * 0.05)); // 2.5% + 2.5%
});

test('calcPrimaryMix handles multiple primaries and 10%/90% diluent split', () => {
  // slides=4 → 1200 uL → rounds to 2 mL (2000 uL)
  const primaries = [
    { name: 'Rabbit anti-Reelin', recommended_dilution: '1:1000' },
    { name: 'Mouse anti-ABC', recommended_dilution: null } // default 1:1000
  ];
  const r = calcPrimaryMix(4, primaries);
  // Each primary contributes 2000/1000 = 2 uL
  const stockSum = r.primaries.reduce((a,b)=>a+b.volume_uL,0);
  assert.equal(stockSum, 4);
  const expectedDiluent = 2000 - 4;
  assert.equal(r.blocking_uL, Math.round(expectedDiluent * 0.10));
  assert.equal(r.pbst_uL, expectedDiluent - r.blocking_uL);
});

test('calcSecondaryMix computes stock µL and PBST remainder', () => {
  // slides=3 → 900 uL → rounds to 1 mL
  const secs = [
    { name: 'Goat anti-Rabbit AF647', stock_mg_per_ml: 2 }, // 1mL / 2 = 0.5 uL → rounds to 1 uL after Math.round
    { name: 'Goat anti-Mouse AF488', stock_mg_per_ml: null } // assume 1 mg/mL → 1 uL
  ];
  const r = calcSecondaryMix(3, secs);
  const stockSum = r.secondaries.reduce((a,b)=>a+b.volume_uL,0);
  assert.equal(stockSum, Math.round(1/2) + 1);
  assert.equal(r.pbst_uL, r.total_uL - stockSum);
});


