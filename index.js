require('dotenv').config();

const cron = require('node-cron');
const sendWeeklyReport = require('./commands/sendWeeklyReport');

cron.schedule('0 10 * * 1', sendWeeklyReport);

console.log('Cron jobs started');