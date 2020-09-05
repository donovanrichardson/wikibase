# Wikibase
Backend for app that analyzes Wikipedia article edit frequency. 

## Self-weighted mean

This API uses self-weighted mean to determine average edit frequency, or period of time between edits.
This is preferable to arithmetic mean because it reflects the fact that articles with longer periods of time between edits are more likely to be stale at any given time.

An example: there two are articles which each have been edited 12 times in the past 24 hours. Article A was edited eleven times around 1AM, and then one more time at 9PM, while Article B was edited once every two hours exactly.
Article A can be said to have been edited less frequently, since it is more often staler than Article B. Using artithmetic mean, both of these articles are edited every two hours on average; when using self weighted mean, Article A is edited approximately every 17 hours, while Article B's average is unchanged.


## Routes

### GET /most_edited

Returns the top 10 articles that have been edited most frequently in the past four weeks.

Criteria:

- Article must not have been created within the past four weeks

### GET /trending

Returns articles that were more frequently edited in the past two weeks than in the previous two weeks.

Criteria:

- Article must not have been created within the past four weeks
- Article must have an average period between edits of 3.5 days (84 hours)
