const axios = require('axios').default
const config = require('./knexfile.js')['development']
var knex = require('knex')(config);
const prompt = require('prompt-sync')();

const {importRandom} = require('./getRevs')

const {getAllTimeScores, getYearlyScores, getTYM} = require('./analysis')

// getAllTimeScores()
getYearlyScores()


// getTYM()

// importRandom(50)


// randomRevs()