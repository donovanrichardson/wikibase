const {getWeekAverage, getWeekTrending} = require('./analysis')

async function score(){
    await getWeekAverage(4)
    await getWeekTrending(4)
}

score()