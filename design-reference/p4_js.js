var ITR_THEMES = [
  { id: 'aurora', label: 'Aurora theme', c1: '#8b7bff', c2: '#3ef0c8' },
  { id: 'ember', label: 'Ember theme', c1: '#ff8a4c', c2: '#ffd166' },
  { id: 'glacier', label: 'Glacier theme', c1: '#4de8ff', c2: '#c6ff4d' }
];
var ITR_HOME_CARDS = [
  { k: 'LISTED EQUITY / LTCG', d: 'A sale on or after the one-year anniversary of purchase is long-term. Calendar months, not a 365-day count.' },
  { k: 'EQUITY MUTUAL FUND / STCG', d: 'Sold before the anniversary? Short-term. The same 12-month rule applies to equity-oriented funds.' },
  { k: 'MULTIPLE ACCOUNTS', d: 'Upload reports from every broker account. The return has no per-account rows, so gains are combined, with a breakdown kept for checking.' },
  { k: 'SOURCE TRACE', d: 'Each lot keeps its file, sheet and row, so every number in the workbook points back to its source.' },
  { k: 'WORKING PAPER', d: 'A nine-sheet Excel file: filing review, filing groups, field map, lots, issues and source rows.' },
  { k: 'ITR WALKTHROUGH', d: 'After you upload, every ITR-2 form gets its own card, with the exact values to fill from your reports.' }
];
var ITR_FORM_CARDS = [
  { k: 'SCHEDULE CG / A2 / STCG (111A)', d: 'Short-term gains on shares and equity funds, taxed at 20%. Click to see each field and your value.' },
  { k: 'SCHEDULE CG / A5 / OTHER STCG', d: 'Gold and silver funds, non-equity ETFs and other non-equity funds. Taxed at your slab rate.' },
  { k: 'SCHEDULE 112A / LTCG', d: 'Long-term gains on shares and equity funds, plus where the total lands in Schedule CG B3.' },
  { k: 'SCHEDULE CG / E / SET-OFF', d: 'How any loss left after each item nets off is set against your gains.' },
  { k: 'SCHEDULE CG / F / QUARTERS', d: 'Which quarter each gain arose in, from your sale dates.' },
  { k: 'EXCEL WORKING PAPER', d: 'Your separate record of everything. Download it to check, or give it to Claude with a question.' },
  { k: 'YOUR ACCOUNTS', d: 'Totals for each broker account, so you can check them against each broker.' },
  { k: 'YOUR LOTS', d: 'Every sale that went into the totals, with its account, date and gain.' }
];
var ITR_PRESETS = [
  { label: 'Exactly one year', buy: '2024-06-14', sell: '2025-06-14', kind: 'listed_equity' },
  { label: 'One day short', buy: '2024-06-14', sell: '2025-06-13', kind: 'listed_equity' },
  { label: 'Leap-day trap', buy: '2024-02-29', sell: '2025-02-28', kind: 'listed_equity' },
  { label: 'Bought before 2018', buy: '2017-11-20', sell: '2024-09-10', kind: 'listed_equity' },
  { label: 'Outside valid years', buy: '2022-05-02', sell: '2023-08-01', kind: 'equity_mf' },
  { label: 'Debt fund', buy: '2024-06-14', sell: '2025-08-01', kind: 'debt' }
];
var ITR_STEPS = ['01 Upload', '02 Review', '03 Fill the ITR'];
var ITR_BROKERS = { groww: 'Groww', zerodha: 'Zerodha', other: 'Other' };
var ITR_DEMO_FILES = [
  { name: 'groww-stocks-capital-gains-demo.xlsx', size: 48000 },
  { name: 'groww-mutual-funds-capital-gains-demo.xlsx', size: 31000 },
  { name: 'zerodha-tax-pnl-demo.xlsx', size: 56000 }
];
/* Demo lots in paise. The real app replaces this list with the engine's included lots. */
var ITR_DEMO_LOTS = [
  { asset: 'Demo stock A', acct: 'Groww', kind: 'eq', term: 'STCG', sold: '2025-05-20', p: 4825000, c: 4510000, e: 3250 },
  { asset: 'Demo stock B', acct: 'Zerodha', kind: 'eq', term: 'STCG', sold: '2025-11-02', p: 2140000, c: 2205000, e: 1820 },
  { asset: 'Demo stock C', acct: 'Groww', kind: 'eq', term: 'LTCG', sold: '2025-08-12', p: 11280000, c: 8640000, e: 5400 },
  { asset: 'Demo stock D', acct: 'Zerodha', kind: 'eq', term: 'LTCG', sold: '2026-01-20', p: 6430000, c: 5125000, e: 3080 },
  { asset: 'Demo equity fund', acct: 'Groww', kind: 'eq', term: 'LTCG', sold: '2025-08-30', p: 4000000, c: 3360000, e: 0 },
  { asset: 'Demo gold fund-of-funds', acct: 'Groww', kind: 'other', term: 'STCG', sold: '2025-12-10', p: 2500000, c: 2050000, e: 0 },
  { asset: 'Demo silver ETF', acct: 'Zerodha', kind: 'other', term: 'STCG', sold: '2026-02-05', p: 900000, c: 960000, e: 1200 }
];
var ITR_QUARTERS = ['up to 15 June', '16 June to 15 Sep', '16 Sep to 15 Dec', '16 Dec to 15 March', '16 March to 31 March'];
var ITR_SECTIONS = [null, null, 'upload', 'excel', 'lab', 'private'];
var ITR_MAX = 10, ITR_MAXSIZE = 2 * 1024 * 1024;
var ITR_DLG_ORDER = ['stcg', 'other', 'ltcg', 'setoff', 'tablef', 'excel', 'accounts', 'lots'];
var ITR_DLG_NAMES = { stcg: 'STCG (A2, 111A)', other: 'Other STCG (A5)', ltcg: 'LTCG (112A)', setoff: 'Set-off (E)', tablef: 'Quarter breakup (F)', excel: 'Excel working paper', accounts: 'Your accounts', lots: 'Your lots' };
function itrFmt(paise) { var neg = paise < 0, v = Math.abs(paise) / 100; return (neg ? '-' : '') + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function itrQuarter(iso) { var m = +iso.slice(5, 7), d = +iso.slice(8, 10), md = m * 100 + d; if (md >= 401 && md <= 615) return 0; if (md >= 616 && md <= 915) return 1; if (md >= 916 && md <= 1215) return 2; if (md >= 316 && md <= 331) return 4; return 3; }
function itrTotals(lots) {
  function z() { return { p: 0, c: 0, e: 0, g: 0, n: 0 }; }
  var T = { S: z(), L: z(), O: z(), acct: {}, q: { S: [0, 0, 0, 0, 0], L: [0, 0, 0, 0, 0], O: [0, 0, 0, 0, 0] }, order: [] };
  lots.forEach(function (l) {
    var k = l.kind === 'other' ? 'O' : (l.term === 'STCG' ? 'S' : 'L');
    var b = T[k], g = l.p - l.c - l.e;
    b.p += l.p; b.c += l.c; b.e += l.e; b.g += g; b.n++;
    if (!T.acct[l.acct]) { T.acct[l.acct] = { S: 0, L: 0, O: 0, n: 0 }; T.order.push(l.acct); }
    T.acct[l.acct][k] += g; T.acct[l.acct].n++;
    T.q[k][itrQuarter(l.sold)] += g;
  });
  return T;
}
function itrForms(T) {
  var S = T.S, L = T.L, O = T.O, F = itrFmt;
  var Q = ['(i) upto 15/6', '(ii) 16/6 to 15/9', '(iii) 16/9 to 15/12', '(iv) 16/12 to 15/3', '(v) 16/3 to 31/3'];
  function qf(row, label, v, i) {
    var act = v > 0 ? 'FILL' : v < 0 ? 'CHECK' : 'SKIP';
    return [row + Q[i].split(' ')[0], label + ' ' + Q[i].slice(Q[i].indexOf(' ') + 1), act, v === 0 ? '' : F(v),
      act === 'FILL' ? 'Gain from your sales in this quarter' : act === 'CHECK' ? 'A net loss in this quarter; set it off before entering' : 'No sales in this quarter'];
  }
  function row(num, text, f, ind, dim, nobox) { return { t: 'row', num: num, text: text, f: f, ind: ind || '', dim: !!dim, nobox: !!nobox }; }
  var HEAD = 'FORM ITR-2 / AY 2026-27';
  var tf = [];
  T.q.S.forEach(function (v, i) { tf.push(qf('1', 'STCG taxable at 20%', v, i)); });
  tf.push(['2', 'STCG taxable at 30%', 'SKIP', '', 'Not used for listed shares, funds or ETFs']);
  T.q.O.forEach(function (v, i) { tf.push(qf('3', 'STCG at applicable rates', v, i)); });
  tf.push(['4', 'STCG taxable at DTAA rates', 'SKIP', '', 'Not used for residents']);
  T.q.L.forEach(function (v, i) { tf.push(qf('5', 'LTCG taxable at 12.5%', v, i)); });
  tf.push(['6', 'LTCG taxable at DTAA rates', 'SKIP', '', 'Not used for residents']);
  tf.push(['7', 'Virtual Digital Assets at 30%', 'SKIP', '', 'Not applicable']);
  var gainCol = function (v) { return v > 0 ? F(v) : '0.00'; };
  var lossTotal = [S.g, O.g, L.g].filter(function (v) { return v < 0; }).reduce(function (a, v) { return a - v; }, 0);
  var aHead = { t: 'h', text: 'A(I). Short-term Capital Gains (sub-items 3 and 4 are not applicable for residents)' };
  var bHead = { t: 'h', text: 'B(I). Long-term capital gain (LTCG) (sub-items 4, 5, 6 and 7 are not applicable for residents)' };
  return {
    stcg: {
      kicker: 'SCHEDULE CG / A(I) ITEM 2 / SECTION 111A', title: 'Short-term gains on shares: ₹' + F(S.g),
      sub: 'Listed shares and equity funds with STT paid, held 12 months or less. Taxed at 20%. One entry for all your accounts combined.',
      formTitle: 'Schedule CG, item A2',
      fields: [
        ['2a', 'Full value of consideration', 'FILL', F(S.p), 'Total sale value of all short-term equity lots, every account combined'],
        ['2b(i)', 'Cost of acquisition without indexation', 'FILL', F(S.c), 'Total purchase cost of those lots'],
        ['2b(ii)', 'Cost of Improvement without indexation', 'SKIP', '', 'Not applicable to shares or fund units'],
        ['2b(iii)', 'Expenditure wholly and exclusively in connection with transfer', 'FILL', F(S.e), 'Verified brokerage and charges. STT is not deductible'],
        ['2b(iv)', 'Total (i + ii + iii)', 'AUTO', F(S.c + S.e), 'The portal adds this up; check it matches'],
        ['2c', 'Balance (2a - biv)', 'AUTO', F(S.g), 'Should match your net short-term equity gain'],
        ['2d', 'Loss to be disallowed u/s 94(7) or 94(8)', 'CHECK', 'Usually blank', 'Only for dividend or bonus stripping; the Excel leaves it unknown'],
        ['2e', 'Short-term capital gain on equity share or equity oriented MF (STT paid) (2c + 2d)', 'AUTO', F(S.g), 'Carried into A9 and the set-off table E']
      ],
      pages: [
        { left: HEAD, right: 'Schedule Capital Gains / page 1', items: [
          { t: 'title', text: 'Schedule Capital Gains' },
          aHead,
          row('1', 'From sale of land or building or both', -1, '', true, true),
          row('2', 'From sale of equity share or unit of equity oriented Mutual Fund (MF) or unit of a business trust on which STT is paid under section 111A or 115AD(1)(ii) proviso (for FII)', -1, '', false, true),
          row('a', 'Full value of consideration', 0, 'ind1'),
          row('b', 'Deductions under section 48', -1, 'ind1', false, true),
          row('i', 'Cost of acquisition without indexation', 1, 'ind2'),
          row('ii', 'Cost of Improvement without indexation', 2, 'ind2'),
          row('iii', 'Expenditure wholly and exclusively in connection with transfer', 3, 'ind2'),
          row('iv', 'Total (i + ii + iii)', 4, 'ind2'),
          row('c', 'Balance (2a - biv)', 5, 'ind1'),
          row('d', 'Loss to be disallowed u/s 94(7) or 94(8)', 6, 'ind1'),
          row('e', 'Short-term capital gain on equity share or equity oriented MF (STT paid) (2c + 2d)', 7, 'ind1'),
          row('3, 4', 'For non-residents only', -1, '', true, true),
          row('5', 'From sale of assets other than at A1 or A2 or A3 or A4 above (see the Other STCG card)', -1, '', true, true),
          row('6 - 9', 'Deemed STCG, pass-through income, DTAA items, Total STCG (A9)', -1, '', true, true)
        ] },
        { left: HEAD, right: 'Schedule Capital Gains / page 2', items: [
          bHead,
          { t: 'note', text: 'Item 3 receives your Schedule 112A total automatically. See the LTCG card.' },
          { t: 'h', text: 'C1. Sum of Capital Gain Incomes / C2. Virtual Digital Assets / C3. Income chargeable under the head Capital Gains' },
          { t: 'note', text: 'Calculated by the portal from table E.' },
          { t: 'h', text: 'D. Information about deduction claimed against Capital Gains' },
          { t: 'note', text: 'Only for sections 54 / 54B / 54EC / 54F / 115F, such as reinvesting in a house. Usually skipped for share trading.' },
          { t: 'h', text: 'E. Set-off of current year capital losses with current year capital gains' },
          { t: 'note', text: 'See the Set-off card.' },
          { t: 'h', text: 'F. Information about accrual/receipt of capital gain' },
          { t: 'note', text: 'See the Quarter breakup card.' }
        ] }
      ],
      footer: 'Gold or silver funds, debt funds and non-equity ETFs do not go here. They go in item A5 (Other STCG card).'
    },
    other: {
      kicker: 'SCHEDULE CG / A(I) ITEM 5 / SLAB RATE', title: 'Other short-term gains: ₹' + F(O.g),
      sub: 'Gold and silver fund-of-funds, non-equity ETFs and other non-equity funds held for a short period. Taxed at your slab rate, not 20%. Confirm the treatment with your adviser.',
      formTitle: 'Schedule CG, item A5',
      fields: [
        ['5a(i)', 'Full value of consideration in respect of unquoted shares (ia, ib, ic)', 'SKIP', '', 'Only for unquoted shares'],
        ['5a(ii)', 'Full value of consideration in respect of assets other than unquoted shares', 'FILL', F(O.p), 'Total sale value of these non-equity lots, every account combined'],
        ['5a(iii)', 'Total (ic + ii)', 'AUTO', F(O.p), 'The portal adds this up'],
        ['5b(i)', 'Cost of acquisition without indexation', 'FILL', F(O.c), 'Total purchase cost of those lots'],
        ['5b(ii)', 'Cost of Improvement without indexation', 'SKIP', '', 'Not applicable to fund units'],
        ['5b(iii)', 'Expenditure wholly and exclusively in connection with transfer', 'FILL', F(O.e), 'Verified brokerage and charges'],
        ['5b(iv)', 'Total (i + ii + iii)', 'AUTO', F(O.c + O.e), 'The portal adds this up; check it matches'],
        ['5c', 'Balance (5aiii - biv)', 'AUTO', F(O.g), 'Gains and losses inside this item net off here'],
        ['5d', 'Loss to be disallowed u/s 94(7) or 94(8)', 'CHECK', 'Usually blank', 'Only for dividend or bonus stripping'],
        ['5e', 'Short-term capital gain on assets at A5 above (5c + 5d)', 'AUTO', F(O.g), 'Taxed at your slab rate']
      ],
      pages: [
        { left: HEAD, right: 'Schedule Capital Gains / page 1', items: [
          { t: 'title', text: 'Schedule Capital Gains' },
          aHead,
          row('1 - 4', 'Land or building, equity under 111A (STCG card), non-resident items', -1, '', true, true),
          row('5', 'From sale of assets other than at A1 or A2 or A3 or A4 above', -1, '', false, true),
          row('a', 'Full value of consideration', -1, 'ind1', false, true),
          row('i', 'In case assets sold include unquoted shares (ia, ib, ic)', 0, 'ind2'),
          row('ii', 'Full value of consideration in respect of assets other than unquoted shares', 1, 'ind2'),
          row('iii', 'Total (ic + ii)', 2, 'ind2'),
          row('b', 'Deductions under section 48', -1, 'ind1', false, true),
          row('i', 'Cost of acquisition without indexation', 3, 'ind2'),
          row('ii', 'Cost of Improvement without indexation', 4, 'ind2'),
          row('iii', 'Expenditure wholly and exclusively in connection with transfer', 5, 'ind2'),
          row('iv', 'Total (i + ii + iii)', 6, 'ind2'),
          row('c', 'Balance (5aiii - biv)', 7, 'ind1'),
          row('d', 'Loss to be disallowed u/s 94(7) or 94(8)', 8, 'ind1'),
          row('e', 'STCG on assets at A5 above (5c + 5d)', 9, 'ind1')
        ] }
      ],
      footer: 'Your app currently leaves these lots out of its totals. They still have to be reported here.'
    },
    ltcg: {
      kicker: 'SCHEDULE 112A AND SCHEDULE CG B(I) ITEM 3', title: 'Long-term gains on shares: ₹' + F(L.g),
      sub: 'Listed shares and equity funds with STT paid, held over 12 months. One consolidated row covers every post-January-2018 buy from all your accounts.',
      formTitle: 'Schedule 112A',
      fields: [
        ['1a', 'Share/Unit acquired (on or before / after 31st Jan 2018)', 'FILL', 'After 31st Jan 2018', 'Earlier buys need their own scrip-wise rows'],
        ['1b', 'Share/Unit transferred (before / on or after 23rd July 2024)', 'CHECK', 'On or after 23 July 2024', 'On the notified form; dropped in the later schema. Pick this only if the portal asks'],
        ['2', 'ISIN Code', 'FILL', 'INNOTREQUIRD', 'Code for one consolidated row of post-January-2018 buys'],
        ['3', 'Name of the Share/Unit', 'FILL', 'CONSOLIDATED', 'Name for the consolidated row'],
        ['4', 'No. of Shares/Units', 'SKIP', '', 'Left blank for a consolidated row'],
        ['5', 'Sale price per Share/Unit', 'SKIP', '', 'Left blank for a consolidated row'],
        ['6', 'Full Value of Consideration', 'FILL', F(L.p), 'Total sale value of all long-term equity lots, every account combined'],
        ['7', 'Cost of acquisition without indexation', 'AUTO', F(L.c), 'Higher of 8 and 9; equals 8 for post-January-2018 buys'],
        ['8', 'Cost of acquisition', 'FILL', F(L.c), 'Total purchase cost'],
        ['9', 'If acquired before 01.02.2018, lower of 11 and 6', 'SKIP', '', 'Only for pre-February-2018 buys'],
        ['10', 'Fair Market Value per share/unit as on 31st January 2018', 'SKIP', '', 'Left blank for a consolidated row'],
        ['11', 'Total Fair Market Value of capital asset as per section 55(2)(ac)', 'SKIP', '', 'Only for pre-February-2018 buys'],
        ['12', 'Expenditure wholly and exclusively in connection with transfer', 'FILL', F(L.e), 'Verified brokerage and charges. STT is not deductible'],
        ['13', 'Total deductions (7 + 12)', 'AUTO', F(L.c + L.e), 'The portal adds this up; check it matches'],
        ['14', 'Balance (6 - 13)', 'AUTO', F(L.g), 'Flows into Schedule CG B(I) item 3'],
        ['B3a', 'LTCG u/s 112A (column 14 of Schedule 112A)', 'AUTO', F(L.g), 'Copied in from Schedule 112A'],
        ['B3b', 'Deduction under section 54F', 'SKIP', '', 'Only if you reinvested in a house'],
        ['B3c', 'Long-term capital gains on sale of capital assets at B3 above (3a - 3b)', 'AUTO', F(L.g), 'The ₹1.25 lakh exemption is applied in the tax computation, not here']
      ],
      pages: [
        { left: HEAD, right: 'Schedule 112A / page 1', items: [
          { t: 'title', text: 'Schedule 112A' },
          { t: 'note', text: 'From sale of equity share in a company or unit of equity oriented fund or unit of a business trust on which STT is paid. One row per entry, columns shown top to bottom.' },
          { t: 'h', text: 'Row 1' },
          row('1a', 'Share/Unit acquired (on or before / after 31st Jan 2018)', 0),
          row('1b', 'Share/Unit transferred (before / on or after 23rd July 2024)', 1),
          row('2', 'ISIN Code', 2), row('3', 'Name of the Share/Unit', 3), row('4', 'No. of Shares/Units', 4),
          row('5', 'Sale price per Share/Unit', 5), row('6', 'Full Value of Consideration', 6),
          row('7', 'Cost of acquisition without indexation (higher of 8 and 9)', 7)
        ] },
        { left: HEAD, right: 'Schedule 112A / page 2', items: [
          { t: 'h', text: 'Row 1 (continued)' },
          row('8', 'Cost of acquisition', 8),
          row('9', 'If the long-term capital asset was acquired before 01.02.2018, lower of 11 and 6', 9),
          row('10', 'Fair Market Value per share/unit as on 31st January 2018', 10),
          row('11', 'Total Fair Market Value of capital asset as per section 55(2)(ac)', 11),
          row('12', 'Expenditure wholly and exclusively in connection with transfer', 12),
          row('13', 'Total deductions (7 + 12)', 13), row('14', 'Balance (6 - 13)', 14)
        ] },
        { left: HEAD, right: 'Schedule Capital Gains / B(I)', items: [
          bHead,
          row('1, 2', 'Land or building; listed securities other than units u/s 112(1)', -1, '', true, true),
          row('3', 'From sale of equity share in a company or unit of equity oriented fund or unit of a business trust on which STT is paid under section 112A', -1, '', false, true),
          row('a', 'LTCG u/s 112A (column 14 of Schedule 112A)', 15, 'ind1'),
          row('b', 'Deduction under section 54F', 16, 'ind1'),
          row('c', 'Long-term capital gains on sale of capital assets at B3 above (3a - 3b)', 17, 'ind1'),
          row('4 - 12', 'Non-resident items, other assets, deemed LTCG, pass-through, DTAA, Total LTCG (B12)', -1, '', true, true)
        ] }
      ],
      footer: 'Bought before 1 Feb 2018? Each such holding needs its own row. The app blocks those lots for review.'
    },
    setoff: {
      kicker: 'SCHEDULE CG / E', title: 'Set-off of losses (table E)',
      sub: 'Losses left after each item nets off are set against gains here. The portal fills most of this from A and B; you mainly check it.',
      formTitle: 'Schedule CG, item E',
      fields: [
        ['i', 'Capital loss to be set off', lossTotal ? 'CHECK' : 'AUTO', F(lossTotal), lossTotal ? 'A net loss in one item; the portal sets it off against gains below' : 'No net loss in any item, so nothing to set off'],
        ['ii', 'Gains taxable at 20% (STCG on shares, A2e)', 'AUTO', gainCol(S.g), 'Column 2: capital gain of current year'],
        ['iii', 'Gains taxable at 30%', 'SKIP', '', 'Not used for listed shares, funds or ETFs'],
        ['iv', 'Gains taxable at applicable rate (A5e)', 'AUTO', gainCol(O.g), 'Column 2: your slab-rate short-term gain'],
        ['v', 'Gains taxable at DTAA rates', 'SKIP', '', 'Not used for residents'],
        ['vi', 'Gains taxable at 12.50% (LTCG on shares, B3c)', 'AUTO', gainCol(L.g), 'Column 2: long-term gain on shares'],
        ['vii', 'Gains at DTAA rates', 'SKIP', '', 'Not used for residents'],
        ['viii', 'Total loss set off (ii + iii + iv + v + vi + vii)', 'AUTO', F(lossTotal), 'Calculated by the portal'],
        ['ix', 'Loss remaining after set off (i - viii)', 'AUTO', '0.00', 'Carried forward only if positive']
      ],
      pages: [
        { left: HEAD, right: 'Schedule Capital Gains / E', items: [
          { t: 'title', text: 'E. Set-off of current year capital losses with current year capital gains' },
          { t: 'note', text: 'Columns: 1 Type of capital gain, 2 Capital gain of current year, 3 to 6 Short-term capital loss at 20% / 30% / applicable rate / DTAA rates, 7 Long-term capital loss at 12.50% and DTAA rates, 8 Current year capital gains remaining after set off.' },
          row('i', 'Capital loss to be set off', 0),
          row('ii', '20%', 1), row('iii', '30%', 2), row('iv', 'Applicable rate', 3), row('v', 'DTAA rates', 4),
          row('vi', '12.50%', 5), row('vii', 'DTAA rates', 6),
          row('viii', 'Total loss set off (ii + iii + iv + v + vi + vii)', 7),
          row('ix', 'Loss remaining after set off (i - viii)', 8)
        ] }
      ],
      footer: 'Short-term losses can be set against short- or long-term gains; long-term losses only against long-term gains. The portal applies this.'
    },
    tablef: {
      kicker: 'SCHEDULE CG / F', title: 'Quarter breakup (table F)',
      sub: 'Which quarter each gain arose in, by sale date. Shares short-term go in row 1 (20%), other short-term in row 3 (applicable rates), shares long-term in row 5 (12.5%).',
      formTitle: 'Schedule CG, item F',
      fields: tf,
      pages: [
        { left: HEAD, right: 'Schedule Capital Gains / F', items: [
          { t: 'title', text: 'F. Information about accrual/receipt of capital gain' },
          { t: 'grid' },
          { t: 'note', text: 'Raw gains by sale date from your lots. If you have losses to set off, adjust first; the app does not compute final Table F figures.' }
        ] }
      ],
      footer: 'Raw gains by sale date. If you have losses to set off, adjust first; the app does not compute final Table F figures.'
    }
  };
}
var ITR_GRID = [
  { label: '1  Short-term capital gains taxable at the rate of 20%', fs: [0, 1, 2, 3, 4] },
  { label: '2  Short-term capital gains taxable at the rate of 30%', fs: [5, 5, 5, 5, 5] },
  { label: '3  Short-term capital gains taxable at applicable rates', fs: [6, 7, 8, 9, 10] },
  { label: '4  Short-term capital gains taxable at DTAA rates', fs: [11, 11, 11, 11, 11] },
  { label: '5  Long-term capital gains taxable at the rate of 12.5%', fs: [12, 13, 14, 15, 16] },
  { label: '6  Long-term capital gains taxable at DTAA rates', fs: [17, 17, 17, 17, 17] },
  { label: '7  Capital gains on transfer of Virtual Digital Asset taxable at 30%', fs: [18, 18, 18, 18, 18] }
];
function itrSync(fi, k) {
  setTimeout(function () {
    try {
      var box = document.querySelector('.dlg .paperbox');
      var el = box && box.querySelector('[data-f="' + fi + '"]');
      if (box && el) {
        var br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
        box.scrollTo({ top: Math.max(0, er.top - br.top + box.scrollTop - box.clientHeight * 0.32), left: Math.max(0, er.left - br.left + box.scrollLeft - 60), behavior: 'smooth' });
      }
      var lb = document.querySelector('.dlg .listbox'), li = document.getElementById('gl-' + k);
      if (lb && li) {
        var lr = lb.getBoundingClientRect(), ir = li.getBoundingClientRect();
        lb.scrollTo({ top: Math.max(0, ir.top - lr.top + lb.scrollTop - lb.clientHeight * 0.32), behavior: 'smooth' });
      }
    } catch (e) {}
  }, 70);
}
function itrSize(n) { return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (Math.round(n / 104857.6) / 10) + ' MB'; }
function itrGuess(name) {
  var n = name.toLowerCase();
  if (/zerodha|kite|console/.test(n)) return 'zerodha';
  if (/groww/.test(n)) return 'groww';
  if (/\.csv$/.test(n)) return 'other';
  return 'groww';
}
var ITR_TOTALS = itrTotals(ITR_DEMO_LOTS);
var ITR_FORMS = itrForms(ITR_TOTALS);
var ITR_INFO = {
  excel: { kicker: 'YOUR RECORD', title: 'Excel working paper', sub: 'Kept separate from the forms. Use it to check any number, or hand it to Claude with a question.' },
  accounts: { kicker: 'BY ACCOUNT', title: 'Your accounts', sub: 'Totals for each broker account. The ITR has no per-account rows, so only the combined row goes in.' },
  lots: { kicker: 'EVERY SALE', title: 'Your lots', sub: 'Every sale included in the totals, from all accounts.' }
};

class Component extends DCLogic {
  constructor() {
    super(...arguments);
    this.state = {
      theme: 'aurora', view: 'home', angle: 0, dragging: false, hover: false, paused: false, tiltX: -8, tiltY: 0,
      buy: '2024-06-14', sell: '2025-06-14', kind: 'listed_equity', flip: false,
      step: 0, flow: false, fy: '2025-26', files: [], hot: false, dl: false,
      dlg: null, dStep: 0, dPlay: true, onlyFill: false, mode: 'form', shots: {}
    };
    this.drag = null; this.moved = false; this.fid = 0;
  }
  componentDidMount() {
    var self = this;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { this.reduced = true; this.setState({ paused: true, dPlay: false }); }
    } catch (e) {}
    this.timer = setInterval(function () {
      var s = self.state;
      if (!s.dlg && !s.paused && !s.dragging && !s.hover) { var st = self.step(); self.setState({ angle: Math.round(s.angle / st) * st - st }); }
    }, 3600);
    this.dTimer = setInterval(function () {
      var s = self.state;
      if (!s.dlg || !ITR_FORMS[s.dlg] || !s.dPlay) return;
      var n = self.visible().length;
      if (s.dStep < n - 1) { self.setState({ dStep: s.dStep + 1 }); self.sync(s.dStep + 1); }
      else self.setState({ dPlay: false });
    }, 2100);
  }
  componentWillUnmount() { clearInterval(this.timer); clearInterval(this.dTimer); }
  focusLater(sel) { setTimeout(function () { try { var el = document.querySelector(sel); if (el) el.focus({ preventScroll: true }); } catch (e) {} }, 80); }
  n() { return this.state.view === 'forms' ? 8 : 6; }
  step() { return 360 / this.n(); }
  idx() { var n = this.n(); return ((Math.round(-this.state.angle / this.step()) % n) + n) % n; }
  go(i) { var n = this.n(), st = this.step(), cur = this.idx(); var d = i - cur; if (d > n / 2) d -= n; if (d < -n / 2) d += n; this.setState({ angle: Math.round(this.state.angle / st) * st - d * st }); }
  visible() {
    var F = ITR_FORMS[this.state.dlg] || ITR_FORMS.stcg, only = this.state.onlyFill;
    var v = F.fields.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return !only || o.x[2] === 'FILL' || o.x[2] === 'CHECK'; });
    return v.length ? v : F.fields.map(function (x, i) { return { x: x, i: i }; });
  }
  sync(k) { var v = this.visible(); var kk = Math.max(0, Math.min(k, v.length - 1)); if (v[kk]) itrSync(v[kk].i, kk); }
  openDlg(kind) { this.setState({ dlg: kind, dStep: 0, dPlay: !this.reduced, mode: 'form', dl: false }); this.focusLater('#dlg-close'); var self = this; setTimeout(function () { self.sync(0); }, 120); }
  closeDlg() { this.setState({ dlg: null }); this.focusLater('.stage'); }
  card(i) {
    if (this.moved) { this.moved = false; return; }
    if (this.idx() !== i) { this.go(i); return; }
    if (this.state.view === 'forms') this.openDlg(ITR_DLG_ORDER[i]);
  }
  setView(v) { this.setState({ view: v, angle: 0, dlg: null }); try { window.scrollTo(0, 0); } catch (e) {} }
  setInputs(patch) { patch.flip = !this.state.flip; this.setState(patch); }
  addFiles(list) {
    var files = this.state.files.slice();
    var okCount = files.filter(function (f) { return f.ok; }).length;
    for (var i = 0; i < list.length; i++) {
      var f = list[i], name = String(f.name || 'file'), ext = (name.split('.').pop() || '').toLowerCase();
      var why = '';
      if (ext === 'pdf') why = 'PDF reports are not accepted. Download the .xlsx version.';
      else if (ext === 'xls') why = 'Old .xls is not accepted. Save it as .xlsx first.';
      else if (ext !== 'xlsx' && ext !== 'csv') why = 'Only .xlsx or .csv files.';
      else if (f.size > ITR_MAXSIZE) why = 'Over the 2 MB limit.';
      else if (/p&l|pnl|p_l|profit/.test(name.toLowerCase()) && !/tax/.test(name.toLowerCase())) why = 'Looks like a P&L statement. Use the capital-gains report instead.';
      else if (files.some(function (x) { return x.ok && x.name === name; })) why = 'Already added.';
      else if (okCount >= ITR_MAX) why = 'The limit is 10 files.';
      var broker = itrGuess(name);
      if (!why) okCount++;
      this.fid++;
      files.push({ id: this.fid, name: name, size: f.size || 0, ok: !why, why: why, broker: broker, nick: ITR_BROKERS[broker] });
    }
    this.setState({ files: files, hot: false, dl: false });
  }
  updateFile(id, patch) {
    this.setState({ files: this.state.files.map(function (f) { return f.id === id ? Object.assign({}, f, patch) : f; }) });
  }
  renderVals() {
    var self = this, s = this.state, idx = this.idx(), N = this.n(), T = ITR_TOTALS;
    var r = itrClassify(s.buy, s.sell, s.kind);
    var okFiles = s.files.filter(function (f) { return f.ok; });
    var accounts = Object.keys(okFiles.reduce(function (a, f) { a[(f.nick || '').trim().toLowerCase() || f.broker] = 1; return a; }, {})).length;
    var isForm = !!ITR_FORMS[s.dlg];
    var D = ITR_FORMS[s.dlg] || ITR_INFO[s.dlg] || ITR_FORMS.stcg;
    var FD = ITR_FORMS[s.dlg] || ITR_FORMS.stcg;
    var vis = this.visible();
    var ds = Math.min(s.dStep, vis.length - 1);
    var active = vis[ds].i;
    var shot = s.shots[s.dlg];
    var cards = s.view === 'forms' ? ITR_FORM_CARDS : ITR_HOME_CARDS;
    var fyLabel = s.fy === '2025-26' ? 'FY 2025-26' : 'FY 2024-25';
    var nextKind = ITR_DLG_ORDER[(ITR_DLG_ORDER.indexOf(s.dlg) + 1) % ITR_DLG_ORDER.length];
    var out = {
      themeCls: 't-' + s.theme,
      themes: ITR_THEMES.map(function (t) { var on = t.id === s.theme; return { label: t.label, c1: t.c1, c2: t.c2, cls: on ? 'on' : '', pick: function () { self.setState({ theme: t.id }); }, pressed: on ? 'true' : 'false' }; }),
      isHome: s.view === 'home', isForms: s.view === 'forms',
      goHome: function () { if (self.state.view !== 'home') self.setView('home'); else { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} } },
      goHomeView: function () { self.setView('home'); },
      stageCls: s.dragging ? 'dragging' : '',
      tiltX: s.tiltX, tiltY: s.tiltY, angle: s.angle, negAngle: -s.angle,
      ringTr: s.dragging ? 'none' : 'transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)',
      cardKicker: cards[idx].k, cardDesc: cards[idx].d,
      paused: s.paused, playing: !s.paused,
      pauseLabel: s.paused ? 'Resume rotation' : 'Pause rotation',
      dots: cards.map(function (c, i) { return { label: 'Show card ' + (i + 1) + ': ' + c.k, cls: i === idx ? 'on' : '', pressed: i === idx ? 'true' : 'false', pick: function () { self.go(i); } }; }),
      prev: function () { self.go((idx + N - 1) % N); },
      next: function () { self.go((idx + 1) % N); },
      togglePause: function () { self.setState({ paused: !s.paused }); },
      down: function (e) { self.drag = { x: e.clientX, a: self.state.angle, captured: false, id: e.pointerId }; self.moved = false; },
      move: function (e) {
        var rc = e.currentTarget.getBoundingClientRect();
        var nx = (e.clientX - rc.left) / rc.width - 0.5, ny = (e.clientY - rc.top) / rc.height - 0.5;
        var patch = { tiltY: Math.round(nx * 160) / 10, tiltX: Math.round((-8 - ny * 12) * 10) / 10 };
        if (self.drag) {
          var dx = e.clientX - self.drag.x;
          if (!self.drag.captured && Math.abs(dx) > 6) {
            self.drag.captured = true; self.moved = true; patch.dragging = true;
            try { e.currentTarget.setPointerCapture(self.drag.id); } catch (err) {}
          }
          if (self.drag.captured) patch.angle = self.drag.a + dx * 0.35;
        }
        self.setState(patch);
      },
      up: function () {
        if (!self.drag) return;
        var was = self.drag.captured;
        self.drag = null;
        if (was) { var st = self.step(); self.setState({ dragging: false, angle: Math.round(self.state.angle / st) * st }); }
      },
      enter: function () { self.setState({ hover: true }); },
      leave: function () { if (!self.drag) self.setState({ hover: false, tiltX: -8, tiltY: 0 }); },
      key: function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); self.go((idx + 1) % N); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); self.go((idx + N - 1) % N); }
        else if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && self.state.view === 'forms') { e.preventDefault(); self.moved = false; self.card(idx); }
      },
      c0: function () { self.card(0); }, c1: function () { self.card(1); }, c2: function () { self.card(2); },
      c3: function () { self.card(3); }, c4: function () { self.card(4); }, c5: function () { self.card(5); },
      c6: function () { self.card(6); }, c7: function () { self.card(7); },
      tot: { stcg: itrFmt(T.S.g), ltcg: itrFmt(T.L.g), other: itrFmt(T.O.g), lotCount: String(T.S.n + T.L.n + T.O.n) },
      fy: s.fy, setFy: function (e) { self.setState({ fy: e.target.value }); },
      fyLabel: fyLabel, fyAy: s.fy === '2025-26' ? 'AY 2026-27' : 'AY 2025-26',
      dropCls: s.hot ? 'hot' : '',
      pick: function (e) { var fl = e.target.files; if (fl && fl.length) self.addFiles(Array.prototype.slice.call(fl)); try { e.target.value = ''; } catch (err) {} },
      dragOver: function (e) { e.preventDefault(); if (!self.state.hot) self.setState({ hot: true }); },
      dragLeave: function () { self.setState({ hot: false }); },
      drop: function (e) { e.preventDefault(); var fl = e.dataTransfer && e.dataTransfer.files; if (fl && fl.length) self.addFiles(Array.prototype.slice.call(fl)); else self.setState({ hot: false }); },
      addDemo: function () { self.addFiles(ITR_DEMO_FILES.filter(function (d) { return !self.state.files.some(function (f) { return f.name === d.name; }); })); },
      hasFiles: s.files.length > 0,
      fileRows: s.files.map(function (f) {
        var note = f.ok ? itrSize(f.size) + ' / ready' : f.why;
        var noteCls = f.ok ? 'st-mut' : 'st-bad';
        if (f.ok && f.broker === 'zerodha') { note = itrSize(f.size) + ' / needs a Zerodha reader in the app'; noteCls = 'st-warn'; }
        if (f.ok && f.broker === 'other') { note = itrSize(f.size) + ' / must follow the app CSV template'; }
        return {
          name: f.name, ok: f.ok, note: note, noteCls: noteCls, rowCls: f.ok ? '' : 'bad',
          broker: f.broker, nick: f.nick,
          brokerLabel: 'Broker for ' + f.name, nickLabel: 'Account name for ' + f.name, removeLabel: 'Remove ' + f.name,
          setBroker: function (e) { var b = e.target.value; self.updateFile(f.id, { broker: b, nick: f.nick === ITR_BROKERS[f.broker] ? ITR_BROKERS[b] : f.nick }); },
          setNick: function (e) { self.updateFile(f.id, { nick: e.target.value }); },
          remove: function () { self.setState({ files: self.state.files.filter(function (x) { return x.id !== f.id; }) }); }
        };
      }),
      uploadSummary: okFiles.length === 0 ? 'No files yet. Add your reports, or try the demo files.' :
        okFiles.length + (okFiles.length === 1 ? ' file' : ' files') + ' from ' + accounts + (accounts === 1 ? ' account, ' : ' accounts, ') + fyLabel,
      reviewDisabled: okFiles.length === 0,
      reviewLabel: okFiles.length ? 'Review ' + okFiles.length + (okFiles.length === 1 ? ' file' : ' files') : 'Review',
      review: function () { if (okFiles.length) self.setView('forms'); },
      okFiles: okFiles.map(function (f) { return { label: f.name + ' / ' + (f.nick || ITR_BROKERS[f.broker]) }; }),
      excelFrom: okFiles.length + (okFiles.length === 1 ? ' file from ' : ' files from ') + accounts + (accounts === 1 ? ' account' : ' accounts') + ', ' + fyLabel,
      download: function () { self.setState({ dl: true }); },
      dlMsg: s.dl ? 'Prototype: no file here. The real app builds this workbook from your reports.' : '',
      dlgOpen: !!s.dlg,
      isFormDlg: isForm, isExcelDlg: s.dlg === 'excel', isAcctDlg: s.dlg === 'accounts', isLotsDlg: s.dlg === 'lots',
      D: D,
      closeDlg: function () { self.closeDlg(); },
      stop: function (e) { e.stopPropagation(); },
      dlgKey: function (e) { if (e.key === 'Escape') { e.preventDefault(); self.closeDlg(); } },
      nextDlg: function () { self.openDlg(nextKind); },
      nextDlgLabel: 'Next: ' + ITR_DLG_NAMES[nextKind],
      modeForm: s.mode === 'form', modeShot: s.mode === 'shot',
      segForm: s.mode === 'form' ? 'on' : '', segShot: s.mode === 'shot' ? 'on' : '',
      segFormP: s.mode === 'form' ? 'true' : 'false', segShotP: s.mode === 'shot' ? 'true' : 'false',
      showForm: function () { self.setState({ mode: 'form' }); setTimeout(function () { self.sync(ds); }, 60); },
      showShot: function () { self.setState({ mode: 'shot' }); },
      segAll: s.onlyFill ? '' : 'on', segFill: s.onlyFill ? 'on' : '',
      segAllP: s.onlyFill ? 'false' : 'true', segFillP: s.onlyFill ? 'true' : 'false',
      showAll: function () { self.setState({ onlyFill: false, dStep: 0, dPlay: !self.reduced }); setTimeout(function () { self.sync(0); }, 30); },
      showFill: function () { self.setState({ onlyFill: true, dStep: 0, dPlay: !self.reduced }); setTimeout(function () { self.sync(0); }, 30); },
      hasShot: !!(shot && shot.length), noShot: !(shot && shot.length),
      shotList: (shot || []).map(function (u, i) { return { url: u, alt: 'Your portal screenshot ' + (i + 1) + ' of ' + FD.formTitle }; }),
      userScroll: function () { if (self.state.dPlay) self.setState({ dPlay: false }); },
      pickShot: function (e) {
        var fl = e.target.files; if (!fl || !fl.length) return;
        var urls = []; try { for (var i = 0; i < fl.length; i++) urls.push(URL.createObjectURL(fl[i])); } catch (err) {}
        if (urls.length) { var sh = Object.assign({}, self.state.shots); sh[s.dlg] = (sh[s.dlg] || []).concat(urls); self.setState({ shots: sh }); }
      },
      clearShot: function () { var sh = Object.assign({}, self.state.shots); delete sh[s.dlg]; self.setState({ shots: sh }); },
      pages: FD.pages.map(function (pg) {
        return { left: pg.left, right: pg.right, items: pg.items.map(function (it) {
          var on = it.t === 'row' && it.f === active;
          return {
            isTitle: it.t === 'title', isH: it.t === 'h', isNote: it.t === 'note', isRow: it.t === 'row', isGrid: it.t === 'grid',
            text: it.text || '', num: it.num || '', f: String(it.f === undefined ? -1 : it.f), ind: it.ind || '',
            cls: (it.dim ? 'dim ' : '') + (on ? 'hl' : ''), boxCls: it.nobox ? 'nobox' : (it.t === 'row' && FD.fields[it.f] && FD.fields[it.f][2] === 'SKIP' ? 'skipbox' : '')
          };
        }) };
      }),
      gridRows: ITR_GRID.map(function (g) {
        return { label: g.label, cls: g.fs.indexOf(active) >= 0 && s.dlg === 'tablef' ? 'rowon' : '', cells: g.fs.map(function (f) { var fld = ITR_FORMS.tablef.fields[f]; return { f: String(f), cls: (f === active && s.dlg === 'tablef' ? 'hl ' : '') + (fld && fld[2] === 'SKIP' ? 'skipbox' : '') }; }) };
      }),
      formAria: 'Recreated ' + FD.formTitle + ' form, current field ' + vis[ds].x[0] + ': ' + vis[ds].x[1],
      guideRows: vis.map(function (o, k) {
        var a = o.x[2];
        return {
          letter: o.x[0], label: o.x[1], act: a, note: o.x[4], id: 'gl-' + k,
          tagText: a === 'FILL' ? 'FILL' : a === 'SKIP' ? 'SKIP' : a === 'AUTO' ? 'AUTO' : 'CHECK',
          mine: a === 'SKIP' ? '—' : (o.x[3] || '—'),
          valCls: a === 'FILL' ? 'st-ok' : a === 'CHECK' ? 'st-warn' : 'st-mut',
          cls: (k === ds ? 'on' : '') + (a === 'SKIP' ? ' dim' : ''),
          current: k === ds ? 'step' : 'false',
          pick: function () { self.setState({ dStep: k, dPlay: false }); self.sync(k); }
        };
      }),
      dCount: 'Field ' + (ds + 1) + ' of ' + vis.length,
      dProg: Math.round((ds + 1) / vis.length * 100),
      dPaused: !s.dPlay, dPlaying: s.dPlay,
      dPlayLabel: s.dPlay ? 'Pause walkthrough' : 'Play walkthrough',
      dToggle: function () { if (!s.dPlay && ds >= vis.length - 1) { self.setState({ dStep: 0, dPlay: true }); self.sync(0); } else self.setState({ dPlay: !s.dPlay }); },
      dPrev: function () { var k = Math.max(0, ds - 1); self.setState({ dStep: k, dPlay: false }); self.sync(k); },
      dNext: function () { var k = Math.min(vis.length - 1, ds + 1); self.setState({ dStep: k, dPlay: false }); self.sync(k); },
      acctRows: T.order.map(function (n) { var a = T.acct[n]; return { name: n, stcg: itrFmt(a.S), ltcg: itrFmt(a.L), other: itrFmt(a.O), lots: String(a.n), sCls: a.S < 0 ? 'st-bad' : '', lCls: a.L < 0 ? 'st-bad' : '', oCls: a.O < 0 ? 'st-bad' : '' }; }),
      lotRows: ITR_DEMO_LOTS.map(function (l) { var g = l.p - l.c - l.e; return { asset: l.asset, acct: l.acct, sold: l.sold, term: l.kind === 'other' ? 'OTHER' : l.term, termCls: l.kind === 'other' ? 'st-warn' : 'term-' + l.term, p: itrFmt(l.p), c: itrFmt(l.c), g: itrFmt(g), gCls: g < 0 ? 'st-bad' : '' }; }),
      buy: s.buy, sell: s.sell, kind: s.kind,
      setBuy: function (e) { self.setInputs({ buy: e.target.value }); },
      setSell: function (e) { self.setInputs({ sell: e.target.value }); },
      setKind: function (e) { self.setInputs({ kind: e.target.value }); },
      presets: ITR_PRESETS.map(function (p) { var on = p.buy === s.buy && p.sell === s.sell && p.kind === s.kind; return { label: p.label, cls: on ? 'on' : '', pressed: on ? 'true' : 'false', pick: function () { self.setInputs({ buy: p.buy, sell: p.sell, kind: p.kind }); } }; }),
      r: r, flipCls: s.flip ? 'fa' : 'fb',
      steps: ITR_STEPS.map(function (t, i) { var on = i === s.step; return { tab: t, cls: on ? 'on' : '', pressed: on ? 'true' : 'false', pick: function () { self.setState({ step: i }); } }; }),
      nextStep: function () { self.setState({ step: (s.step + 1) % 3 }); },
      nextStepLabel: s.step === 2 ? 'Back to step 1' : 'Next step',
      toggleFlow: function () { self.setState({ flow: !s.flow }); },
      showFlow: s.flow, flowOn: s.flow ? 'true' : 'false', flowCls: s.flow ? 'on' : '',
      flowMsg: s.flow ? 'Your files stay on this device, start to finish.' : 'Flip it to trace the path your files take.'
    };
    for (var i = 0; i < 8; i++) out['on' + i] = i === idx ? 'on' : '';
    for (var j = 0; j < 3; j++) {
      var d = j - s.step;
      if (d === 0) { out['t' + j] = 'translateY(0px) translateZ(0px) rotateX(0deg)'; out['o' + j] = '1'; out['z' + j] = '3'; out['p' + j] = 'auto'; out['h' + j] = 'false'; }
      else if (d > 0) { out['t' + j] = 'translateY(' + (d * 24) + 'px) translateZ(' + (-d * 110) + 'px) rotateX(-8deg)'; out['o' + j] = String(1 - d * 0.35); out['z' + j] = String(3 - d); out['p' + j] = 'none'; out['h' + j] = 'true'; }
      else { out['t' + j] = 'translateY(-60px) translateZ(80px) rotateX(70deg)'; out['o' + j] = '0'; out['z' + j] = '4'; out['p' + j] = 'none'; out['h' + j] = 'true'; }
    }
    return out;
  }
}
</script>
