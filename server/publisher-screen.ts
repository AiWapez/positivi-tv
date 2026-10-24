import type { Category, StoryLabel } from '../src/types/index.ts';

/**
 * Deterministic headline screening for the automatic publisher-feed lane.
 *
 * What this is: a conservative, inspectable rule set over the headline (and, for a few hard
 * exclusions, the first part of the feed description). It decides only "list with labels" or "exclude".
 *
 * What this is not: it does not implement the GoodSignal v3 grounding, evidence-span, event-date or
 * corroboration system. It cannot read the article, check facts, confirm the event happened, judge
 * independence of sources, or guarantee suitability for every reader or child. Rules match words, so they
 * will both miss bad items and drop good ones. The bias is deliberately toward exclusion.
 */
export interface ScreenInput { title: string; description: string; defaultCategory: Category | 'auto'; now: string }
export interface ScreenResult { decision: 'list' | 'exclude'; reasons: string[]; labels: StoryLabel[]; category: Category | null }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
/** Whole-word matcher. "dead" does not match "deadlift"; "war" does not match "award". */
const words = (list: string[]) => new RegExp('(?<![\\w-])(?:' + list.map(escape).join('|') + ')(?![\\w-])', 'i');
const stems = (list: string[]) => new RegExp('(?<![\\w-])(?:' + list.join('|') + ')(?![\\w-])', 'i');

/** Always excluded wherever they appear in the headline or description lead. */
const HARM = stems(['kill(?:s|ed|ing|ings|er|ers)?', 'murder(?:s|ed|er|ers|ing)?', 'massacre[sd]?', 'shootings?', 'shooters?', 'shot dead', 'gunm[ae]n',
  'stab(?:s|bed|bing|bings)?', 'bomb(?:s|ed|ing|ings|er|ers)?', 'explosions?', 'attack(?:s|ed)?', 'hostages?', 'kidnap(?:s|ped|ping)?', 'death tolls?', 'fatal(?:ly|ities)?',
  'dies', 'died', 'deaths?', 'drown(?:s|ed|ing)?', 'crash(?:es|ed)?', 'assault(?:s|ed)?', 'rape[sd]?', 'suicides?', 'overdoses?', 'gunfire',
  'child marriages?', 'cull(?:s|ed|ing)?', 'slaughter(?:s|ed)?',
  // Policy 0.6.0 (stricter only): more forms and more violent events.
  'rampages?', 'executions?', 'tortur(?:e|es|ed|ing)', 'abduct(?:s|ed|ing|ion|ions)?', 'starv(?:e|es|ed|ing|ation)', 'slain', 'beheaded', 'beheadings?',
  'lynch(?:ed|ing|ings)', 'casualties', 'wounded', 'mass graves?', 'corpses?']);
/** Extractive and fossil industries. Excluded wherever they appear in the headline. */
const EXTRACTIVE = stems(['coal', 'oil', 'gas(?:es)?', 'pipelines?', 'mines?', 'mining', 'drilling', 'fracking', 'whal(?:ing|ers?)', 'hunt(?:s|ers?|ing)?',
  'troph(?:y|ies)', 'trawl(?:s|ers?|ing)?', 'fishing fleets?', 'petrol', 'diesel', 'fossil', 'petroleum', 'refiner(?:y|ies)',
  // Policy 0.6.0 (fix 13): mined minerals. "gold" and "plants" are left alone on purpose (gold medals, planted trees).
  'nickel', 'lithium', 'cobalt', 'copper', 'bauxite', 'uranium', 'iron ore', 'rare earths?', 'smelters?']);
const ENFORCEMENT = stems(['arrest(?:s|ed)?', 'charged', 'indicted', 'convicted', 'sentenced', 'jailed', 'prisons?', 'lawsuits?', 'sue[sd]?',
  'probes?', 'investigations?', 'raids?', 'bust(?:ed)?', 'rackets?', 'seize[sd]?', 'nabbed', 'frauds?', 'scam(?:s|mers?)?', 'smuggl(?:ing|ed|ers?)',
  'traffick(?:ing|ed|ers?)', 'police']);
const CONFLICT = stems(['wars?', 'warfare', 'airstrikes?', 'invasions?', 'invaded?', 'ceasefires?', 'sanctions?', 'famines?', 'outbreaks?',
  'epidemics?', 'pandemics?', 'crisis', 'crises', 'emergenc(?:y|ies)', 'evacuat(?:e|ed|ion)', 'collapse[sd]?', 'militants?', 'troops', 'militar(?:y|ies)',
  'terror(?:ism|ists?)?', 'genocides?', 'riots?']);
/**
 * Armed groups, weapons and state violence (policy 0.6.0). Headline only; reported as CONFLICT_OR_CRISIS. The bare words "conflict", "executed",
 * "arms", "bets", "bodies" and "escort" are left out on purpose because they would hold back good stories.
 */
const ARMED = stems(['rebels?', 'militias?', 'armies', 'army', 'soldiers?', 'offensives?', 'cartels?', 'regimes?', 'juntas?', 'missiles?', 'warheads?',
  'weapons?', 'weaponry', 'armed', 'drone strikes?', 'gunships?', 'artillery', 'shelling', 'ammunition', 'firearms?', 'guns?', 'insurgents?', 'jihadists?',
  'paramilitar(?:y|ies)', 'conflict[- ](?:hit|torn|affected|stricken|ravaged|ridden)', 'was executed', 'executed by']);
/**
 * Topics a recovery word must never unlock (policy 0.6.0). Headline and description lead; reported as SENSITIVE_TOPIC. Hate groups, abuse and
 * exploitation, slavery, cults, landmines, harmful traditional practices, and surveillance and hacking.
 */
const SENSITIVE = stems(['neo-nazis?', 'nazis?', 'white supremac(?:y|ists?)', 'hate groups?', 'hate crimes?', 'hate speech', 'extremis(?:m|ts?)', 'kkk',
  'ku klux klan', 'fascis(?:m|ts?)',
  '(?:child|domestic|sexual|elder|substance|drug) abuse', 'abusers?', 'domestic violence', 'sexual (?:violence|exploitation)', 'sex (?:slavery|trafficking)',
  'slavery', 'enslave(?:d|ment)', 'cults?', 'land ?mines?', 'unexploded ordnance', 'femicides?', 'honou?r killings?', 'fgm', 'female genital',
  'child soldiers?', 'child labou?r', 'child brides?', 'forced (?:labou?r|marriages?)',
  'surveillance', 'facial recognition', 'spyware', 'predictive policing', 'censorship', 'internet shutdowns?', 'data breach(?:es)?', 'hack(?:s|ed|ers?|ing)']);
/** Adult content and vice (policy 0.6.0). Headline only. The bare word "bets" is left out on purpose. */
const VICE = stems(['casinos?', 'gambl(?:e|es|ed|ing|ers?)', 'betting', 'sportsbooks?', 'tobacco', 'cigarettes?', 'vap(?:e|es|ing|ers?)', 'nicotine', 'liquor',
  'strip clubs?', 'adult films?', 'adult content', 'pornograph(?:y|ic)', 'brothels?', 'cannabis', 'marijuana']);
/** Opinion, dispute and warning framing. Excluded from the headline only. */
const STANCE = stems(['critics?', 'criticisms?', 'backlash(?:es)?', 'controvers(?:y|ial)', 'slams?', 'blasts', 'warns?', 'warnings?', 'concerns?',
  'alleged(?:ly)?', 'accuse[sd]?', 'condemn(?:s|ed)?', 'outrages?', 'opinions?', 'op-eds?', 'should', 'must', 'debates?', 'fears?', 'protests?',
  'interviews?', 'commentar(?:y|ies)', 'q&a', 'analys(?:is|es)', 'editorials?', 'podcasts?', 'explainers?']);
/** Never automated, matching GoodSignal's NEVER_AUTOMATE topics. Headline only. */
const GOVERNANCE = stems(['bills?', 'legislation', 'lawmakers?', 'congress(?:es)?', 'parliaments?', 'senates?', 'elections?', 'votes?', 'voted', 'voting',
  'ballots?', 'campaigns?', 'presidents?', 'prime ministers?', 'ministers?', 'ministr(?:y|ies)', 'governments?', 'polic(?:y|ies)', 'regulations?',
  'tariffs?', 'courts?', 'rulings?', 'judges?', 'treat(?:y|ies)', 'laws?', 'mayors?', 'politic(?:s|al|ians?)', 'referend(?:um|ums|a)', 'governors?', 'councils?',
  'senators?', 'mps', 'officials?', 'bans?', 'banned', 'legali[sz](?:e|es|ed|ation)', 'rights', 'land titles?', 'strikes?', 'unions?',
  'migrants?', 'migration', 'asylum', 'immigra(?:nts?|tion)', 'same-sex', 'marriages?']);
/** Case-sensitive institutional acronyms. */
const GOVERNANCE_ACRONYM = /(?<![\w-])(?:EU|UN|NATO|MPs?|G7|G20|COP\d*)(?![\w-])/;
const HEALTH = stems(['cancers?', 'diseases?', 'vaccines?', 'drugs?', 'therap(?:y|ies)', 'treatments?', 'cures?', 'patients?', 'clinical',
  'trials?', 'hospitals?', 'surger(?:y|ies)', 'medical', 'medicines?', 'health', 'healthcare', 'virus(?:es)?', 'infections?', 'covid', 'diabetes',
  "alzheimer'?s", 'dementia', 'depression', 'anxiety', 'obesity', 'diet', 'weight loss', 'pregnan(?:t|cy)', 'mental', 'measles', 'mpox',
  'polio', 'malaria', 'malaria-free', 'hiv', 'flu', 'influenza', 'bird flu', 'cholera', 'ebola', 'tuberculosis', 'dengue', 'zika',
  'cases?', 'pathogens?', 'bacteria', 'antibiotics?', 'symptoms?', 'doctors?', 'nurses?', 'clinics?']);
/** Case-sensitive acronyms, so "who" and "aids" as ordinary words do not match. */
const HEALTH_ACRONYM = /(?<![\w-])(?:WHO|AIDS|HIV|TB)(?![\w-])/;
/** Economic distress and trend-record framing. Headline only. */
const DISTRESS = stems(['unemployment', 'inflation', 'recession', 'layoffs?', 'bankrupt(?:cy)?', 'record (?:high|low|levels?|extent)',
  'hits? record', 'all-time (?:high|low)', 'bleaching', 'sea ice', 'heat records?', 'new (?:record|high|low)', 'break(?:s)? records',
  'record (?:number|numbers|catch|haul|temperatures?|heat|levels?|prices?|deaths?|cases)', 'highest level', 'lowest level']);
const HYPE = stems(['miracles?', 'revolutionary', 'game[- ]changer', 'breakthroughs?', 'you won.t believe', 'shocking']);
const PROMO = stems(['sponsored', 'partner content', 'press release', 'giveaways?', 'discounts?', 'sale', 'deals?', 'coupons?', 'webinars?',
  'register now', 'subscribe', 'buy now']);
const RETROSPECTIVE = stems(['anniversar(?:y|ies)', 'years ago', 'decades ago', 'looking back', 'years later', 'remembering', 'obituar(?:y|ies)', 'legacy', 'in memoriam',
  // Policy 0.6.0: old events with no year written. "a century" on its own is deliberately not listed.
  'a decade ago', '(?:ten|twenty|thirty|forty|fifty|\\d+) years on', 'decades on', '(?:two|three|four|five|\\d+) generations later', 'last century', 'a century ago',
  'centuries ago', 'long ago']);
const CLIMATE_ALARM = words(['record heat', 'record temperatures', 'hottest', 'heatwave', 'heat wave']);
/** Negative vocabulary that is allowed only when the same headline states a recovery or protective outcome. */
const CONTEXT_NEGATIVE = stems(['disasters?', 'flood(?:s|ing|ed)?', 'droughts?', 'wildfires?', 'fires?', 'hurricanes?', 'cyclones?', 'typhoons?',
  'earthquakes?', 'tsunamis?', 'storms?', 'abuse[sd]?', 'exploitation', 'violence', 'homeless(?:ness)?', 'poverty', 'hunger', 'hungry', 'endangered',
  'extinct(?:ion)?', 'deadly', 'lethal', 'venomous', 'poisonous', 'eruptions?', 'volcano(?:es)?', 'landslides?', 'mudslides?', 'avalanches?', 'sinkholes?', 'blackouts?', 'outages?', 'power cuts?',
  'declin(?:e|es|ing)', 'pollut(?:ion|ed)', 'dead', 'dying', 'addiction', 'victims?', 'threat(?:s|ened)?', 'at risk',
  'damaged', 'destroyed', 'injured', 'orphaned', 'stranded', 'trapped', 'missing', 'refugees?', 'loss', 'lost', 'losing',
  'vulnerable', 'invasive', 'illegal', 'deforestation', 'logging', 'mining', 'poach(?:ing|ers?)', 'spills?', 'toxic', 'contaminat(?:ed|ion)',
  'drift(?:s|ing)', 'spread(?:s|ing)', 'worsen(?:s|ing|ed)', 'shrink(?:s|ing)', 'rising', 'risks?', 'danger(?:s|ous)?', 'struggl(?:e|es|ing)', 'battl(?:e|es|ing)',
  'locusts?', 'mosquito(?:es)?', 'pests?', 'algae', 'blooms?', 'sinking', 'relocat(?:e|es|ed|ion)', 'displaced', 'melt(?:s|ing)?', 'smog', 'resistance']);
/**
 * Recovery or protective actions. Deliberately excludes verbs that also describe a problem coming back
 * ("violence returns", "deforestation rebounds", "sludge released").
 */
const RECOVERY = stems(['restor(?:e|es|ed|ing|ation)', 'rebuil(?:d|ds|t|ding)', 'recover(?:s|ed|y|ing)?', 'rescu(?:e|es|ed|ing)',
  'reopen(?:s|ed)?', 'protects', 'protection', 'shelters?', 'survivors?', 'help(?:s|ed)?', 'support(?:s|ed)?', 'clean(?:s|ed|up|-up)?',
  'reunit(?:e|es|ed)', 'sav(?:e|es|ed)', 'thriv(?:e|es|ing)', 'comeback', 'remov(?:e|es|ed|al)', 'rehom(?:e|ed)', 'replant(?:s|ed)?',
  'regrow(?:s|th)?', 'resilien(?:t|ce)', 'new homes?', 'back from the brink', 'heal(?:s|ed)?']);
/** Statements of intent or uncertainty. Future plans are not outcomes. */
const INTENT = stems(['will', "'ll", 'plans?', 'planned', 'planning', 'aims?', 'aiming', 'propos(?:e|es|ed|al)', 'pledg(?:e|es|ed)',
  'promis(?:e|es|ed)', 'set to', 'could', 'can', 'might', 'would', 'hopes?', 'hoping', 'expected', 'expects?', 'seeks?', 'wants?',
  'consider(?:s|ing)?', 'mulls?', 'eyes', 'eyeing', 'bids? to', 'upcoming', 'soon', 'next year', 'potential(?:ly)?', 'possibl[ey]',
  'to (?:open|launch|build|restore|plant|protect|create|deliver|expand|begin|start|get|receive|become|host|return|reopen|unveil|release|introduce|ban|cut|end|reach|save)',
  'designs?', 'blueprints?', 'concepts?', 'proposals?', 'vision', 'renderings?', 'masterplan', 'master plan', 'roadmap', 'target', 'goal',
  'readies', 'readying', 'prepares? to', 'preparing to', 'poised', 'gears? up', 'on track', 'slated', 'scheduled', 'forthcoming', 'in the works',
  'funding', 'grants?', 'invest(?:s|ed|ing|ment|ments|ors?)?', 'orders?', 'pre-orders?', 'commit(?:s|ted|ment|ments)?', 'permits?']);
/** Money amounts usually describe financing or prices, not an outcome. */
const MONEY = /[$£€¥]\s?\d/;
/** Lower-case only, so the month "May" in a headline is not read as uncertainty. */
const MAY = /(?<![\w-])may(?![\w-])/;
const IN_PROGRESS = stems(['begins?', 'began', 'starts?', 'started', 'breaks ground', 'underway', 'under way', 'pilot', 'trial run']);
/** Completed-outcome markers (headline tense). Required for listing. */
const COMPLETED = stems(['open(?:s|ed)?', 'reopen(?:s|ed)?', 'launch(?:es|ed)?', 'complet(?:e|es|ed)', 'finish(?:es|ed)', 'reach(?:es|ed)',
  'restor(?:e|es|ed)', 'rescu(?:e|es|ed)', 'wins?', 'won', 'record(?:-breaking|-setting)?', 'discover(?:s|ed)?', 'finds?', 'found',
  'reveal(?:s|ed)', 'unveil(?:s|ed)', 'sav(?:e|es|ed)', 'return(?:s|ed)?', 'reunit(?:e|es|ed)', 'rebuil(?:d|ds|t)', 'plant(?:s|ed)?',
  'protect(?:s|ed)?', 'graduat(?:e|es|ed)', 'celebrat(?:e|es|ed)', 'achiev(?:e|es|ed)', 'becom(?:e|es)', 'became', 'hatch(?:es|ed)?',
  'born', 'spotted', 'recover(?:s|ed)', 'rebound(?:s|ed)', 'thriv(?:e|es|ing)', 'clean(?:s|ed)', 'replant(?:s|ed)?', 'regrow(?:s|n)?',
  'rewild(?:s|ed)?', 'reintroduc(?:e|es|ed)',
  'remov(?:e|es|ed)', 'buil(?:d|ds|t)', 'donat(?:e|es|ed)', 'rais(?:e|es|ed)', 'creat(?:e|es|ed)', 'deliver(?:s|ed)', 'earn(?:s|ed)',
  'award(?:s|ed)', 'honou?r(?:s|ed)', 'receiv(?:e|es|ed)', 'captur(?:e|es|ed)', 'detect(?:s|ed)', 'mapp?(?:s|ed)',
  'land(?:s|ed)', 'cross(?:es|ed)', 'breaks?', 'broke', 'beat(?:s)?', 'milestone', 'successful(?:ly)?', 'releas(?:e|es|ed)',
  'welcom(?:e|es|ed)', 'help(?:s|ed)']);
/** Research context. Listed, but labelled so a study is not presented as an outcome in use. */
const RESEARCH_ACTOR = /(?<![\w-])(?:researchers?|scientists?|engineers?|lab|laboratory|university|[\w]+-funded)(?![\w-])[^.:;]{0,40}?(?<![\w-])(?:creat(?:e|es|ed)|develop(?:s|ed)?|design(?:s|ed)?|discover(?:s|ed)?|finds?|found|shows?|showed|achiev(?:e|es|ed)|identif(?:y|ies|ied)|builds?|built|engineer(?:s|ed)|invent(?:s|ed)?|tests?|tested|demonstrat(?:e|es|ed)|reveal(?:s|ed)|mapp?(?:s|ed)|observ(?:e|es|ed)|detect(?:s|ed)?|produc(?:e|es|ed)|turn(?:s|ed)?|grow(?:s|n)?|print(?:s|ed)?)(?![\w-])/i;
const RESEARCH = stems(['stud(?:y|ies)', '(?:study|report|survey|analysis) (?:finds|found|shows|suggests)', 'findings?', 'prototypes?', 'proof of concept', 'lab-grown', 'preprint', 'labs?', 'laboratory', 'mice', 'rats',
  'experiments?', 'experimental', 'peer-reviewed', 'journal', 'paper', 'simulations?', 'discover(?:s|ed|y|ies)?', 'detect(?:s|ed|ion)?',
  'observ(?:e|es|ed|ations?)', 'telescopes?', 'astronomers?', 'scientists? (?:find|found|discover|detect|observe|identify)', 'new species']);
const ADVICE = /^(?:\d+\s+(?:ways|things|tips|reasons|ideas|places|books|steps|lessons)\b|how to\b|ways to\b|why\b|how\b|what\b|who\b|when\b|where\b|is\b|are\b|can\b|should\b|do\b|does\b|will\b)|\b(?:tips|guide|you can|your|best\s+\w+\s+(?:for|to))\b/i;
const OLD_EVENT_PHRASE = /\b(?:in|since|back in|opened in|launched in|founded in|inaugurated in|completed in|built in|established in|started in)\s+((?:19|20)\d{2})\b/gi;
const YEAR = /(?<!\d)((?:19|20)\d{2})(?!\d)/g;

const PLANET = stems(['climate', 'forests?', 'ocean', 'oceans', 'seas?', 'reefs?', 'coral', 'wildlife', 'species', 'animals?', 'birds?',
  'whales?', 'turtles?', 'solar', 'wind', 'renewables?', 'energy', 'conservation', 'rivers?', 'trees?', 'habitats?', 'nature', 'rewild(?:ing)?',
  'wetlands?', 'bees?', 'national park', 'marine', 'emissions', 'recycling', 'kelp', 'salmon', 'falcons?', 'eagles?', 'owls?', 'wolves', 'bears?',
  'lions?', 'elephants?', 'tigers?', 'rhinos?', 'sharks?', 'dolphins?', 'frogs?', 'butterfl(?:y|ies)', 'otters?', 'beavers?', 'bison', 'orangutans?']);
const SCIENCE = stems(['space', 'nasa', 'rovers?', 'telescopes?', 'astronom(?:y|ers?)', 'mars', 'moon', 'physics', 'quantum', 'research',
  'study', 'scientists?', 'discovery', 'robots?', 'fossils?', 'dinosaurs?', 'archaeolog(?:y|ists?)', 'galax(?:y|ies)', 'satellites?']);

const lead = (text: string) => text.slice(0, 400);

/**
 * Policy 0.6.0: invisible and lookalike characters. A format character (soft hyphen, zero-width characters, direction controls, byte-order mark),
 * a variation selector, or a single word that mixes Latin letters with Greek or Cyrillic letters can hide a banned word from the lists. The text
 * is not repaired; the story is held back. Checked on the raw text, before any normalising.
 */
const INVISIBLE = /[\p{Cf}\u034f\u180b-\u180d\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/u;
const LATIN = /\p{Script=Latin}/u;
const GREEK_OR_CYRILLIC = /[\p{Script=Greek}\p{Script=Cyrillic}]/u;
export function hasSuspiciousCharacters(rawTitle: string, rawDescription: string): boolean {
  const headline = String(rawTitle ?? ''), descriptionLead = lead(String(rawDescription ?? ''));
  if (INVISIBLE.test(headline) || INVISIBLE.test(descriptionLead)) return true;
  for (const word of headline.match(/[\p{L}\p{M}]+/gu) ?? []) if (LATIN.test(word) && GREEK_OR_CYRILLIC.test(word)) return true;
  return false;
}

/** The same text with hyphens read as spaces, so "war-torn" is seen as "war torn". Used only by exclusion lists, never by RECOVERY or COMPLETED. */
const unhyphen = (text: string) => text.replace(/[-\u2010\u2011]/g, ' ');
/** True when an exclusion list matches the text as written or with hyphens read as spaces. */
const hits = (list: RegExp, text: string) => list.test(text) || list.test(unhyphen(text));

/**
 * The labels and category a listed card gets. Used for a story a person picked although the rules held it back: the rules' own exclusion
 * result carries none, so a pick takes them from here, and the card is labelled exactly like any other automatic card.
 */
export function listingFields(input: ScreenInput): { labels: StoryLabel[]; category: Category } {
  const title = input.title.normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
  const labels: StoryLabel[] = [];
  if (RESEARCH.test(title) || RESEARCH_ACTOR.test(title)) labels.push('research_finding');
  labels.push('event_date_unconfirmed');
  const category: Category = input.defaultCategory !== 'auto' ? input.defaultCategory
    : PLANET.test(title) ? 'Planet' : SCIENCE.test(title) ? 'Science' : 'Community';
  return { labels, category };
}

export function screenHeadline(input: ScreenInput): ScreenResult {
  const title = input.title.normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
  const desc = lead(input.description.normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim());
  const both = title + ' \n ' + desc;
  const reasons: string[] = [];
  const year = new Date(input.now).getUTCFullYear();
  if (hasSuspiciousCharacters(input.title, input.description)) reasons.push('SUSPICIOUS_CHARACTERS');
  if (!title) reasons.push('EMPTY_TITLE');
  if (hits(HARM, both)) reasons.push('HARM_EVENT');
  if (hits(ENFORCEMENT, both)) reasons.push('ENFORCEMENT_OR_LEGAL');
  if (hits(CONFLICT, both) || hits(ARMED, title)) reasons.push('CONFLICT_OR_CRISIS');
  if (hits(SENSITIVE, both)) reasons.push('SENSITIVE_TOPIC');
  if (hits(VICE, title)) reasons.push('VICE_OR_ADULT');
  if (hits(STANCE, title)) reasons.push('OPINION_OR_DISPUTE');
  if (hits(GOVERNANCE, title) || hits(GOVERNANCE_ACRONYM, title)) reasons.push('GOVERNANCE_NEVER_AUTOMATED');
  if (hits(EXTRACTIVE, title)) reasons.push('EXTRACTIVE_INDUSTRY');
  if (hits(HEALTH, title) || hits(HEALTH_ACRONYM, title)) reasons.push('HEALTH_NEVER_AUTOMATED');
  if (hits(HYPE, title)) reasons.push('HYPE');
  if (hits(PROMO, title)) reasons.push('PROMOTIONAL');
  if (hits(RETROSPECTIVE, title)) reasons.push('RETROSPECTIVE');
  if (hits(CLIMATE_ALARM, title)) reasons.push('ALARM_FRAMING');
  if (hits(DISTRESS, title)) reasons.push('DISTRESS_OR_TREND_RECORD');
  if (title.endsWith('?') || ADVICE.test(title)) reasons.push('QUESTION_ADVICE_OR_EXPLAINER');
  for (const m of title.matchAll(YEAR)) if (Number(m[1]) < year) { reasons.push('OLD_YEAR_IN_HEADLINE'); break; }
  for (const m of desc.matchAll(OLD_EVENT_PHRASE)) if (Number(m[1]) < year) { reasons.push('OLD_EVENT_YEAR_IN_DESCRIPTION'); break; }
  if (/\b(?:destruction|environmental cost|less time to recover)\b/i.test(title)) reasons.push('DETERIORATING_OUTCOME');
  // The negative side reads the hyphen-split copy; the recovery side never does, so this stays stricter only.
  if (hits(CONTEXT_NEGATIVE, title) && !RECOVERY.test(title)) reasons.push('NEGATIVE_WITHOUT_RECOVERY');
  if (/\b(?:face[sd]? (?:a )?long road (?:back|home)|await(?:s|ing)? (?:rescue|release|reunion))\b/i.test(title)) reasons.push('UNRESOLVED_OUTCOME');
  // IN_PROGRESS_NOT_OUTCOME is a hard ban that a pick cannot lift, so it is tested on its own line and is always added when it matches.
  // A headline with both an intent word and an in-progress word therefore carries both reasons. NO_COMPLETED_OUTCOME stays for when neither matches.
  const planOrUncertain = hits(INTENT, title) || hits(MAY, title) || MONEY.test(title);
  const inProgress = hits(IN_PROGRESS, title);
  if (planOrUncertain) reasons.push('PLAN_OR_UNCERTAIN');
  if (inProgress) reasons.push('IN_PROGRESS_NOT_OUTCOME');
  if (!planOrUncertain && !inProgress && !COMPLETED.test(title)) reasons.push('NO_COMPLETED_OUTCOME');
  const { labels, category } = listingFields(input);
  return reasons.length ? { decision: 'exclude', reasons, labels: [], category: null } : { decision: 'list', reasons: [], labels, category };
}
