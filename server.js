require("dotenv").config();
const express = require('express')
const cors = require('cors')
const config = require('./knexfile.js')[process.env.NODE_ENV]
var knex = require('knex')(config);
const PORT = process.env.PORT


const app = express()

app.use(cors())

app.get("/most_edited", async (req, res)=>{
    const top = await knex.raw("select score.score, score.reference_time, article.title from score join article on score.article_id = article.id where mode = '4 week average' and reference_time = (select max(reference_time) from score) order by score limit 10")

    res.send(top.rows)

})

app.get("/trending", async (req, res)=>{
    const trend = await knex.raw("select score.score, score.reference_time, article.title from score join score s2 on score.article_id = s2.article_id join article on score.article_id = article.id where score.mode = '4 week trend ratio' and s2.mode = '4 week average' and s2.score < 84 * 3600 and score.score < 1 and score.reference_time = (select max(reference_time) from score) order by score.score")

    res.send(trend.rows)

})

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });