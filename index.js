require('dotenv').config();

const cron = require('node-cron');
const sendWeeklyReport = require('./commands/sendWeeklyReport');

cron.schedule('0 18 * * 2', sendWeeklyReport);

console.log('Cron jobs started');