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
