const config = require('./knexfile.js')['development']
var knex = require('knex')(config);

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
        for (i = 0; i < articleIds.length; i++){ //i should take account of the fact that some may go beyond reference time by stipulating before reference time
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

async function allTimeAverage(articleIds, ref){
    // need to add reference diff
    const mode = "all time average"
    const alreadyExists = await refExists(ref, mode)
    if(alreadyExists){
        console.log('score already exists');
        return alreadyExists
    } else{
        console.log(articleIds);
        for (i = 0; i < articleIds.length; i++){ //i should take account of the fact that some may go beyond reference time by stipulating before reference time
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

async function getScores(callback){
    let ref = await knex('reference').select('time').orderBy('time', 'desc').first()//handle when domain no exist
    const thequery = knex('score').leftJoin('article',{'article.id':'score.article_id'}).select().where({reference_time:ref.time}).orderBy('score') //wont work if there;s nothing in the table
    console.log(thequery.toQuery());
    const existsScore = await thequery;
    if(existsScore.length > 0){  //duplicates are not fine
        console.log(existsScore);
    }else{
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
    } //duplicates are not fine
    // knex.destroy()
}

async function getAllTimeScores(){
    await getScores(allTimeAverage)
}

async function getFourWeekScores(){
    await getScores(fourWeekAverage)
}

module.exports = {getAllTimeScores, getFourWeekScores}