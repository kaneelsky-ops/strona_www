import { computeName, reduceNumber, meanings, meaningsEn, numberType } from './numerology.mjs';

const english = document.documentElement.lang === 'en';
const text = english ? {
  master: 'Master number', karmic: 'Karmic number', nameNumber: 'Your Expression number',
  heading: (n, title) => `Expression number ${n}: ${title}`, lettersSum: 'Sum of letters: ',
  soul: 'Soul Urge number', personality: 'Personality number',
  noVowels: 'There are no vowels in this spelling.', noConsonants: 'There are no consonants in this spelling.',
  steps: 'Step-by-step calculation', vowels: 'vowels', total: 'total', consonants: 'consonants',
  scrollLabel: letters => `Calculation for: ${letters}. The table can be scrolled horizontally.`,
  caption: word => `Letter values: ${word}`,
  legendMaster: ' — master numbers. ', legendKarmic: ' — karmic numbers. The notation 4/31 means: the number 4 comes from the sum 31. The letter Y counts as a consonant.',
  summary: [['Sum of vowels', 'soul'], ['Sum of consonants', 'personality'], ['Sum of all letters', 'all']],
  invalid: 'Please use letters of the Latin alphabet (a–z, accented letters are fine).', empty: 'Enter your full name to calculate your number.',
  harmonyEyebrow: 'Your energy is asking for harmony',
  harmonyTitle: kinds => `Your name contains ${kinds}.`,
  kinds: { master: 'a master number', karmic: 'a karmic number', both: 'master and karmic numbers' },
  harmonyText: found => `Found: ${found}. These are especially intense vibrations that can bring strong lessons and tension between different areas of life. I encourage you to harmonize your energy – a numerology name harmonization (or a harmonious pen name) can help it flow in one direction.`,
  harmonyLink: 'See name harmonization', harmonyHref: '/en/numerology-readings#name-harmonization',
  labels: { all: 'Expression', soul: 'Soul Urge', personality: 'Personality' },
} : {
  master: 'Liczba mistrzowska', karmic: 'Liczba karmiczna', nameNumber: 'Twoja liczba nazwy',
  heading: (n, title) => `Liczba nazwy ${n}: ${title}`, lettersSum: 'Suma liter: ',
  soul: 'Liczba duszy', personality: 'Liczba osobowości',
  noVowels: 'Brak samogłosek w tym zapisie.', noConsonants: 'Brak spółgłosek w tym zapisie.',
  steps: 'Obliczenia krok po kroku', vowels: 'samogłoski', total: 'razem', consonants: 'spółgłoski',
  scrollLabel: letters => `Obliczenia dla: ${letters}. Tabelę można przewijać w poziomie.`,
  caption: word => `Wartości liter: ${word}`,
  legendMaster: ' — liczby mistrzowskie. ', legendKarmic: ' — liczby karmiczne. Zapis 4/31 oznacza: liczba 4 powstała z sumy 31. Litera Y jest liczona jako spółgłoska.',
  summary: [['Suma samogłosek', 'soul'], ['Suma spółgłosek', 'personality'], ['Suma wszystkich liter', 'all']],
  invalid: 'Użyj liter alfabetu łacińskiego (a–z, także polskich znaków).', empty: 'Wpisz imię i nazwisko, aby obliczyć liczbę.',
  harmonyEyebrow: 'Twoja energia prosi o harmonię',
  harmonyTitle: kinds => `W Twoim imieniu i nazwisku pojawia się ${kinds}.`,
  kinds: { master: 'liczba mistrzowska', karmic: 'liczba karmiczna', both: 'liczba mistrzowska i karmiczna' },
  harmonyText: found => `Wynik: ${found}. To wibracje o szczególnie silnej energii, które mogą przynosić intensywne lekcje i napięcia między różnymi sferami życia. Zachęcam Cię do zharmonizowania swojej energii – harmonizacja imienia i nazwiska (lub harmonijny pseudonim) pomoże jej płynąć w jednym kierunku.`,
  harmonyLink: 'Zobacz harmonizację imion i nazwisk', harmonyHref: '/oferta#harmonizacja-imienia',
  labels: { all: 'liczba nazwy', soul: 'liczba duszy', personality: 'liczba osobowości' },
};
const meaningList = english ? meaningsEn : meanings;

const form = document.querySelector('#calculator-form');
const input = document.querySelector('#calc-name');
const error = document.querySelector('#calc-error');
const output = document.querySelector('#calc-result');

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function formattedNumber(value) {
  const span = element('span', 'formatted-number');
  if (!value || value < 10) { span.textContent = value ? String(value) : '–'; return span; }
  span.append(document.createTextNode(`${reduceNumber(value)}/`));
  const type = numberType(value);
  const sum = element('span', type ? `number-${type}` : '', value);
  if (type) sum.title = type === 'master' ? text.master : text.karmic;
  span.append(sum);
  return span;
}
function miniResult(title, value, empty) {
  const box = element('div', 'result-mini');
  box.append(element('p', 'eyebrow', title));
  const number = element('p', 'mini-number');
  number.append(formattedNumber(value));
  box.append(number, element('p', '', value ? meaningList[reduceNumber(value)][1] : empty));
  return box;
}
// Invitation to name harmonization when a master or karmic number appears in the main totals.
function harmonyNote(result) {
  const found = ['all', 'soul', 'personality']
    .map(key => ({ key, value: result[key], type: numberType(result[key]) }))
    .filter(item => item.type);
  if (!found.length) return null;
  const types = new Set(found.map(item => item.type));
  const kind = types.size > 1 ? 'both' : [...types][0];
  const box = element('aside', 'harmony-note');
  box.setAttribute('aria-label', text.harmonyEyebrow);
  box.append(
    element('p', 'eyebrow', text.harmonyEyebrow),
    element('h3', '', text.harmonyTitle(text.kinds[kind])),
    element('p', '', text.harmonyText(found.map(item => `${text.labels[item.key]} ${item.value}`).join(', '))),
  );
  const link = element('a', 'button button-primary', text.harmonyLink + ' ');
  link.href = text.harmonyHref;
  link.insertAdjacentHTML('beforeend', '<span class="icon-arrow" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg></span>');
  box.append(link);
  return box;
}
function render(result) {
  output.replaceChildren();
  const primary = reduceNumber(result.all);
  const intro = element('div', 'result-intro');
  intro.append(element('div', 'result-big', primary));
  const description = element('div');
  description.append(element('p', 'eyebrow', text.nameNumber), element('h3', '', text.heading(primary, meaningList[primary][0])), element('p', '', meaningList[primary][1]));
  const total = element('p', 'result-total', text.lettersSum);
  total.append(formattedNumber(result.all));
  description.append(total); intro.append(description); output.append(intro);
  const trio = element('div', 'result-grid');
  trio.append(miniResult(text.soul, result.soul, text.noVowels), miniResult(text.personality, result.personality, text.noConsonants));
  output.append(trio);
  const note = harmonyNote(result);
  if (note) output.append(note);
  output.append(element('h3', 'breakdown-title', text.steps));
  for (const word of result.rows) {
    const scroll = element('div', 'word-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', text.scrollLabel(word.letters.map(item => item.letter).join('')));
    const table = element('table', 'calculation-table');
    table.append(element('caption', 'sr-only', text.caption(word.word)));
    const tbody = element('tbody');
    for (const [kind, label, value] of [['vowels', text.vowels, word.vowelSum], ['letters', text.total, word.vowelSum + word.consonantSum], ['consonants', text.consonants, word.consonantSum]]) {
      const row = element('tr', `calculation-${kind}`);
      for (const item of word.letters) {
        row.append(element('td', item.isVowel ? 'is-vowel' : '', kind === 'letters' ? item.letter : (kind === 'vowels' ? item.isVowel : !item.isVowel) ? item.value : ''));
      }
      const sum = element('td', 'calculation-sum');
      sum.append(formattedNumber(value));
      row.append(sum, element('th', 'calculation-label', label));
      row.lastChild.scope = 'row';
      tbody.append(row);
    }
    table.append(tbody); scroll.append(table); output.append(scroll);
  }
  const legend = element('p', 'number-legend');
  legend.append(element('span', 'number-master', '11, 22, 33, 44, 55, 66, 77, 88, 99'), document.createTextNode(text.legendMaster), element('span', 'number-karmic', '13, 14, 16, 19, 26'), document.createTextNode(text.legendKarmic));
  output.append(legend);
  const summary = element('div', 'calculation-summary');
  for (const [label, key] of text.summary) {
    const line = element('p', '', `${label}: `); line.append(formattedNumber(result[key])); summary.append(line);
  }
  output.append(summary);
  output.hidden = false;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const result = computeName(input.value.slice(0, 120));
  if (!result) {
    error.textContent = input.value.trim() ? text.invalid : text.empty;
    input.setAttribute('aria-invalid', 'true'); output.replaceChildren(); output.hidden = true; input.focus(); return;
  }
  error.textContent = ''; input.removeAttribute('aria-invalid'); render(result);
});
form.addEventListener('reset', () => {
  error.textContent = ''; input.removeAttribute('aria-invalid'); output.replaceChildren(); output.hidden = true; input.focus();
});
input.addEventListener('input', () => {
  // A changed name must never be shown with the previous person's result.
  error.textContent = ''; input.removeAttribute('aria-invalid'); output.replaceChildren(); output.hidden = true;
});
