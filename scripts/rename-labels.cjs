/**
 * User-facing label renames — phrase-level only (does not touch ROI_SLOT, roiAPI, etc.).
 */
const fs = require('fs');
const path = require('path');

const TARGET_DIRS = [
  path.join(__dirname, '..', 'src', 'pages'),
  path.join(__dirname, '..', 'src', 'components'),
  path.join(__dirname, '..', 'src', 'utils'),
  path.join(__dirname, '..', 'src', 'api', 'index.js'),
];

const RULES = [
  ['Trading Income', 'Live Trading Income'],
  ['trading income', 'live trading income'],
  ['Day Trade Winnings', 'Live Trade Winnings'],
  ['Day Trades', 'Live Trades'],
  ['Day Trade', 'Live Trade'],
  ['day trades', 'live trades'],
  ['day trade', 'live trade'],
  ['ROI Income', 'Trade Income'],
  ['ROI income', 'Trade income'],
  ['ROI Trade', 'Trade Income'],
  ['ROI History', 'Trade History'],
  ['ROI Reports', 'Trade Reports'],
  ['ROI Participation', 'Trade Participation'],
  ['ROI Session', 'Trade Session'],
  ['Daily ROI', 'Daily Trade'],
  ['ROI paid', 'Trade paid'],
  ['ROI received', 'Trade received'],
  ['ROI earned', 'Trade earned'],
  ['ROI join', 'Trade join'],
  ['ROI trading', 'Trade trading'],
  ['ROI closed', 'Trade closed'],
  ['no ROI', 'no trade income'],
  ['Plan TOP-UP (ROI)', 'Plan TOP-UP (Trade)'],
  ['ROI ladder', 'Trade ladder'],
  ['ROI %', 'Trade %'],
  ['full daily ROI', 'full daily trade income'],
  ['daily ROI', 'daily trade income'],
  ['cycle ROI', 'cycle trade income'],
  ['open ROI', 'open trade'],
  ['Join ROI', 'Join trade'],
  ['join ROI', 'join trade'],
  ['ROI sessions', 'trade sessions'],
  ['ROI session', 'trade session'],
  ['2× ROI', '2× Trade'],
  ['ROI window', 'Trade window'],
  ['ROI on', 'Trade on'],
  ['ROI +', 'Trade +'],
  ['+ ROI', '+ Trade'],
  ['ROI per', 'Trade per'],
  ['full ROI', 'full trade income'],
  ['ROI:', 'Trade:'],
  ['ROI ·', 'Trade ·'],
  ['ROI —', 'Trade —'],
  ['ROI (', 'Trade ('],
  ['ROI)', 'Trade)'],
  ['ROI,', 'Trade,'],
  ['ROI.', 'Trade.'],
  ['ROI?', 'Trade?'],
  ['ROI!', 'Trade!'],
  [' ROI ', ' Trade '],
  ['"ROI', '"Trade'],
  ["'ROI", "'Trade"],
  ['>ROI<', '>Trade<'],
  ['ROI<', 'Trade<'],
  ['ROI>', 'Trade>'],
  ['ROI/', 'Trade/'],
];

function processFile(p) {
  let text = fs.readFileSync(p, 'utf8');
  const original = text;
  for (const [from, to] of RULES) {
    text = text.split(from).join(to);
  }
  if (text !== original) {
    fs.writeFileSync(p, text);
    console.log('updated', p);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  if (fs.statSync(dir).isFile()) {
    if (/\.(jsx|js)$/.test(dir)) processFile(dir);
    return;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    walk(path.join(dir, ent.name));
  }
}

for (const t of TARGET_DIRS) walk(t);
console.log('done');
