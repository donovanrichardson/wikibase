require("dotenv").config();
const config = require('./knexfile.js')[process.env.NODE_ENV]
var knex = require('knex')(config);
const {upsert} = require('./utils')

function sum(a){
    return a.reduce((total, item)=>{
        return total + item
    },0)
}

function mygmean(arr){
    // console.log(arr);
    return sum(arr.map(el=>Math.pow(el,2)))/sum(arr)
}

async function refExists(referenceTime, mode){
    const theRef = await knex('score').select().where({reference_time:referenceTime,mode:mode}).first()
    return !!theRef
}

async function allTimeAverage(articleIds, ref){
    // need to add reference diff
    const mode = "all time average"
    const alreadyExists = await refExists(ref, mode)
    if(alreadyExists){
        console.log('score already exists');
        return alreadyExists
    } else{
        for (let i = 0; i < articleIds.length; i++){ //i should take account of the fact that some may go beyond reference time by stipulating before reference time
            // console.log(`the rep is ${i}`);
            let ts = await knex('revision').select('timestamp', 'diff').where({article_id:articleIds[i]}).where("timestamp", "<", ref).orderBy('timestamp', 'desc')//previously this filtered out null, but that was wrong. now the last member is popped after potentially being used, just lik in the above median function.
            const newdiff = ts[0] ? (Number(ref)-Number(ts[0].timestamp)):Number(ref)//to handle the situation where there is only one revision and none without null diff //Number still has the BigInt problem
            // console.log(ref, ts[0].timestamp, Number(ref)-Number(ts[0].timestamp));
            // console.log(newdiff);
            ts.unshift({diff:newdiff})
            ts.pop()//the aforementioned popping
            const diffs = ts.map(t=>t.diff)
            console.log(diffs);
            const dsquared = diffs.map(d=>Math.pow(d,2))
            const ata = sum(dsquared)/sum(diffs)
            console.log(ata);
            await knex('score').insert({article_id:articleIds[i],score:ata,reference_time:ref, mode:mode}).returning('*')
        }
    }
    
}

async function yearlyAverage(articleIds, ref){
    console.log("whats happning");
    // need to add reference diff
    const mode = "yearly average"
    const alreadyExists = await refExists(ref, mode)
    if(alreadyExists){
        console.log(alreadyExists)
        // console.log(alreadyExists.toQuery())
    } else{
        const start = ref - (60*60*24*365)
        const forInsertion = []
        let rejected = 0
        let accepted = 0
        for (let i = 0; i < articleIds.length; i++){
            console.log(`accepted:${accepted}\nrejected:${rejected}\nremaining:${articleIds.length- accepted -rejected}`);
        
            const oldest = await knex('revision').select('timestamp', 'diff').where({article_id:articleIds[i]}).where('timestamp', '<', start).orderBy('timestamp', 'desc').first()
            if(! oldest){
                rejected ++
                continue;
            }
            accepted ++
            const latest = await knex('revision').select('timestamp', 'diff').where({article_id:articleIds[i]}).where('timestamp', '<', ref).orderBy('timestamp', 'desc').first()
            const refrecord = {timestamp:ref, diff:ref-latest.timestamp}
            const revisions = await knex('revision').select('timestamp', 'diff').where({article_id:articleIds[i]}).where('timestamp', '<', ref).where('timestamp','>=',start ).orderBy('timestamp', 'desc')
            revisions.unshift(refrecord)
            // const wholeDiff = revisions[revisions.length -1].diff
            // const forwardDiff = Number(revisions[revisions.length -1].timestamp) - start
            // revisions[revisions.length - 1].diff = forwardDiff
            // const revisionDiffs = revisions.map(p=>p.diff)
            // const denom = sum(revisionDiffs)
            // revisionDiffs.pop()
            // let numerator = sum(revisionDiffs.map(p=>p*p))
            // const leftovers = (2*wholeDiff * forwardDiff) - (forwardDiff * forwardDiff)
            // numerator += leftovers;
            const theScore = choppedScore(revisions, start)
            forInsertion.push({article_id:articleIds[i],score:theScore,reference_time:ref, mode:mode})
        }
        console.log(await knex('score').insert(forInsertion).returning('*')) //or this can be done in one insert
    }
}

function choppedScore(revisions, start){
    const wholeDiff = revisions[revisions.length -1].diff
    const forwardDiff = Number(revisions[revisions.length -1].timestamp) - start
    revisions[revisions.length - 1].diff = forwardDiff
    const revisionDiffs = revisions.map(p=>p.diff)
    const denom = sum(revisionDiffs)
    revisionDiffs.pop()
    let numerator = sum(revisionDiffs.map(p=>p*p))
    const leftovers = (2*wholeDiff * forwardDiff) - (forwardDiff * forwardDiff)
    numerator += leftovers;
    return numerator/denom
}

async function twoYearMedian(articleIds, ref){  //articleIds needed for callback to work correctly
    // const artid = 64104713
    // const artid = 52231773
    const mid = ref - (60*60*24*365)
    const start = ref - (60*60*24*730)
    const mode = "twoyearmedian"

    const eligibleRows = await knex('revision').distinct('article_id').where("timestamp", "<", start)

    for(let row = 0; row < eligibleRows.length; row++){
        const artid = eligibleRows[row].article_id
        const latest = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', ref).orderBy('timestamp', 'desc').first()
        const refrecord1 = {timestamp:ref, diff:ref-latest.timestamp}
        const revisions1 = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', ref).where('timestamp','>=',mid ).orderBy('timestamp', 'desc')
        revisions1.unshift(refrecord1)
        // const wholeDiff1 = revisions1[revisions1.length -1].timestamp
        // const forwardDiff1 = wholeDiff1 - mid
        // revisions1[revisions1.length - 1].diff = forwardDiff1
        // const revisionDiffs1 = revisions1.map(p=>p.diff)
        // const denom1 = sum(revisionDiffs1)
        // revisionDiffs1.pop()
        const bignumer = choppedScore(revisions1, mid)

    
        const median = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', mid).orderBy('timestamp', 'desc').first()
        const refrecord2 = {timestamp:mid, diff:mid-median.timestamp}
        const revisions2 = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', mid).where('timestamp','>=',start ).orderBy('timestamp', 'desc')
        revisions2.unshift(refrecord2)
        // const wholeDiff2 = revisions2[revisions2.length -1].timestamp
        // const forwardDiff2 = wholeDiff2 - start
        // revisions2[revisions2.length - 1].diff = forwardDiff2
        // const revisionDiffs2 = revisions2.map(p=>p.diff)
        // const denom2 = sum(revisionDiffs2)
        // revisionDiffs2.pop()
        // const numerator2 = sum(revisionDiffs2.map(p=>p*p))
        //get the plain sum of the revision diffs
        // pop the last from revisions
        //get the sum of squares of revisions
        // const lastCumulative = (wholeDiff * forwardDiff) - (forwardDiff * forwardDiff)
        // const forwardRecord = {timestamp:start, diff:forwardDiff}
        // revisions.push(forwardRecord)
        
        // console.log(revisions.slice(revisions.length-2), lastCumulative);
        // console.log(revisions1.filter(p=>p.diff>10000));
        // console.log((numerator1/denom1)/(60*60),(numerator1/denom1));
        // console.log(revisions2.filter(p=>p.diff>10000));
        // console.log((numerator2/denom2)/(60*60),(numerator2/denom2));
        // console.log((numerator1/denom1)/(numerator2/denom2));
        const bigdenom = choppedScore(revisions2, start)
        const thescore =  bignumer/bigdenom
        console.log(`${artid}: ${thescore}`);
        // if (thescore < .1){
        //     // console.log(numerator1,denom1);
        // }
        // console.log(
            await knex('score').insert({article_id:artid,score:thescore,reference_time:ref, mode:mode}).returning('*')
            // );

    }
}

async function getScores(callback){
    let ref = await knex('reference').select('time').orderBy('time', 'desc').first()//handle when domain no exist
    const thequery = knex('score').leftJoin('article',{'article.id':'score.article_id'}).select().where({reference_time:ref.time}).orderBy('score') //wont work if there;s nothing in the table
    console.log(thequery.toQuery());
    const existsScore = await thequery;
    // if(existsScore.length > 0){  //duplicates are handled in the callbacks
    //     console.log(existsScore);
    // }else{
        let articles = await knex('article').select('id')
        // console.log(articles);
        articles = articles.map(a=>a.id)

        await callback(articles, ref.time)
        
        // for (i = 0; i < articles.length; i++){
        //     let ts = await knex('revision').select('timestamp', 'diff').where({article_id:articles[i]}).orderBy('timestamp', 'desc')
        //     if(ts.length > 1){
        //         ts.pop() //because one has a diff of null
        //         const newdiff = (Number(ref.time)-Number(ts[0].timestamp))//omg i had ts[0].diff instead of .timestamp fml
        //         console.log(newdiff);
        //         ts.unshift({diff:newdiff})
        //         console.log(ts);
        //         ts = ts.map(stamp => stamp.diff)
        //         const ratio = intervals(ts)
        //         await knex('score').insert({article_id:articles[i],score:ratio,reference_time:ref.time,domain_id:domain, desc:desc})
        //     }
        // }
        // console.log(await thequery); 
    // } //duplicates are handled in the callbacks
    // knex.destroy()
}

async function getAllTimeScores(){
    await getScores(allTimeAverage)
}

function xWeeklyAvgPeriod(weeks){
    return async (articleIds, ref) =>{

    console.log("whats happning");
    // need to add reference diff
    const mode = `${weeks} week average`
    const alreadyExists = await refExists(ref, mode)
    if(alreadyExists){
        console.log(alreadyExists)
        console.log(alreadyExists.toQuery())
    } else{
        const start = ref - (60*60*24*7 * weeks)
        const forInsertion = []
        let rejected = 0
        let accepted = 0
        for (let i = 0; i < articleIds.length; i++){
            console.log(`accepted:${accepted}\nrejected:${rejected}\nremaining:${articleIds.length- accepted -rejected}`);
        
            const oldest = await knex('revision').select('timestamp', 'diff').where({article_id:articleIds[i]}).where('timestamp', '<', start).orderBy('timestamp', 'desc').first()
            if(! oldest){
                rejected ++
                continue;
            }
            accepted ++
            const latest = await knex('revision').select('timestamp', 'diff').where({article_id:articleIds[i]}).where('timestamp', '<', ref).orderBy('timestamp', 'desc').first()
            const refrecord = {timestamp:ref, diff:ref-latest.timestamp}
            const revisions = await knex('revision').select('timestamp', 'diff').where({article_id:articleIds[i]}).where('timestamp', '<', ref).where('timestamp','>=',start ).orderBy('timestamp', 'desc')
            revisions.unshift(refrecord)
            // const wholeDiff = revisions[revisions.length -1].diff
            // const forwardDiff = Number(revisions[revisions.length -1].timestamp) - start
            // revisions[revisions.length - 1].diff = forwardDiff
            // const revisionDiffs = revisions.map(p=>p.diff)
            // const denom = sum(revisionDiffs)
            // revisionDiffs.pop()
            // let numerator = sum(revisionDiffs.map(p=>p*p))
            // const leftovers = (2*wholeDiff * forwardDiff) - (forwardDiff * forwardDiff)
            // numerator += leftovers;
            const theScore = choppedScore(revisions, start)
            await knex('score').insert({article_id:articleIds[i],score:theScore,reference_time:ref, mode:mode})
        }
        // console.log(await knex('score').insert(forInsertion).returning('*')) //or this can be done in one insert
    }
    }
}

function x_over_x_periodRatio(weeks){
    return async (articleIds, ref) =>{
            // const artid = 64104713
    // const artid = 52231773
    const mid = ref - (60*60*24*7*(weeks/2))
    const start = ref - (60*60*24*7*weeks)
    const mode = `${weeks} week trend ratio`

    const eligibleRows = await knex('revision').distinct('article_id').where("timestamp", "<", start)

    for(let row = 0; row < eligibleRows.length; row++){
        const artid = eligibleRows[row].article_id
        const latest = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', ref).orderBy('timestamp', 'desc').first()
        const refrecord1 = {timestamp:ref, diff:ref-latest.timestamp}
        const revisions1 = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', ref).where('timestamp','>=',mid ).orderBy('timestamp', 'desc')
        revisions1.unshift(refrecord1)
        // const wholeDiff1 = revisions1[revisions1.length -1].timestamp
        // const forwardDiff1 = wholeDiff1 - mid
        // revisions1[revisions1.length - 1].diff = forwardDiff1
        // const revisionDiffs1 = revisions1.map(p=>p.diff)
        // const denom1 = sum(revisionDiffs1)
        // revisionDiffs1.pop()
        const bignumer = choppedScore(revisions1, mid)

    
        const median = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', mid).orderBy('timestamp', 'desc').first()
        const refrecord2 = {timestamp:mid, diff:mid-median.timestamp}
        const revisions2 = await knex('revision').select('timestamp', 'diff').where({article_id:artid}).where('timestamp', '<', mid).where('timestamp','>=',start ).orderBy('timestamp', 'desc')
        revisions2.unshift(refrecord2)
        // const wholeDiff2 = revisions2[revisions2.length -1].timestamp
        // const forwardDiff2 = wholeDiff2 - start
        // revisions2[revisions2.length - 1].diff = forwardDiff2
        // const revisionDiffs2 = revisions2.map(p=>p.diff)
        // const denom2 = sum(revisionDiffs2)
        // revisionDiffs2.pop()
        // const numerator2 = sum(revisionDiffs2.map(p=>p*p))
        //get the plain sum of the revision diffs
        // pop the last from revisions
        //get the sum of squares of revisions
        // const lastCumulative = (wholeDiff * forwardDiff) - (forwardDiff * forwardDiff)
        // const forwardRecord = {timestamp:start, diff:forwardDiff}
        // revisions.push(forwardRecord)
        
        // console.log(revisions.slice(revisions.length-2), lastCumulative);
        // console.log(revisions1.filter(p=>p.diff>10000));
        // console.log((numerator1/denom1)/(60*60),(numerator1/denom1));
        // console.log(revisions2.filter(p=>p.diff>10000));
        // console.log((numerator2/denom2)/(60*60),(numerator2/denom2));
        // console.log((numerator1/denom1)/(numerator2/denom2));
        const bigdenom = choppedScore(revisions2, start)
        const thescore =  bignumer/bigdenom
        console.log(`${artid}: ${thescore}`);
        // if (thescore < .1){
        //     // console.log(numerator1,denom1);
        // }
        // console.log(
            await knex('score').insert({article_id:artid,score:thescore,reference_time:ref, mode:mode}).returning('*')
            // );

    }
    }
}

async function getYearlyScores(){
    await getScores(xWeeklyAvgPeriod(52))
}

async function getTYM(){
    await getScores(x_over_x_periodRatio(52))
}

async function getWeekAverage(weeks){
    await getScores(xWeeklyAvgPeriod(weeks))
}

async function getWeekTrending(weeks){
    await getScores(x_over_x_periodRatio(weeks))
}

module.exports = {getAllTimeScores, getYearlyScores,getTYM, getWeekAverage, getWeekTrending}