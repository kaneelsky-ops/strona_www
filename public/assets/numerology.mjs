// Rules and descriptions ported from kaneel-vercel.zip / Calculator.js.
const values = { a:1,j:1,s:1,b:2,k:2,t:2,c:3,l:3,u:3,d:4,m:4,v:4,e:5,n:5,w:5,f:6,o:6,x:6,g:7,p:7,y:7,h:8,q:8,z:8,i:9,r:9 };
const polish = { ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' };
const vowels = 'aeiou'; // Y is a consonant in the supplied system.
export const masterNumbers = [11,22,33,44,55,66,77,88,99];
export const karmicNumbers = [13,14,16,19,26];
export const meanings = {
  1: ['Przywódca', 'Samodzielność, inicjatywa i odwaga stawiania pierwszych kroków.'],
  2: ['Dyplomata', 'Wrażliwość, współpraca i dar słuchania innych.'],
  3: ['Twórca', 'Ekspresja, lekkość i potrzeba dzielenia się swoimi pomysłami.'],
  4: ['Budowniczy', 'Rzetelność, porządek i cierpliwe dążenie do celu.'],
  5: ['Odkrywca', 'Ciekawość świata, zmiana i potrzeba swobody.'],
  6: ['Opiekun', 'Troska, odpowiedzialność i dbanie o bliskich.'],
  7: ['Badacz', 'Refleksja, analiza i potrzeba zrozumienia głębszych spraw.'],
  8: ['Realizator', 'Siła sprawcza, ambicja i umiejętność zarządzania zasobami.'],
  9: ['Humanista', 'Empatia, wielkoduszność i patrzenie szerzej niż na siebie.'],
};
export const meaningsEn = {
  1: ['The Leader', 'Independence, initiative and the courage to take the first step.'],
  2: ['The Diplomat', 'Sensitivity, cooperation and the gift of listening to others.'],
  3: ['The Creator', 'Self-expression, lightness and the need to share your ideas.'],
  4: ['The Builder', 'Reliability, order and patient pursuit of your goals.'],
  5: ['The Explorer', 'Curiosity about the world, change and the need for freedom.'],
  6: ['The Nurturer', 'Care, responsibility and looking after your loved ones.'],
  7: ['The Seeker', 'Reflection, analysis and the need to understand deeper truths.'],
  8: ['The Achiever', 'Personal power, ambition and the ability to manage resources.'],
  9: ['The Humanitarian', 'Empathy, generosity and seeing beyond yourself.'],
};
export function normalizeName(value) {
  return value.toLowerCase().split('').map(char => polish[char] || char).join('')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function reduceNumber(value) {
  while (value > 9) value = [...String(value)].reduce((sum, digit) => sum + Number(digit), 0);
  return value;
}
export function numberType(value) {
  return masterNumbers.includes(value) ? 'master' : karmicNumbers.includes(value) ? 'karmic' : '';
}
export function computeName(raw) {
  const words = raw.trim().split(/\s+/).map(word => normalizeName(word).replace(/[^a-z]/g, '')).filter(Boolean);
  if (!words.length) return null;
  let all = 0, soul = 0, personality = 0;
  const rows = words.map(word => {
    let vowelSum = 0, consonantSum = 0;
    const letters = [...word].map(letter => {
      const value = values[letter], isVowel = vowels.includes(letter);
      if (isVowel) vowelSum += value; else consonantSum += value;
      return { letter: letter.toUpperCase(), value, isVowel };
    });
    soul += vowelSum; personality += consonantSum; all += vowelSum + consonantSum;
    return { word, letters, vowelSum, consonantSum };
  });
  return { rows, all, soul, personality };
}
