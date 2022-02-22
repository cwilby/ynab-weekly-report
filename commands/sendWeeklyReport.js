const _ = require('lodash'); // can't escape the awesome
const ynab = require("ynab");
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const MJML = require('mjml');
const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
const utc = require('dayjs/plugin/utc');
dayjs.extend(isBetween);
dayjs.extend(utc);

const sum = (key) => (total, obj) => total + obj[key];
const formatMoney = (cents) => '$' + (cents / 1000).toFixed(2);

async function sendWeeklyReport() {
  try {
    console.log('Sending weekly report');

    const ynabAPI = new ynab.API(process.env.YNAB_ACCESS_TOKEN);

    const lastWeek = {
        start: dayjs().day(0).add(-7, 'days'),
        end: dayjs().day(0).endOf('week').add(-7, 'days')
    };
    const twoWeeksAgo = {
        start: dayjs().day(0).add(-14, 'days'),
        end: dayjs().day(0).endOf('week').add(-14, 'days')
    };
    const threeWeeksAgo = {
        start: dayjs().day(0).add(-21, 'days'),
        end: dayjs().day(0).endOf('week').add(-21, 'days')
    };
    const fourWeeksAgo = {
        start: dayjs().day(0).add(-28, 'days'),
        end: dayjs().day(0).endOf('week').add(-28, 'days')
    };
    const thisMonth = {
        start: dayjs().startOf('month'),
        end: dayjs()
    };
    const lastMonth = {
        start: dayjs().startOf('month').add(-1, 'month'),
        end: dayjs().startOf('month').add(-1, 'month').endOf('month')
    };

    const categoryGroups = await getCategoryGroups(ynabAPI);
    const transactions = await getTransactions(ynabAPI, lastMonth.start.format('MM/DD/YYYY'));

    let mjml = '';
    mjml += '<mjml>';
    mjml += '    <mj-body>';
    mjml += '        <mj-section>';
    mjml += '            <mj-column>';
    mjml += '                <mj-text font-size="24px" align="center">Weekly Spending Report</mj-text>';
    mjml += '                <mj-divider></mj-divider>';

    for (const categoryGroup of categoryGroups.filter(cg => !cg.hidden && !['Credit Card Goals', 'Internal Master Category', 'Hidden Categories'].includes(cg.name))) {
        const categoryIds = categoryGroup.categories.filter(c => !c.hidden).map(cg => cg.id);
        
        const budgeted = categoryGroup.categories.reduce(sum('budgeted'), 0);
        
        const transactionsLast2Months = transactions.filter(t => categoryIds.includes(t.category_id) || t.category_id === 'f5cca4f0-a403-4992-834e-73acdebd3865');
        
        const lastWeekAmount = sumCategoryTransactions(transactionsLast2Months, categoryIds, lastWeek);
        const twoWeeksAgoAmount = sumCategoryTransactions(transactionsLast2Months, categoryIds, twoWeeksAgo);
        const threeWeeksAgoAmount = sumCategoryTransactions(transactionsLast2Months, categoryIds, threeWeeksAgo);
        const fourWeeksAgoAmount = sumCategoryTransactions(transactionsLast2Months, categoryIds, fourWeeksAgo);
        const thisMonthAmount = sumCategoryTransactions(transactionsLast2Months, categoryIds, thisMonth);
        const lastMonthAmount = sumCategoryTransactions(transactionsLast2Months, categoryIds, lastMonth);

        const transactionsThisMonth = transactionsLast2Months.filter(t => dayjs(t.date).isBetween(thisMonth.start, thisMonth.end));

        const [largestPurchase] = _.orderBy(transactionsThisMonth, ['amount'], ['asc']);
        const [spentMostAt] = _.orderBy(
            Object.entries(
                _.groupBy(transactionsThisMonth, (t) => t.payee_name))
                    .map(([payee_name, transactions]) => ({
                        payee_name,
                        transactions,
                        total: sumCategoryTransactions(transactions, categoryIds, thisMonth)
                    })),
                    ['total'], 
                    ['asc']
        );

        mjml += `        <mj-text font-size="16px" font-weight="bold" align="center" text-decoration="underline">${categoryGroup.name}</mj-text>`;
        mjml += `        <mj-table>`;
        mjml += `          <tr>`;
        mjml += `            <td style="text-align: center" width="20%">`;
        mjml += `              <strong>4 Weeks Ago</strong><br />`;
        mjml += `              <span>${formatMoney(fourWeeksAgoAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="20%">`;
        mjml += `              <strong>3 Weeks Ago</strong><br />`;
        mjml += `              <span>${formatMoney(threeWeeksAgoAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="20%">`;
        mjml += `              <strong>2 Weeks Ago</strong><br />`;
        mjml += `              <span>${formatMoney(twoWeeksAgoAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="20%">`;
        mjml += `              <strong>Last Week</strong><br />`;
        mjml += `              <span>${formatMoney(lastWeekAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="20%">`;
        mjml += `              <strong>Difference</strong><br />`;
        mjml += `              <span style="color: ${lastWeekAmount < twoWeeksAgoAmount ? 'red' : 'green'}">${formatMoney(lastWeekAmount - twoWeeksAgoAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `          </tr>`;
        mjml += `        </mj-table>`;
        mjml += `        <mj-table>`;
        mjml += `          <tr>`;
        mjml += `            <td style="text-align: center" width="33%">`;
        mjml += `              <strong>Last Month</strong><br />`;
        mjml += `              <span>${formatMoney(lastMonthAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="33%">`;
        mjml += `              <strong>This Month</strong><br />`;
        mjml += `              <span>${formatMoney(thisMonthAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="33%">`;
        mjml += `              <strong>Difference</strong><br />`;
        mjml += `              <span style="color: ${thisMonthAmount < lastMonthAmount ? 'red' : 'green'}">${formatMoney(thisMonthAmount - lastMonthAmount)}</span>`;
        mjml += `            </td>`;
        mjml += `          </tr>`;
        mjml += `        </mj-table>`;
        mjml += `        <mj-table>`;
        mjml += `          <tr>`;
        mjml += `            <td style="text-align: center" width="33%">`;
        mjml += `              <strong>Budgeted</strong><br />`;
        mjml += `              <span>${formatMoney(budgeted)}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="33%">`;
        mjml += `              <strong>Largest Purchase</strong><br />`;
        mjml += `              <span>${formatMoney(largestPurchase.amount)} @ ${largestPurchase.payee_name}</span>`;
        mjml += `            </td>`;
        mjml += `            <td style="text-align: center" width="33%">`;
        mjml += `              <strong>Spent Most At</strong><br />`;
        mjml += `              <span>${formatMoney(spentMostAt.total)} @ ${spentMostAt.payee_name}</span>`;
        mjml += `            </td>`;
        mjml += `          </tr>`;
        mjml += `        </mj-table>`;
    }
    mjml += '        </mj-column>';
    mjml += '        </mj-section>';
    mjml += '    </mj-body>';
    mjml += '</mjml>';

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }        
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: process.env.EMAIL_RECIPIENTS,
        subject: 'YNAB Weekly Report',
        html: MJML(mjml).html
    });

    console.log(`Sent weekly report at ${dayjs().format()}`);
  } catch (e) {
    console.error(e);
  }
}

async function getTransactions(ynabAPI, sinceDate) {
    const { data: { transactions } } = await ynabAPI.transactions.getTransactions(process.env.YNAB_BUDGET_ID, sinceDate);

    return transactions;
}

async function getCategoryGroups(ynabAPI, sinceDate) {
    const { data: { category_groups: categoryGroups } } = await ynabAPI.categories.getCategories(process.env.YNAB_BUDGET_ID);

    return categoryGroups;
}

function sumCategoryTransactions(transactions, categoryIds, { start, end }) {
    return transactions
        .filter(t => dayjs(t.date).isBetween(start, end))
        .reduce((total, transaction) => {            
            if (transaction.subtransactions.length) {
                total += transaction.subtransactions.filter(t => categoryIds.includes(t.category_id)).reduce(sum('amount'), 0);
            } else {
                total += transaction.amount;
            }

            return total;
        }, 0);
}

module.exports = sendWeeklyReport;
