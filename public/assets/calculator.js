import { computeName, reduceNumber, meanings, numberType } from './numerology.mjs';

const form = document.querySelector('#calculator-form');
const input = document.querySelector('#calc-name');
const error = document.querySelector('#calc-error');
const output = document.querySelector('#calc-result');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function formattedNumber(value) {
  const span = element('span', 'formatted-number');
  if (!value || value < 10) { span.textContent = value ? String(value) : '–'; return span; }
  span.append(document.createTextNode(`${reduceNumber(value)}/`));
  const type = numberType(value);
  const sum = element('span', type ? `number-${type}` : '', value);
  if (type) sum.title = type === 'master' ? 'Liczba mistrzowska' : 'Liczba karmiczna';
  span.append(sum);
  return span;
}
function miniResult(title, value, empty) {
  const box = element('div', 'result-mini');
  box.append(element('p', 'eyebrow', title));
  const number = element('p', 'mini-number');
  number.append(formattedNumber(value));
  box.append(number, element('p', '', value ? meanings[reduceNumber(value)][1] : empty));
  return box;
}
function render(result) {
  output.replaceChildren();
  const primary = reduceNumber(result.all);
  const intro = element('div', 'result-intro');
  intro.append(element('div', 'result-big', primary));
  const description = element('div');
  description.append(element('p', 'eyebrow', 'Twoja liczba nazwy'), element('h3', '', `Liczba nazwy ${primary}: ${meanings[primary][0]}`), element('p', '', meanings[primary][1]));
  const total = element('p', 'result-total', 'Suma liter: ');
  total.append(formattedNumber(result.all));
  description.append(total); intro.append(description); output.append(intro);
  const trio = element('div', 'result-grid');
  trio.append(miniResult('Liczba duszy', result.soul, 'Brak samogłosek w tym zapisie.'), miniResult('Liczba osobowości', result.personality, 'Brak spółgłosek w tym zapisie.'));
  output.append(trio, element('h3', 'breakdown-title', 'Obliczenia krok po kroku'));
  for (const word of result.rows) {
    const scroll = element('div', 'word-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', `Obliczenia dla: ${word.letters.map(item => item.letter).join('')}. Tabelę można przewijać w poziomie.`);
    const table = element('table', 'calculation-table');
    table.append(element('caption', 'sr-only', `Wartości liter: ${word.word}`));
    const tbody = element('tbody');
    for (const [kind, label, value] of [['vowels', 'samogłoski', word.vowelSum], ['letters', 'razem', word.vowelSum + word.consonantSum], ['consonants', 'spółgłoski', word.consonantSum]]) {
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
  legend.append(element('span', 'number-master', '11, 22, 33, 44, 55, 66, 77, 88, 99'), document.createTextNode(' — liczby mistrzowskie. '), element('span', 'number-karmic', '13, 14, 16, 19, 26'), document.createTextNode(' — liczby karmiczne. Zapis 4/31 oznacza: liczba 4 powstała z sumy 31. Litera Y jest liczona jako spółgłoska.'));
  output.append(legend);
  const summary = element('div', 'calculation-summary');
  for (const [label, value] of [['Suma samogłosek', result.soul], ['Suma spółgłosek', result.personality], ['Suma wszystkich liter', result.all]]) {
    const line = element('p', '', `${label}: `); line.append(formattedNumber(value)); summary.append(line);
  }
  output.append(summary);
  output.hidden = false;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const result = computeName(input.value.slice(0, 120));
  if (!result) {
    error.textContent = input.value.trim() ? 'Użyj liter alfabetu łacińskiego (a–z, także polskich znaków).' : 'Wpisz imię i nazwisko, aby obliczyć liczbę.';
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
