# Simulation bench

The dashboard can be checked without a plant. The simulated plant is a generator with a fixed seed that writes the history of a series (a drift, noise, a gap, a
reading that is not a number) and the summaries a narrative is about. The real forecast, the real geometry of the small chart and the real verifier of the numbers of
a narrative run on them, and the checks state what must hold whatever the history is.

## Run it

```
npx vitest run tests/simulationBench.test.ts
```

## What the checks say

| Scenario | What it shows |
|----------|---------------|
| three hundred noisy histories | the slope of the forecast is the drift of the plant and its range holds the true value more than nine times in ten |
| a hundred random histories | the range never closes below the value or opens the wrong way |
| the points in any order | the same forecast |
| too little history, no spread in time, a horizon further than the history | no forecast, never a number that looks sure |
| readings that are not numbers | they are left out and the rest is used |
| a hundred random series for the small chart | every point inside the box, in order, the highest value at the top, and no gap becomes a number that is not a number |
| a constant series, one value, none, a box with no room | the middle, a single point, nothing, nothing |
| the sample farthest from the mean | the one a plain scan finds, the first on a tie |
| a hundred summaries drawn from a plant | a narrative that quotes them exactly, with a decimal comma or rounded is accepted |
| a figure that is not in the summary, digits of another writing system | refused, and the wrong figure is named |
| the same seed twice, another seed | the same run, and a different one |

The workflow named "Simulation bench" runs this file on every change.

## What it cannot show

How the dashboard looks and behaves with the data of a real plant, with a real data lake, a real detector and a real language model, needs the plant.
