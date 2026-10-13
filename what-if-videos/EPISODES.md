# Episode briefs

Each episode is made by following `PLAYBOOK.md`. The facts listed here are leads only: verify every one with
web search before you use it, and replace any that don't hold up.

---

## 2. `power-grid`: What if the power grid failed for a month?
- **Hook:** "What if the power went out… and didn't come back for a month?"
- **Goal bar:** DAY 1 → DAY 30.
- **HUD:** "PEOPLE WITHOUT POWER" or "HOURS SINCE THE LIGHTS WENT OUT".
- **Beats:**
  1. Day 1 feels like a camping trip.
  2. Phones die, fridges warm up.
  3. Day 3: water pressure drops (pumps need power).
  4. Petrol pumps can't pump.
  5. Hospitals on generator fuel.
  6. Twist: what still works and who's ready.
  7. Recovery: black-start, how grids restart.
- **Leads to verify:**
  - Texas Feb 2021: 4.5 million homes without power.
  - The 2003 Northeast blackout: 50 million people.
  - The Iberian blackout, 28 April 2025.
  - Hospital backup generator fuel (typically 72–96 h).
  - Large transformers take a year or more to replace.
- **Visuals:**
  - The city kit at night, going dark block by block (city window shader), candles in the cut-open flats.
  - A street with dead traffic lights.
  - A water tower/pump.
  - The final relight wave across the city.

## 3. `ai-takeover`: What if AI became smarter than us?
- **Hook:** "What if AI became smarter than every human… combined?"
- **Goal bar:** "AI vs HUMAN" intelligence passing 100%.
- **Beats:**
  1. Today's AI.
  2. AI writes better code than its makers.
  3. It improves itself (the intelligence explosion idea).
  4. The real worry isn't evil robots, it's goals that don't match ours (the alignment problem). Pair it
     with a grounded example, like a reward-hacking story from research.
  5. The off-switch problem.
  6. Twist and outcome: what researchers and governments are actually doing (safety research, the
     EU AI Act, AI safety institutes), and why it isn't decided yet.
- **Tone:** Balanced; not doom.
- **Leads to verify:**
  - Expert surveys on when AI could match human ability (e.g. the AI Impacts 2023 survey).
  - The EU AI Act came into force in 2024.
- **Visuals:**
  - Reuse the OMNI tower and its cyan look (a sequel feel).
  - A data-centre interior.
  - The 100-people stage.

## 4. `ww3`: What if World War 3 started tomorrow?
- **Hook:** "What if World War 3 started… tomorrow morning?"
- **Tone:** Grounded and NON-graphic, no gore, no named real leaders as villains. Focus on what changes for an
  ordinary person and on why deterrence has held since 1945.
- **Beats:**
  1. Alerts on phones.
  2. Markets crash.
  3. Fuel and food prices jump.
  4. Cyberattacks on infrastructure.
  5. Flights stop.
  6. Twist: why big powers haven't fought each other directly since 1945 (deterrence, trade).
  7. Outcome: most wars end by negotiation.
- **Leads to verify:**
  - Global military spending ~$2.4 trillion in 2023 (SIPRI).
  - Oil price spikes in past crises.
  - Number of nuclear warheads (~12,000, FAS).
- **Visuals:**
  - The city kit: phone alerts glowing red, queues at petrol stations, a market board crashing, quiet
    streets, the night sky.
  - No explosions in the city.

## 5. `pandemic`: What if a pandemic worse than COVID hit?
- **Hook:** "What if a virus worse than COVID hit… tomorrow?"
- **Goal bar:** "CITIES REACHED" / days.
- **Beats:**
  1. Patient zero.
  2. A flight carries it to 10 cities in a week.
  3. R number explained visually.
  4. Hospitals fill.
  5. Twist: we are faster now (mRNA vaccines were designed in days in 2020; 100-days mission).
  6. Outcome.
- **Leads to verify:**
  - The Moderna vaccine sequence was designed within ~2 days of the genome being published (Jan 2020).
  - CEPI 100 Days Mission.
  - Spanish flu 1918: ~500 million infected.
- **Visuals:**
  - Glowing dots spreading over people on the stage grid, a flight-path globe (the NASA Earth textures in
    `assets/earth`), hospital beds, empty streets.

## 6. `asteroid`: What if an asteroid was heading for Earth?
- **Hook:** "What if a giant asteroid was heading straight for Earth?"
- **Goal bar:** countdown "IMPACT IN: years → 0" that the twist stops.
- **Beats:**
  1. Discovery.
  2. Size matters (a city-killer vs a dinosaur-killer).
  3. The plan: NASA's DART hit Dimorphos in 2022 and changed its orbit by 32 minutes.
  4. Twist: the earlier we find it, the smaller the push.
  5. Outcome: NEO Surveyor.
- **Leads to verify:**
  - Chelyabinsk 2013 (~20 m, 1,500 injured, mostly glass).
  - Tunguska 1908.
  - Chicxulub ~10 km.
  - DART: 32-minute period change.
- **Visuals:** space (reuse `space-ladder.js` atmosphere/Earth and `engine/lib/cosmos.js`), an asteroid
  model, a DART impact flash, an orbit diagram.

## 7. `yellowstone`: What if Yellowstone erupted?
- **Hook:** "What if Yellowstone erupted… today?"
- **Beats:**
  1. Earthquakes and ground swelling.
  2. The eruption column.
  3. An ash map across the US (cm/inches by city).
  4. A "year without summer" effect.
  5. Twist: how likely it really is (USGS: roughly 1 in 730,000 per year).
  6. A much more likely smaller event.
- **Leads to verify:**
  - The last super-eruption was 631,000 years ago.
  - The USGS ash-fall model (Mastin et al. 2014).
  - Tambora 1815 → 1816, the "Year Without a Summer".
- **Visuals:**
  - Terrain plus a column (reuse water/terrain helpers or a new heightfield).
  - An ash map over a US outline.
  - Grey snow-like ash over the city kit.

## 8. `bees`: What if all the bees disappeared?
- **Hook:** "What if every bee on Earth… disappeared?"
- **Beats:**
  1. Walk through a supermarket as products vanish shelf by shelf (`buildStore` with
     `dynamicProducts: true` is made for this).
  2. Twist: the staples (wheat, rice, corn) are wind-pollinated, so we wouldn't starve, but food gets dull
     and expensive.
  3. Hand-pollination in China.
  4. Outcome.
- **Leads to verify:**
  - About 75% of leading food crops benefit from animal pollination (FAO).
  - Almonds depend almost entirely on bees.
  - Pollinator-dependent crops are worth $235–577 billion a year (IPBES).
- **Visuals:** the store shelves emptying by colour, fields, a giant bee, the 100-people stage for diets.

## 9. `money-collapse`: What if money stopped working?
- **Hook:** "What if the dollar in your pocket… became worthless?"
- **Goal bar:** "PRICE OF BREAD" climbing (show $ and €).
- **Beats:**
  1. Prices doubling.
  2. People rushing to spend wages the same day.
  3. Barter.
  4. Twist: it has happened (Weimar 1923, Zimbabwe 2008, Venezuela).
  5. Outcome: how countries fixed it (new currency, independent central bank).
- **Leads to verify:**
  - Weimar: prices doubled every ~3.7 days in Oct 1923.
  - Zimbabwe: a 100-trillion-dollar note.
  - Hungary 1946: the highest inflation ever recorded.
- **Visuals:** the store price signs flipping, wheelbarrows of cash, a counter going absurd.

## 10. `housing`: What if you could never afford a house?
- **Hook:** "What if you could never afford a home… no matter how hard you worked?"
- **Goal bar:** "YEARS OF SALARY TO BUY A HOME".
- **Beats:**
  1. Prices vs wages over time (house-price-to-income ratio).
  2. A generation of renters.
  3. Living with parents.
  4. Twist: places that fixed it (Vienna social housing, Tokyo zoning).
  5. Outcome.
- **Leads to verify:**
  - US median home price ÷ median household income: ~3 in 1985 → ~5–6 today.
  - Vienna: about half of residents live in social or council housing.
  - Tokyo builds more homes than all of California.
- **Visuals:**
  - The cut-open flats.
  - A price counter racing past a salary counter.
  - A person on a treadmill of years.
  - The 100-people stage (owners vs renters by generation).
